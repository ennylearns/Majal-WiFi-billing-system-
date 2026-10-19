import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { RouterOSAPI } from 'node-routeros';
import { MikrotikService, MikrotikCredentials } from './mikrotikService';

describe('MikrotikService - Constructor and Credentials', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      MIKROTIK_HOST: 'env-host.router',
      MIKROTIK_PORT: '9876',
      MIKROTIK_USERNAME: 'env-user',
      MIKROTIK_PASSWORD: 'env-password'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('constructor accepts explicit credentials and ignores environment variables', () => {
    const creds: MikrotikCredentials = {
      host: '10.0.0.99',
      port: 8728,
      username: 'explicit-user',
      password: 'explicit-password'
    };

    const service = new MikrotikService(creds);

    assert.equal(service.host, '10.0.0.99');
    assert.equal(service.port, 8728);
    assert.equal(service.username, 'explicit-user');
    assert.equal(service.password, 'explicit-password');
    assert.equal(service.api.host, '10.0.0.99');
    assert.equal(service.api.port, 8728);
    assert.equal(service.api.user, 'explicit-user');
    assert.equal(service.api.password, 'explicit-password');
  });

  test('constructor parses string port in explicit credentials', () => {
    const service = new MikrotikService({
      host: '10.0.0.50',
      port: '8729' as any,
      username: 'router-admin',
      password: 'secret'
    });

    assert.equal(service.port, 8729);
    assert.equal(service.api.port, 8729);
  });

  test('default constructor falls back to environment variables', () => {
    const service = new MikrotikService();

    assert.equal(service.host, 'env-host.router');
    assert.equal(service.port, 9876);
    assert.equal(service.username, 'env-user');
    assert.equal(service.password, 'env-password');
  });
});

