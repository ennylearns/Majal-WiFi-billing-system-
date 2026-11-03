import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { RouterOSAPI } from 'node-routeros';
import { SessionService, sessionCleanup } from '../sessionService';
import { MikrotikService } from '../mikrotikService';
import smsService from '../smsService';

// ---------------------------------------------------------------------------
// RouterOSAPI stubs (same pattern as mikrotikService.test.ts)
// ---------------------------------------------------------------------------

let connectCalls: number;
let closeCalls: number;
let writtenCommands: Array<{ command: string; args?: string[] }>;
let mockWriteResponses: Record<string, any[]>;

let origConnect: any;
let origClose: any;
let origWrite: any;

describe('Per-router MikrotikService credential wiring', () => {
  beforeEach(() => {
    connectCalls = 0;
    closeCalls = 0;
    writtenCommands = [];
    mockWriteResponses = {};

    origConnect = RouterOSAPI.prototype.connect;
    origClose = RouterOSAPI.prototype.close;
    origWrite = RouterOSAPI.prototype.write;

    (RouterOSAPI.prototype as any).connect = async function () {
      connectCalls++;
      return this;
    };
    (RouterOSAPI.prototype as any).close = async function () {
      closeCalls++;
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

  test('MikrotikService built from router record carries correct host/port/username/password', () => {
    const svc = new MikrotikService({ host: '10.0.0.1', port: 8728, username: 'routerAdmin', password: 's3cr3t' });
    assert.equal(svc.host, '10.0.0.1');
    assert.equal(svc.port, 8728);
    assert.equal(svc.username, 'routerAdmin');
    assert.equal(svc.password, 's3cr3t');
  });

  test('MikrotikService port coerced from string', () => {
    const svc = new MikrotikService({ host: '10.0.0.2', port: '9999' as any, username: 'u', password: 'p' });
    assert.equal(svc.port, 9999);
  });

  test('createHotspotUser issued to the correct per-router host', async () => {
    const svc = new MikrotikService({ host: 'router-A', port: 8728, username: 'a', password: 'b' });
    await svc.createHotspotUser('tok-1', 'tok-1', 'plan_abc');

    assert.equal(svc.host, 'router-A');
    assert.equal(connectCalls, 1);
    assert.equal(closeCalls, 1);
    assert.equal(writtenCommands[0].command, '/ip/hotspot/user/add');
    assert.ok(writtenCommands[0].args?.includes('=name=tok-1'));
    assert.ok(writtenCommands[0].args?.includes('=profile=plan_abc'));
  });

  test('removeHotspotUser issued to the correct per-router host', async () => {
    mockWriteResponses['/ip/hotspot/user/print'] = [{ '.id': '*Z9', name: 'tok-2' }];

    const svc = new MikrotikService({ host: 'router-B', port: 8728, username: 'b', password: 'c' });
    await svc.removeHotspotUser('tok-2');

    assert.equal(svc.host, 'router-B');
    assert.equal(writtenCommands.length, 2);
    assert.equal(writtenCommands[0].command, '/ip/hotspot/user/print');
    assert.equal(writtenCommands[1].command, '/ip/hotspot/user/remove');
    assert.deepEqual(writtenCommands[1].args, ['=.id=*Z9']);
  });

  test('createUserProfile writes correct rate-limit arg', async () => {
    const svc = new MikrotikService({ host: 'h', port: 8728, username: 'u', password: 'p' });
    await svc.createUserProfile('plan_xyz', '20M/20M', '3600s');

    assert.equal(writtenCommands[0].command, '/ip/hotspot/user/profile/add');
    const rateArg = writtenCommands[0].args?.find((a) => a.startsWith('=rate-limit='));
    assert.equal(rateArg, '=rate-limit=20M/20M');
  });

  test('two independent MikrotikService instances do not share state', async () => {
    const svcA = new MikrotikService({ host: 'router-A', port: 8728, username: 'a', password: 'p' });
    const svcB = new MikrotikService({ host: 'router-B', port: 9728, username: 'b', password: 'q' });

    assert.notEqual(svcA.host, svcB.host);
    assert.notEqual(svcA.port, svcB.port);
    assert.notEqual(svcA.username, svcB.username);
  });
});

describe('SessionService.parseSpeedLimit (via testable subclass)', () => {
  class TestableSessionService extends SessionService {
    public parseSpeed(s: string) {
      // @ts-expect-error – accessing private member for unit testing
      return this.parseSpeedLimit(s);
    }
  }

  const svc = new TestableSessionService();

  test('converts Mbps string to MikroTik rate-limit format', () => {
    assert.equal(svc.parseSpeed('10Mbps'), '10M/10M');
    assert.equal(svc.parseSpeed('5Mbps'), '5M/5M');
  });

  test('converts Gbps string to G-unit format', () => {
    assert.equal(svc.parseSpeed('1Gbps'), '1G/1G');
  });

  test('handles numeric-only string (defaults to M unit)', () => {
    assert.equal(svc.parseSpeed('25'), '25M/25M');
  });
});

describe('SessionService - custom Prisma client injection', () => {
  test('uses injected prisma client for getUserActiveSessions', async () => {
    const mockSessions = [{ id: 'sess-1', userId: 'user-1', status: 'ACTIVE' }];
    let capturedArgs: any;

    const mockPrisma = {
      session: {
        findMany: async (args: any) => {
          capturedArgs = args;
          return mockSessions;
        },
      },
    } as any;

    const svc = new SessionService(mockPrisma);
    const result = await svc.getUserActiveSessions('user-1');

    assert.deepEqual(result, mockSessions);
    assert.equal(capturedArgs?.where?.userId, 'user-1');
    assert.equal(capturedArgs?.where?.status, 'ACTIVE');
  });

  test('uses injected prisma client for updateSessionUsage', async () => {
    let updatedArgs: any;

    const mockPrisma = {
      session: {
        update: async (args: any) => {
          updatedArgs = args;
          return {};
        },
      },
    } as any;

    const svc = new SessionService(mockPrisma);
    await svc.updateSessionUsage('tok-abc', 1024);

    assert.equal(updatedArgs?.where?.sessionToken, 'tok-abc');
    assert.equal(updatedArgs?.data?.dataUsed, 1024);
  });

  test('two instances with different prisma clients operate independently', async () => {
    const callsA: string[] = [];
    const callsB: string[] = [];

    const prismaA = { session: { findMany: async () => { callsA.push('A'); return []; } } } as any;
    const prismaB = { session: { findMany: async () => { callsB.push('B'); return []; } } } as any;

    const svcA = new SessionService(prismaA);
    const svcB = new SessionService(prismaB);

    await svcA.getUserActiveSessions('u1');
    await svcB.getUserActiveSessions('u2');

    assert.deepEqual(callsA, ['A']);
    assert.deepEqual(callsB, ['B']);
  });
});

describe('SessionService.terminateSession - MikroTik timeout & resilience', () => {
  test('terminates DB session and does not throw when MikroTik router times out', async () => {
    let updatedStatus: string | null = null;
    const mockPrisma = {
      session: {
        findUnique: async () => ({
          id: 'sess-timeout',
          sessionToken: 'token-timeout',
          routerId: 'router-offline',
          plan: null,
        }),
        update: async ({ data }: any) => {
          updatedStatus = data.status;
          return {};
        },
      },
      router: {
        findUnique: async () => ({
          id: 'router-offline',
          host: '10.250.0.99',
          port: 8728,
          username: 'admin',
          password: 'pw',
        }),
      },
    } as any;

    const mockMikrotikFactory = () => ({
      removeHotspotUser: async () => {
        const timeoutErr = new Error('RosException: Timed out after 10 seconds');
        (timeoutErr as any).errno = 'SOCKTMOUT';
        throw timeoutErr;
      },
    } as any);

    const svc = new SessionService(mockPrisma, mockMikrotikFactory);
    // Should NOT throw
    await svc.terminateSession('sess-timeout');
    assert.equal(updatedStatus, 'TERMINATED');
  });

  test('terminates DB session when router record is missing', async () => {
    let updatedStatus: string | null = null;
    const mockPrisma = {
      session: {
        findUnique: async () => ({
          id: 'sess-no-router',
          sessionToken: 'token-no-router',
          routerId: null,
          plan: null,
        }),
        update: async ({ data }: any) => {
          updatedStatus = data.status;
          return {};
        },
      },
    } as any;

    const svc = new SessionService(mockPrisma);
    await svc.terminateSession('sess-no-router');
    assert.equal(updatedStatus, 'TERMINATED');
  });

  test('throws when session does not exist in DB', async () => {
    const mockPrisma = {
      session: {
        findUnique: async () => null,
      },
    } as any;

    const svc = new SessionService(mockPrisma);
    await assert.rejects(
      async () => svc.terminateSession('nonexistent-id'),
      /Session not found/
    );
  });
});

describe('sessionCleanup - batch resilience', () => {
  test('continues processing remaining sessions even if one termination fails', async () => {
    const terminatedSessionIds: string[] = [];
    const smsSentToPhones: string[] = [];

    const mockPrisma = {
      session: {
        findMany: async () => [
          { id: 'sess-fail', userId: 'user-1' },
          { id: 'sess-ok', userId: 'user-2' },
        ],
      },
      user: {
        findUnique: async ({ where }: any) => {
          if (where.id === 'user-1') return { id: 'user-1', phone: '+254700000001' };
          if (where.id === 'user-2') return { id: 'user-2', phone: '+254700000002' };
          return null;
        },
      },
    } as any;

    const mockSessionService = {
      terminateSession: async (id: string) => {
        if (id === 'sess-fail') {
          throw new Error('Database locked / unexpected failure');
        }
        terminatedSessionIds.push(id);
      },
    } as any;

    const origSendSMS = smsService.sendSMS;
    smsService.sendSMS = async (phone: string) => {
      smsSentToPhones.push(phone);
      return true;
    };

    try {
      await sessionCleanup(mockSessionService, mockPrisma);

      // sess-ok should have been processed despite sess-fail erroring
      assert.deepEqual(terminatedSessionIds, ['sess-ok']);
      assert.deepEqual(smsSentToPhones, ['+254700000002']);
    } finally {
      smsService.sendSMS = origSendSMS;
    }
  });
});
