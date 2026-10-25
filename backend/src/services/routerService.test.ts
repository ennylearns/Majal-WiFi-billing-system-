import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RouterService, CreateRouterInput, UpdateRouterInput, DeleteRouterResult } from './routerService';
import { WireguardService } from './wireguardService';

describe('RouterService - Foundation, CRUD and Rollback', () => {
  let mockPrisma: any;
  let mockWireguard: any;
  let service: RouterService;

  beforeEach(() => {
    mockPrisma = {
      router: {
        findMany: async () => [],
        findUnique: async () => null,
        create: async () => ({}),
        update: async () => ({}),
        delete: async () => ({}),
      },
      session: {
        count: async () => 0,
      },
    };

    mockWireguard = {
      generateKeyPair: () => ({
        publicKey: 'mockPubKeyBase64=',
        privateKey: 'mockPrivKeyBase64=',
      }),
      allocateTunnelIp: () => '10.8.0.2',
      addPeer: async () => {},
      removePeer: async () => {},
    };

    service = new RouterService(mockPrisma, mockWireguard);
  });

  test('constructor defaults to standard singletons when dependencies omitted', () => {
    const defaultService = new RouterService();
    assert.ok(defaultService);
    assert.ok((defaultService as any).prisma);
    assert.ok((defaultService as any).wireguard);
  });

  test('listRouters returns routers sorted by createdAt descending', async () => {
    const mockRouters = [
      { id: 'r1', name: 'Router 1', createdAt: new Date() },
      { id: 'r2', name: 'Router 2', createdAt: new Date() },
    ];
    let queryArgs: any;
    mockPrisma.router.findMany = async (args: any) => {
      queryArgs = args;
      return mockRouters;
    };

    const result = await service.listRouters();
    assert.deepEqual(result, mockRouters);
    assert.deepEqual(queryArgs, { orderBy: { createdAt: 'desc' } });
  });

  test('getRouterById returns router if found', async () => {
    const mockRouter = { id: 'r1', name: 'Router 1' };
    mockPrisma.router.findUnique = async ({ where }: any) => {
      if (where.id === 'r1') return mockRouter;
      return null;
    };

    const found = await service.getRouterById('r1');
    assert.deepEqual(found, mockRouter);

    const notFound = await service.getRouterById('non-existent');
    assert.equal(notFound, null);
  });

  test('createRouter generates credentials, keypair, allocates tunnel IP, creates DB record and registers peer', async () => {
    let peerAdded: { publicKey: string; tunnelIp: string } | null = null;
    mockWireguard.addPeer = async (pubKey: string, ip: string) => {
      peerAdded = { publicKey: pubKey, tunnelIp: ip };
    };

    let createdData: any;
    mockPrisma.router.findMany = async () => [{ wgTunnelIp: '10.8.0.1' }];
    mockPrisma.router.create = async ({ data }: any) => {
      createdData = data;
      return { id: 'new-router-id', ...data };
    };

    const router = await service.createRouter({
      name: 'Branch Gateway',
      location: 'Nairobi HQ',
    });

    assert.equal(router.id, 'new-router-id');
    assert.equal(createdData.name, 'Branch Gateway');
    assert.equal(createdData.location, 'Nairobi HQ');
    assert.equal(createdData.host, '10.8.0.2');
    assert.equal(createdData.port, 8728);
    assert.ok(createdData.username.startsWith('router_'), 'username should have router_ prefix');
    assert.ok(createdData.password.length >= 16, 'password should be auto-generated');
    assert.equal(createdData.wgPublicKey, 'mockPubKeyBase64=');
    assert.equal(createdData.wgPrivateKey, 'mockPrivKeyBase64=');
    assert.equal(createdData.wgTunnelIp, '10.8.0.2');

    assert.deepEqual(peerAdded, {
      publicKey: 'mockPubKeyBase64=',
      tunnelIp: '10.8.0.2',
    });
  });

  test('createRouter respects custom port, username, password and host when provided', async () => {
    let createdData: any;
    mockPrisma.router.findMany = async () => [];
    mockPrisma.router.create = async ({ data }: any) => {
      createdData = data;
      return { id: 'r2', ...data };
    };

    const router = await service.createRouter({
      name: 'Custom Router',
      location: 'Site B',
      port: 9999,
      username: 'custom_user',
      password: 'custom_password',
      host: '192.168.1.100',
    });

    assert.equal(createdData.port, 9999);
    assert.equal(createdData.username, 'custom_user');
    assert.equal(createdData.password, 'custom_password');
    assert.equal(createdData.host, '192.168.1.100');
  });

  test('updateRouter throws Error if router not found', async () => {
    mockPrisma.router.findUnique = async () => null;

    await assert.rejects(
      async () => {
        await service.updateRouter('missing-id', { name: 'New Name' });
      },
      { message: 'Router not found' }
    );
  });

  test('updateRouter updates router fields and returns updated record', async () => {
    mockPrisma.router.findUnique = async () => ({
      id: 'r1',
      name: 'Old Name',
      location: 'Old Loc',
    });

    let updateArgs: any;
    mockPrisma.router.update = async (args: any) => {
      updateArgs = args;
      return { id: 'r1', ...args.data };
    };

    const updated = await service.updateRouter('r1', {
      name: 'New Name',
      location: 'New Loc',
      port: 8729,
      isActive: false,
    });

    assert.equal(updated.name, 'New Name');
    assert.equal(updated.location, 'New Loc');
    assert.equal(updated.port, 8729);
    assert.equal(updated.isActive, false);
    assert.equal(updateArgs.where.id, 'r1');
  });

  test('createRouter rolls back database record when WireGuard peer registration fails', async () => {
    let deletedId: string | null = null;
    mockPrisma.router.findMany = async () => [];
    mockPrisma.router.create = async ({ data }: any) => {
      return { id: 'created-router-123', ...data };
    };
    mockPrisma.router.delete = async ({ where }: any) => {
      deletedId = where.id;
      return { id: where.id };
    };

    mockWireguard.addPeer = async () => {
      throw new Error('WireGuard interface error: wg set failed');
    };

    await assert.rejects(
      async () => {
        await service.createRouter({
          name: 'Rollback Router',
          location: 'Remote Site',
        });
      },
      { message: 'WireGuard interface error: wg set failed' }
    );

    assert.equal(
      deletedId,
      'created-router-123',
      'Should delete created router record on failure'
    );
  });

  // ── deleteRouter ─────────────────────────────────────────────────────────────

  test('deleteRouter throws descriptive error when router does not exist', async () => {
    mockPrisma.router.findUnique = async () => null;

    await assert.rejects(
      async () => {
        await service.deleteRouter('ghost-id');
      },
      { message: 'Router not found: ghost-id' }
    );
  });

  test('deleteRouter deactivates router and returns outcome deactivated when active sessions exist', async () => {
    const existingRouter = {
      id: 'r-active',
      wgPublicKey: 'somePubKey=',
      isActive: true,
    };
    mockPrisma.router.findUnique = async () => existingRouter;
    mockPrisma.session.count = async () => 2;

    let updatedData: any;
    const deactivatedRouter = { ...existingRouter, isActive: false };
    mockPrisma.router.update = async ({ data }: any) => {
      updatedData = data;
      return deactivatedRouter;
    };

    let removePeerCalled = false;
    mockWireguard.removePeer = async () => { removePeerCalled = true; };

    const result = await service.deleteRouter('r-active') as Extract<DeleteRouterResult, { outcome: 'deactivated' }>;

    assert.equal(result.outcome, 'deactivated');
    assert.deepEqual(result.router, deactivatedRouter);
    assert.equal(updatedData.isActive, false, 'router should be set inactive');
    assert.equal(removePeerCalled, false, 'WireGuard peer must NOT be removed on deactivation');
  });

  test('deleteRouter hard-deletes router and unregisters WireGuard peer when no active sessions exist', async () => {
    const existingRouter = {
      id: 'r-idle',
      wgPublicKey: 'idlePubKey=',
      isActive: true,
    };
    mockPrisma.router.findUnique = async () => existingRouter;
    mockPrisma.session.count = async () => 0;

    let deletedId: string | null = null;
    mockPrisma.router.delete = async ({ where }: any) => {
      deletedId = where.id;
      return { id: where.id };
    };

    let removedKey: string | null = null;
    mockWireguard.removePeer = async (key: string) => { removedKey = key; };

    const result = await service.deleteRouter('r-idle');

    assert.equal(result.outcome, 'deleted');
    assert.equal(deletedId, 'r-idle', 'DB record should be hard-deleted');
    assert.equal(removedKey, 'idlePubKey=', 'WireGuard peer should be unregistered');
  });

  test('deleteRouter hard-deletes router without calling removePeer when wgPublicKey is absent', async () => {
    const existingRouter = { id: 'r-no-wg', wgPublicKey: null, isActive: true };
    mockPrisma.router.findUnique = async () => existingRouter;
    mockPrisma.session.count = async () => 0;

    let deletedId: string | null = null;
    mockPrisma.router.delete = async ({ where }: any) => {
      deletedId = where.id;
      return { id: where.id };
    };

    let removePeerCalled = false;
    mockWireguard.removePeer = async () => { removePeerCalled = true; };

    const result = await service.deleteRouter('r-no-wg');

    assert.equal(result.outcome, 'deleted');
    assert.equal(deletedId, 'r-no-wg');
    assert.equal(removePeerCalled, false, 'removePeer must not be called when no public key');
  });
});