describe('MikrotikService - Public Methods with Mocked RouterOSAPI', () => {
  const stubCreds: MikrotikCredentials = {
    host: '192.168.88.1',
    port: 8728,
    username: 'stub-admin',
    password: 'stub-password'
  };

  let originalConnect: any;
  let originalClose: any;
  let originalWrite: any;

  let connectCalls: number;
  let closeCalls: number;
  let writtenCommands: Array<{ command: string; args?: string[] }>;
  let mockWriteResponses: Record<string, any[]>;

  beforeEach(() => {
    connectCalls = 0;
    closeCalls = 0;
    writtenCommands = [];
    mockWriteResponses = {};

    originalConnect = RouterOSAPI.prototype.connect;
    originalClose = RouterOSAPI.prototype.close;
    originalWrite = RouterOSAPI.prototype.write;

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
      if (mockWriteResponses[command]) {
        return mockWriteResponses[command];
      }
      return [];
    };
  });

  afterEach(() => {
    RouterOSAPI.prototype.connect = originalConnect;
    RouterOSAPI.prototype.close = originalClose;
    RouterOSAPI.prototype.write = originalWrite;
  });

  test('createHotspotUser connects, writes add user command with args, and disconnects', async () => {
    const service = new MikrotikService(stubCreds);

    await service.createHotspotUser('testuser', 'testpass', '1hour-profile');

    assert.equal(connectCalls, 1);
    assert.equal(closeCalls, 1);
    assert.equal(writtenCommands.length, 1);
    assert.equal(writtenCommands[0].command, '/ip/hotspot/user/add');
    assert.deepEqual(writtenCommands[0].args, [
      '=name=testuser',
      '=password=testpass',
      '=profile=1hour-profile',
      '=disabled=no'
    ]);
  });

  test('createHotspotUser uses default profile when none provided', async () => {
    const service = new MikrotikService(stubCreds);

    await service.createHotspotUser('testuser2', 'testpass2');

    assert.equal(connectCalls, 1);
    assert.equal(closeCalls, 1);
    assert.equal(writtenCommands.length, 1);
    assert.deepEqual(writtenCommands[0].args, [
      '=name=testuser2',
      '=password=testpass2',
      '=profile=default',
      '=disabled=no'
    ]);
  });

  test('removeHotspotUser queries user by name and removes when found', async () => {
    mockWriteResponses['/ip/hotspot/user/print'] = [{ '.id': '*A1', name: 'userToRemove' }];

    const service = new MikrotikService(stubCreds);
    await service.removeHotspotUser('userToRemove');

    assert.equal(connectCalls, 1);
    assert.equal(closeCalls, 1);
    assert.equal(writtenCommands.length, 2);
    assert.equal(writtenCommands[0].command, '/ip/hotspot/user/print');
    assert.deepEqual(writtenCommands[0].args, ['?name=userToRemove']);
    assert.equal(writtenCommands[1].command, '/ip/hotspot/user/remove');
    assert.deepEqual(writtenCommands[1].args, ['=.id=*A1']);
  });

  test('removeHotspotUser does not issue remove command if user not found', async () => {
    mockWriteResponses['/ip/hotspot/user/print'] = [];

    const service = new MikrotikService(stubCreds);
    await service.removeHotspotUser('nonExistentUser');

    assert.equal(connectCalls, 1);
    assert.equal(closeCalls, 1);
    assert.equal(writtenCommands.length, 1);
    assert.equal(writtenCommands[0].command, '/ip/hotspot/user/print');
  });

  test('getActiveUsers queries active print and maps sessions accurately', async () => {
    mockWriteResponses['/ip/hotspot/active/print'] = [
      {
        '.id': '*B1',
        user: 'activeUser1',
        address: '192.168.88.10',
        'mac-address': '00:11:22:33:44:55',
        'bytes-in': '1024',
        'bytes-out': '2048',
        uptime: '1h15m'
      },
      {
        '.id': '*B2',
        user: null,
        address: null,
        'mac-address': null,
        'bytes-in': null,
        'bytes-out': null,
        uptime: null
      }
    ];

    const service = new MikrotikService(stubCreds);
    const users = await service.getActiveUsers();

    assert.equal(connectCalls, 1);
    assert.equal(closeCalls, 1);
    assert.equal(writtenCommands.length, 1);
    assert.equal(writtenCommands[0].command, '/ip/hotspot/active/print');

    assert.deepEqual(users, [
      {
        sessionId: '*B1',
        username: 'activeUser1',
        ipAddress: '192.168.88.10',
        macAddress: '00:11:22:33:44:55',
        bytesIn: 1024,
        bytesOut: 2048,
        uptime: '1h15m'
      },
      {
        sessionId: '*B2',
        username: 'unknown',
        ipAddress: '',
        macAddress: '',
        bytesIn: 0,
        bytesOut: 0,
        uptime: '0s'
      }
    ]);
  });

  test('disconnectUser writes remove command for given sessionId', async () => {
    const service = new MikrotikService(stubCreds);
    await service.disconnectUser('*B1');

    assert.equal(connectCalls, 1);
    assert.equal(closeCalls, 1);
    assert.equal(writtenCommands.length, 1);
    assert.equal(writtenCommands[0].command, '/ip/hotspot/active/remove');
    assert.deepEqual(writtenCommands[0].args, ['=.id=*B1']);
  });

  test('createUserProfile writes user profile add command with options', async () => {
    const service = new MikrotikService(stubCreds);
    await service.createUserProfile('GoldPlan', '10M/10M', '7200s');

    assert.equal(connectCalls, 1);
    assert.equal(closeCalls, 1);
    assert.equal(writtenCommands.length, 1);
    assert.equal(writtenCommands[0].command, '/ip/hotspot/user/profile/add');
    assert.deepEqual(writtenCommands[0].args, [
      '=name=GoldPlan',
      '=rate-limit=10M/10M',
      '=session-timeout=7200s',
      '=shared-users=1',
      '=status-autorefresh=1m'
    ]);
  });

  test('updateUserProfile queries user by name and sets profile when found', async () => {
    mockWriteResponses['/ip/hotspot/user/print'] = [{ '.id': '*C1', name: 'userToUpdate' }];

    const service = new MikrotikService(stubCreds);
    await service.updateUserProfile('userToUpdate', 'NewProfile');

    assert.equal(connectCalls, 1);
    assert.equal(closeCalls, 1);
    assert.equal(writtenCommands.length, 2);
    assert.equal(writtenCommands[0].command, '/ip/hotspot/user/print');
    assert.deepEqual(writtenCommands[0].args, ['?name=userToUpdate']);
    assert.equal(writtenCommands[1].command, '/ip/hotspot/user/set');
    assert.deepEqual(writtenCommands[1].args, ['=.id=*C1', '=profile=NewProfile']);
  });

  test('getUserUsage returns parsed usage stats when active session exists', async () => {
    mockWriteResponses['/ip/hotspot/active/print'] = [
      {
        'bytes-in': '5000',
        'bytes-out': '10000',
        uptime: '30m'
      }
    ];

    const service = new MikrotikService(stubCreds);
    const usage = await service.getUserUsage('activeClient');

    assert.equal(connectCalls, 1);
    assert.equal(closeCalls, 1);
    assert.equal(writtenCommands.length, 1);
    assert.equal(writtenCommands[0].command, '/ip/hotspot/active/print');
    assert.deepEqual(writtenCommands[0].args, ['?user=activeClient']);
    assert.deepEqual(usage, {
      bytesIn: 5000,
      bytesOut: 10000,
      uptime: '30m'
    });
  });

  test('getUserUsage returns null when no active session found', async () => {
    mockWriteResponses['/ip/hotspot/active/print'] = [];

    const service = new MikrotikService(stubCreds);
    const usage = await service.getUserUsage('inactiveClient');

    assert.equal(connectCalls, 1);
    assert.equal(closeCalls, 1);
    assert.equal(usage, null);
  });

  test('helper methods format speed limit and session timeout correctly', () => {
    const service = new MikrotikService(stubCreds);
    assert.equal(service.formatSpeedLimit('2M', '5M'), '2M/5M');
    assert.equal(service.formatSessionTimeout(2), '7200s');
    assert.equal(service.formatSessionTimeout(0.5), '1800s');
  });
});
