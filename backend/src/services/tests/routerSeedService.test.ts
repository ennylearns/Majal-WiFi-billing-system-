import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { seedDefaultRouter } from './routerSeedService';

describe('routerSeedService - seedDefaultRouter', () => {
  let mockPrisma: any;
  let mockEnv: Record<string, string | undefined>;

  beforeEach(() => {
    mockEnv = {};
    mockPrisma = {
      router: {
        count: async () => 0,
        create: async (args: any) => ({
          id: 'router-uuid-1',
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      },
      plan: {
        updateMany: async (args: any) => ({
          count: 5
        })
      }
    };
  });

  test('skips silently and returns null when MIKROTIK_HOST is absent', async () => {
    let created = false;
    mockPrisma.router.create = async () => {
      created = true;
      return {};
    };

    const result = await seedDefaultRouter(mockPrisma, {});
    assert.equal(result, null);
    assert.equal(created, false);
  });

  test('creates default router from env vars and backfills plans when MIKROTIK_HOST is set and no routers exist', async () => {
    mockEnv = {
      MIKROTIK_HOST: '192.168.88.1',
      MIKROTIK_PORT: '8729',
      MIKROTIK_USERNAME: 'admin_test',
      MIKROTIK_PASSWORD: 'secretpassword'
    };

    let routerCreatedData: any = null;
    mockPrisma.router.create = async (args: any) => {
      routerCreatedData = args.data;
      return { id: 'seeded-router-1', ...args.data };
    };

    let updateManyArgs: any = null;
    mockPrisma.plan.updateMany = async (args: any) => {
      updateManyArgs = args;
      return { count: 3 };
    };

    const result = await seedDefaultRouter(mockPrisma, mockEnv);

    assert.ok(result);
    assert.equal(result.id, 'seeded-router-1');

    // Static fields
    assert.equal(routerCreatedData.name, 'Default Router');
    assert.equal(routerCreatedData.location, 'Main Location');
    assert.equal(routerCreatedData.port, 8729);
    assert.equal(routerCreatedData.username, 'admin_test');
    assert.equal(routerCreatedData.password, 'secretpassword');
    assert.equal(routerCreatedData.isActive, true);

    // WireGuard fields — generated at runtime so we just verify shape
    assert.ok(routerCreatedData.wgPublicKey, 'wgPublicKey should be set');
    assert.ok(routerCreatedData.wgPrivateKey, 'wgPrivateKey should be set');
    assert.ok(routerCreatedData.wgTunnelIp, 'wgTunnelIp should be set');
    // host should be the allocated tunnel IP, not the original MIKROTIK_HOST
    assert.equal(routerCreatedData.host, routerCreatedData.wgTunnelIp, 'host should equal wgTunnelIp');

    assert.deepEqual(updateManyArgs, {
      where: { routerId: null },
      data: { routerId: 'seeded-router-1' }
    });
  });


  test('defaults port to 8728, name to "Default Router", location to "Main Location", and user to "admin" when optional env vars missing', async () => {
    mockEnv = {
      MIKROTIK_HOST: '10.0.0.1'
    };

    let routerCreatedData: any = null;
    mockPrisma.router.create = async (args: any) => {
      routerCreatedData = args.data;
      return { id: 'seeded-router-2', ...args.data };
    };

    const result = await seedDefaultRouter(mockPrisma, mockEnv);

    assert.ok(result);
    assert.equal(routerCreatedData.port, 8728);
    assert.equal(routerCreatedData.username, 'admin');
    assert.equal(routerCreatedData.password, '');
    assert.equal(routerCreatedData.name, 'Default Router');
    assert.equal(routerCreatedData.location, 'Main Location');
    assert.equal(routerCreatedData.isActive, true);
  });

  test('is idempotent: skips router creation when router already exists', async () => {
    mockEnv = {
      MIKROTIK_HOST: '192.168.1.1'
    };

    mockPrisma.router.count = async () => 1;
    let createCalled = false;
    mockPrisma.router.create = async () => {
      createCalled = true;
      return {};
    };

    let updateCalled = false;
    mockPrisma.plan.updateMany = async () => {
      updateCalled = true;
      return { count: 0 };
    };

    const result = await seedDefaultRouter(mockPrisma, mockEnv);

    assert.equal(result, null);
    assert.equal(createCalled, false);
    assert.equal(updateCalled, false);
  });
});
