import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { RouterOSAPI } from 'node-routeros';
import {
  SessionService,
  normalizeMac,
  isValidMac,
  TrialCooldownError,
} from '../sessionService';

describe('Trial Session Service - MAC formatting & validation', () => {
  test('isValidMac accepts standard colon, hyphen, or unseparated 12-hex strings', () => {
    assert.equal(isValidMac('00:1A:2B:3C:4D:5E'), true);
    assert.equal(isValidMac('00-1a-2b-3c-4d-5e'), true);
    assert.equal(isValidMac('001A2B3C4D5E'), true);
    assert.equal(isValidMac('invalid-mac'), false);
    assert.equal(isValidMac(''), false);
    assert.equal(isValidMac('00:1A:2B:3C:4D:5Z'), false);
  });

  test('normalizeMac normalizes any valid MAC to lowercase colon-separated format', () => {
    assert.equal(normalizeMac('00:1A:2B:3C:4D:5E'), '00:1a:2b:3c:4d:5e');
    assert.equal(normalizeMac('00-1A-2B-3C-4D-5E'), '00:1a:2b:3c:4d:5e');
    assert.equal(normalizeMac('001a2b3c4d5e'), '00:1a:2b:3c:4d:5e');
  });

  test('normalizeMac throws for invalid MAC', () => {
    assert.throws(() => normalizeMac('not-a-mac'), /Invalid MAC address/i);
  });
});

