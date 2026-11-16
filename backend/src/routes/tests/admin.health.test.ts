import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/db';
import adminRoutes from '../admin';
import healthService from '../../services/healthService';

describe('Admin Health Endpoint (GET /api/admin/health)', () => {
  let server: http.Server;
  let adminBaseUrl: string;
  let adminToken: string;
  let customerToken: string;
  let adminUserId: string;
  let customerUserId: string;
  const originalEnv = { ...process.env };
  const JWT_SECRET = 'test_jwt_secret_for_health_tests';

  before(async () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_paystack_key';

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/admin', adminRoutes);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    adminBaseUrl = `http://127.0.0.1:${port}/api/admin`;

    const adminUser = await prisma.user.create({
      data: {
        phone: `+254700${Math.floor(100000 + Math.random() * 900000)}`,
        role: 'ADMIN',
        isActive: true
      }
    });
    adminUserId = adminUser.id;
    adminToken = jwt.sign({ userId: adminUser.id }, JWT_SECRET);

    const customerUser = await prisma.user.create({
      data: {
        phone: `+254711${Math.floor(100000 + Math.random() * 900000)}`,
        role: 'CUSTOMER',
        isActive: true
      }
    });
    customerUserId = customerUser.id;
    customerToken = jwt.sign({ userId: customerUser.id }, JWT_SECRET);
  });

  after(async () => {
    process.env = originalEnv;
    healthService.setPrisma(prisma);
    healthService.setExecFn(async (cmd: string) => ({ stdout: '', stderr: '' }));

    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, customerUserId] } }
    });
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_paystack_key';
    // Stub wireguard exec to succeed by default in tests
    healthService.setExecFn(async (cmd: string) => {
      if (cmd === 'wg show') return { stdout: 'interface: wg0', stderr: '' };
      throw new Error(`Unexpected command: ${cmd}`);
    });
  });

  afterEach(() => {
    healthService.setPrisma(prisma);
  });

  test('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${adminBaseUrl}/health`);
    assert.equal(res.status, 401);
  });

  test('rejects non-admin users with 403', async () => {
    const res = await fetch(`${adminBaseUrl}/health`, {
      headers: {
        Authorization: `Bearer ${customerToken}`
      }
    });
    assert.equal(res.status, 403);
  });

  test('returns standard health object structure with admin auth', async () => {
    const res = await fetch(`${adminBaseUrl}/health`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;

    assert.ok(body.postgres, 'postgres property must be present');
    assert.ok(body.paystack, 'paystack property must be present');
    assert.ok(body.wireguard, 'wireguard property must be present');

    assert.equal(typeof body.postgres.status, 'string');
    assert.equal(typeof body.paystack.status, 'string');
    assert.equal(typeof body.wireguard.status, 'string');
  });

  test('returns postgres.status = ok when Prisma is reachable using in-memory stub pattern', async () => {
    const inMemoryPrismaStub = {
      $queryRaw: async () => [{ 1: 1 }]
    };
    healthService.setPrisma(inMemoryPrismaStub);

    const res = await fetch(`${adminBaseUrl}/health`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.postgres.status, 'ok');
    assert.equal(body.postgres.message, 'Connected');
  });

  test('returns postgres.status = error when Prisma throws', async () => {
    const inMemoryPrismaStub = {
      $queryRaw: async () => {
        throw new Error('Connection refused by postgres:5432');
      }
    };
    healthService.setPrisma(inMemoryPrismaStub);

    const res = await fetch(`${adminBaseUrl}/health`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.postgres.status, 'error');
    assert.equal(body.postgres.message, 'Connection refused by postgres:5432');
  });

  test('returns paystack.status = ok when PAYSTACK_SECRET_KEY is set', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_dummy_secret';

    const res = await fetch(`${adminBaseUrl}/health`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.paystack.status, 'ok');
    assert.equal(body.paystack.message, 'Configured');
  });

  test('returns paystack.status = error when PAYSTACK_SECRET_KEY is unset', async () => {
    delete process.env.PAYSTACK_SECRET_KEY;

    const res = await fetch(`${adminBaseUrl}/health`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.paystack.status, 'error');
    assert.equal(body.paystack.message, 'PAYSTACK_SECRET_KEY is not set');
  });

  test('returns wireguard.status = ok on exit code 0 of wg show', async () => {
    healthService.setExecFn(async () => ({
      stdout: 'interface: wg0\n  public key: key\n',
      stderr: ''
    }));

    const res = await fetch(`${adminBaseUrl}/health`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.wireguard.status, 'ok');
    assert.equal(body.wireguard.message, 'Interface active');
  });

  test('returns wireguard.status = error when wg show fails or exits non-zero', async () => {
    healthService.setExecFn(async () => {
      const err = new Error('wg: command not found') as any;
      err.code = 127;
      throw err;
    });

    const res = await fetch(`${adminBaseUrl}/health`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.wireguard.status, 'error');
    assert.ok(body.wireguard.message?.includes('command not found'));
  });
});