describe('Trial Session Service - Cooldown and Provisioning', () => {
  let writtenCommands: Array<{ command: string; args?: string[] }>;
  let mockWriteResponses: Record<string, any[]>;
  let origConnect: any;
  let origClose: any;
  let origWrite: any;

  beforeEach(() => {
    writtenCommands = [];
    mockWriteResponses = {};

    origConnect = RouterOSAPI.prototype.connect;
    origClose = RouterOSAPI.prototype.close;
    origWrite = RouterOSAPI.prototype.write;

    (RouterOSAPI.prototype as any).connect = async function () {
      return this;
    };
    (RouterOSAPI.prototype as any).close = async function () {
      return this;
    };
    (RouterOSAPI.prototype as any).write = async function (command: string, args?: string[]) {
      writtenCommands.push({ command, args });
      return mockWriteResponses[command] ?? [];
    };
  });

  afterEach(() => {
    RouterOSAPI.prototype.connect = origConnect;
    RouterOSAPI.prototype.close = origClose;
    RouterOSAPI.prototype.write = origWrite;
  });

  test('getTrialStatus returns ELIGIBLE when no previous trial exists', async () => {
    const mockPrisma: any = {
      session: {
        findFirst: async () => null,
      },
    };

    const service = new SessionService(mockPrisma);
    const status = await service.getTrialStatus('00:11:22:33:44:55');

    assert.equal(status.status, 'ELIGIBLE');
    assert.equal(status.isEligible, true);
    assert.equal(status.inCooldown, false);
  });

  test('getTrialStatus returns ACTIVE when a trial is currently running', async () => {
    const now = new Date();
    const endTime = new Date(now.getTime() + 6 * 60 * 1000); // 6 mins remaining
    const mockSession = {
      id: 'sess-active-trial',
      sessionToken: 'trial_abc123',
      macAddress: '00:11:22:33:44:55',
      routerId: 'router-1',
      startTime: new Date(now.getTime() - 4 * 60 * 1000),
      endTime,
      status: 'ACTIVE',
      isTrial: true,
    };

    const mockPrisma: any = {
      session: {
        findFirst: async () => mockSession,
      },
    };

    const service = new SessionService(mockPrisma);
    const status = await service.getTrialStatus('00:11:22:33:44:55');

    assert.equal(status.status, 'ACTIVE');
    assert.equal(status.isEligible, false);
    assert.equal(status.inCooldown, false);
    assert.ok(status.remainingSeconds! > 0 && status.remainingSeconds! <= 360);
    assert.equal(status.session?.id, 'sess-active-trial');
  });

  test('getTrialStatus returns COOLDOWN when trial was used 2 hours ago', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
    const endTime = new Date(startTime.getTime() + 10 * 60 * 1000);
    const mockSession = {
      id: 'sess-old-trial',
      sessionToken: 'trial_old',
      macAddress: '00:11:22:33:44:55',
      routerId: 'router-1',
      startTime,
      endTime,
      status: 'EXPIRED',
      isTrial: true,
    };

    const mockPrisma: any = {
      session: {
        findFirst: async () => mockSession,
      },
    };

    const service = new SessionService(mockPrisma);
    const status = await service.getTrialStatus('00:11:22:33:44:55');

    assert.equal(status.status, 'COOLDOWN');
    assert.equal(status.isEligible, false);
    assert.equal(status.inCooldown, true);
    assert.equal(status.remainingHours, 22); // 24 - 2 = 22 hours remaining
    assert.ok(status.remainingMinutes !== undefined);
  });

  test('getTrialStatus returns ELIGIBLE when trial was used > 24 hours ago', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
    const endTime = new Date(startTime.getTime() + 10 * 60 * 1000);
    const mockSession = {
      id: 'sess-yesterday-trial',
      macAddress: '00:11:22:33:44:55',
      startTime,
      endTime,
      status: 'EXPIRED',
      isTrial: true,
    };

    const mockPrisma: any = {
      session: {
        // query for startTime >= 24h ago will return null in Prisma
        findFirst: async ({ where }: any) => {
          if (where.startTime?.gte && where.startTime.gte > startTime) {
            return null;
          }
          return mockSession;
        },
      },
    };

    const service = new SessionService(mockPrisma);
    const status = await service.getTrialStatus('00:11:22:33:44:55');

    assert.equal(status.status, 'ELIGIBLE');
    assert.equal(status.isEligible, true);
    assert.equal(status.inCooldown, false);
  });

  test('startTrialSession creates profile, hotspot user and session for eligible MAC', async () => {
    const mockRouter = {
      id: 'r-1',
      host: '10.250.0.10',
      port: 8728,
      username: 'admin',
      password: 'pwd',
      isActive: true,
    };

    let createdSessionData: any = null;

    const mockPrisma: any = {
      router: {
        findUnique: async () => mockRouter,
      },
      session: {
        findFirst: async () => null, // no previous trial
        create: async ({ data }: any) => {
          createdSessionData = data;
          return {
            id: 'sess-new-trial-1',
            ...data,
          };
        },
      },
    };

    const service = new SessionService(mockPrisma);
    const result = await service.startTrialSession({
      routerId: 'r-1',
      macAddress: 'AA-BB-CC-DD-EE-FF',
      ipAddress: '192.168.88.50',
    });

    assert.equal(result.session.id, 'sess-new-trial-1');
    assert.equal(createdSessionData.macAddress, 'aa:bb:cc:dd:ee:ff');
    assert.equal(createdSessionData.ipAddress, '192.168.88.50');
    assert.equal(createdSessionData.isTrial, true);
    assert.equal(createdSessionData.status, 'ACTIVE');

    // Check duration is exactly 10 minutes
    const startMs = createdSessionData.startTime.getTime();
    const endMs = createdSessionData.endTime.getTime();
    assert.equal(endMs - startMs, 10 * 60 * 1000);

    // Verify RouterOS calls:
    // 1. profile add with rate-limit=2M/1M and session-timeout=10m
    const profileCmd = writtenCommands.find((c) => c.command === '/ip/hotspot/user/profile/add');
    assert.ok(profileCmd, 'Expected profile add command');
    assert.ok(profileCmd.args?.includes('=name=trial_10m'));
    assert.ok(profileCmd.args?.includes('=rate-limit=2M/1M'));
    assert.ok(profileCmd.args?.includes('=session-timeout=10m'));

    // 2. user add with profile=trial_10m and token
    const userCmd = writtenCommands.find((c) => c.command === '/ip/hotspot/user/add');
    assert.ok(userCmd, 'Expected hotspot user add command');
    assert.ok(userCmd.args?.includes(`=name=${result.session.sessionToken}`));
    assert.ok(userCmd.args?.includes('=profile=trial_10m'));
  });

  test('startTrialSession rejects with TrialCooldownError when MAC used trial within 24 hours', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4 hours ago
    const mockSession = {
      id: 'sess-recent',
      macAddress: 'aa:bb:cc:dd:ee:ff',
      startTime,
      endTime: new Date(startTime.getTime() + 10 * 60 * 1000),
      status: 'EXPIRED',
      isTrial: true,
    };

    const mockPrisma: any = {
      router: {
        findUnique: async () => ({ id: 'r-1', host: '10.0.0.1', port: 8728, username: 'u', password: 'p', isActive: true }),
      },
      session: {
        findFirst: async () => mockSession,
      },
    };

    const service = new SessionService(mockPrisma);

    await assert.rejects(
      async () => {
        await service.startTrialSession({
          routerId: 'r-1',
          macAddress: 'aa:bb:cc:dd:ee:ff',
        });
      },
      (err: any) => {
        assert.ok(err instanceof TrialCooldownError);
        assert.ok(err.remainingHours === 19 || err.remainingHours === 20);
        assert.ok(err.remainingMinutes >= 0 && err.remainingMinutes <= 59);
        return true;
      }
    );
  });

  test('upgradeTrialSession transitions active trial in-place to paid plan', async () => {
    mockWriteResponses['/ip/hotspot/user/print'] = [{ '.id': '*1', name: 'trial_abc123' }];

    const mockRouter = {
      id: 'r-1',
      host: '10.250.0.10',
      port: 8728,
      username: 'admin',
      password: 'pwd',
      isActive: true,
    };

    const mockPlan = {
      id: 'plan-3hours',
      name: '3 Hours Standard',
      duration: 3,
      speedLimit: '5Mbps',
      price: 50,
      isActive: true,
      routerId: 'r-1',
      router: mockRouter,
    };

    const initialStartTime = new Date(Date.now() - 5 * 60 * 1000); // 5 mins ago
    const trialEndTime = new Date(initialStartTime.getTime() + 10 * 60 * 1000);

    const mockTrialSession = {
      id: 'trial-sess-1',
      userId: null,
      planId: null,
      routerId: 'r-1',
      macAddress: 'aa:bb:cc:dd:ee:ff',
      sessionToken: 'trial_abc123',
      startTime: initialStartTime,
      endTime: trialEndTime,
      status: 'ACTIVE',
      isTrial: true,
      router: mockRouter,
    };

    let updatedData: any = null;

    const mockPrisma: any = {
      session: {
        findUnique: async ({ where }: any) => {
          if (where.id === 'trial-sess-1') return mockTrialSession;
          return null;
        },
        update: async ({ where, data }: any) => {
          updatedData = data;
          return {
            ...mockTrialSession,
            ...data,
          };
        },
      },
      plan: {
        findUnique: async ({ where }: any) => {
          if (where.id === 'plan-3hours') return mockPlan;
          return null;
        },
      },
      router: {
        findUnique: async () => mockRouter,
      },
    };

    const service = new SessionService(mockPrisma);
    const beforeUpgrade = Date.now();
    const result = await service.upgradeTrialSession('trial-sess-1', 'plan-3hours', 'user-paying-123');

    // Verification 1: sessionToken unchanged
    assert.equal(result.sessionToken, 'trial_abc123');

    // Verification 2: isTrial marked false
    assert.equal(updatedData.isTrial, false);
    assert.equal(updatedData.planId, 'plan-3hours');
    assert.equal(updatedData.userId, 'user-paying-123');
    assert.equal(updatedData.status, 'ACTIVE');

    // Verification 3: duration measured from payment/upgrade time (3 hours from now)
    const newEndMs = updatedData.endTime.getTime();
    const expectedEndMs = beforeUpgrade + 3 * 3600 * 1000;
    assert.ok(Math.abs(newEndMs - expectedEndMs) < 5000, 'endTime should be ~3 hours from upgrade time');

    // Verification 4: RouterOS commands update profile without tearing down connection
    // Profile created for paid plan
    const profileCmd = writtenCommands.find((c) => c.command === '/ip/hotspot/user/profile/add');
    assert.ok(profileCmd, 'Should add profile for paid plan');
    assert.ok(profileCmd.args?.includes('=name=plan_plan-3hours'));
    assert.ok(profileCmd.args?.includes('=rate-limit=5M/5M'));

    // User profile updated with set, NOT remove or disconnect
    const userSetCmd = writtenCommands.find((c) => c.command === '/ip/hotspot/user/set');
    assert.ok(userSetCmd, 'Should call /ip/hotspot/user/set');
    assert.ok(userSetCmd.args?.includes('=profile=plan_plan-3hours'));

    const removeCmd = writtenCommands.find((c) => c.command === '/ip/hotspot/user/remove');
    assert.equal(removeCmd, undefined, 'Must not remove hotspot user during seamless upgrade');

    const activeRemoveCmd = writtenCommands.find((c) => c.command === '/ip/hotspot/active/remove');
    assert.equal(activeRemoveCmd, undefined, 'Must not disconnect active session during seamless upgrade');
  });

  test('upgradeTrialSession throws if session is not an active trial', async () => {
    const mockPrisma: any = {
      session: {
        findUnique: async () => ({
          id: 'sess-already-paid',
          isTrial: false,
          status: 'ACTIVE',
        }),
      },
    };

    const service = new SessionService(mockPrisma);
    await assert.rejects(
      async () => {
        await service.upgradeTrialSession('sess-already-paid', 'plan-1');
      },
      /Session is not an active trial session/i
    );
  });

  test('upgraded trial session (wasTrial: true, isTrial: false) maintains 24h cooldown', async () => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 1 * 60 * 60 * 1000); // upgraded 1 hour ago
    const mockUpgradedSession = {
      id: 'sess-upgraded',
      macAddress: '00:11:22:33:44:55',
      sessionToken: 'token_upgraded',
      planId: 'plan-paid',
      isTrial: false,
      wasTrial: true,
      startTime,
      endTime: new Date(now.getTime() + 5 * 60 * 60 * 1000), // active paid session
      status: 'ACTIVE',
    };

    const mockPrisma: any = {
      session: {
        findFirst: async () => mockUpgradedSession,
      },
    };

    const service = new SessionService(mockPrisma);
    const status = await service.getTrialStatus('00:11:22:33:44:55');

    // Must be in COOLDOWN, not ELIGIBLE and not ACTIVE trial countdown
    assert.equal(status.status, 'COOLDOWN');
    assert.equal(status.isEligible, false);
    assert.equal(status.inCooldown, true);
    assert.ok(status.remainingHours !== undefined && status.remainingHours >= 22);
  });
});
