import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { RouterOSAPI } from 'node-routeros';
import adminRoutes from './admin';

const prisma = new PrismaClient();

describe('Admin Router Endpoints - Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string;
  let customerToken: string;
  let adminUserId: string;
  let customerUserId: string;
  const originalEnv = { ...process.env };
  const JWT_SECRET = 'test_jwt_secret_for_admin_tests';

  before(async () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = JWT_SECRET;

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/admin', adminRoutes);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}/api/admin`;

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
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, customerUserId] } }
    });
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await prisma.$disconnect();
  });

  // Slice 1: Authentication and GET /api/admin/routers
  test('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/routers`);
    assert.equal(res.status, 401);
  });

  test('rejects non-admin requests with 403', async () => {
    const res = await fetch(`${baseUrl}/routers`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(res.status, 403);
  });

  test('GET /api/admin/routers returns list of all router records', async () => {
    const routerA = await prisma.router.create({
      data: {
        name: 'Test Router 1',
        location: 'Branch A',
        host: '192.168.10.1',
        port: 8728,
        username: 'admin',
        password: 'password'
      }
    });

    try {
      const res = await fetch(`${baseUrl}/routers`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data));
      const found = json.data.find((r: any) => r.id === routerA.id);
      assert.ok(found);
      assert.equal(found.name, 'Test Router 1');
    } finally {
      await prisma.router.delete({ where: { id: routerA.id } });
    }
  });

  // Slice 2: POST /api/admin/routers
  test('POST /api/admin/routers returns 400 when required fields are missing', async () => {
    const res = await fetch(`${baseUrl}/routers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'Incomplete Router' })
    });
    assert.equal(res.status, 400);
    const json = await res.json() as any;
    assert.equal(json.success, false);
    assert.ok(json.errors && json.errors.length > 0);
  });

  test('POST /api/admin/routers creates a router with validated fields and returns 201', async () => {
    const newRouter = {
      name: 'Branch New Router',
      location: 'Downtown Office',
      host: '10.0.1.1',
      port: 8729,
      username: 'mikrotik_admin',
      password: 'supersecretpassword'
    };

    const res = await fetch(`${baseUrl}/routers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(newRouter)
    });

    assert.equal(res.status, 201);
    const json = await res.json() as any;
    assert.equal(json.success, true);
    assert.equal(json.data.name, newRouter.name);
    assert.equal(json.data.location, newRouter.location);
    assert.equal(json.data.host, newRouter.host);
    assert.equal(json.data.port, newRouter.port);
    assert.equal(json.data.username, newRouter.username);
    assert.equal(json.data.password, newRouter.password);
    assert.equal(json.data.isActive, true);
    assert.ok(json.data.id);

    // Clean up
    await prisma.router.delete({ where: { id: json.data.id } });
  });

  // Slice 3: PUT /api/admin/routers/:id
  test('PUT /api/admin/routers/:id returns 404 when router not found', async () => {
    const res = await fetch(`${baseUrl}/routers/non-existent-router-id`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'Updated Name' })
    });

    assert.equal(res.status, 404);
    const json = await res.json() as any;
    assert.equal(json.success, false);
    assert.equal(json.error, 'Router not found');
  });

  test('PUT /api/admin/routers/:id updates any subset of router fields and returns updated record', async () => {
    const router = await prisma.router.create({
      data: {
        name: 'Initial Name',
        location: 'Initial Loc',
        host: '10.10.10.1',
        port: 8728,
        username: 'admin',
        password: 'pass'
      }
    });

    try {
      const updates = {
        name: 'Renamed Router',
        port: 9000,
        isActive: false
      };

      const res = await fetch(`${baseUrl}/routers/${router.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(updates)
      });

      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, true);
      assert.equal(json.data.id, router.id);
      assert.equal(json.data.name, 'Renamed Router');
      assert.equal(json.data.port, 9000);
      assert.equal(json.data.isActive, false);
      assert.equal(json.data.location, 'Initial Loc'); // Unchanged
    } finally {
      await prisma.router.delete({ where: { id: router.id } }).catch(() => {});
    }
  });

  // Slice 4: DELETE /api/admin/routers/:id
  test('DELETE /api/admin/routers/:id returns 404 when router not found', async () => {
    const res = await fetch(`${baseUrl}/routers/non-existent-router-id`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(res.status, 404);
    const json = await res.json() as any;
    assert.equal(json.success, false);
    assert.equal(json.error, 'Router not found');
  });

  test('DELETE /api/admin/routers/:id hard-deletes the router when no active sessions reference it', async () => {
    const router = await prisma.router.create({
      data: {
        name: 'Deletable Router',
        location: 'Branch C',
        host: '10.20.30.1',
        port: 8728,
        username: 'admin',
        password: 'password'
      }
    });

    const res = await fetch(`${baseUrl}/routers/${router.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(res.status, 200);
    const json = await res.json() as any;
    assert.equal(json.success, true);
    assert.equal(json.message, 'Router deleted successfully');

    // Confirm it is deleted from DB
    const found = await prisma.router.findUnique({ where: { id: router.id } });
    assert.equal(found, null);
  });

  test('DELETE /api/admin/routers/:id soft-deletes the router when active sessions reference it', async () => {
    const router = await prisma.router.create({
      data: {
        name: 'Router with Active Session',
        location: 'Branch D',
        host: '10.30.40.1',
        port: 8728,
        username: 'admin',
        password: 'password',
        isActive: true
      }
    });

    // Create a plan and an active session referencing this routerId
    const plan = await prisma.plan.findFirst({ where: { isActive: true } });
    if (!plan) throw new Error('Plan not found for test');

    const session = await prisma.session.create({
      data: {
        userId: customerUserId,
        planId: plan.id,
        routerId: router.id,
        sessionToken: 'test_token_' + Date.now(),
        status: 'ACTIVE'
      }
    });

    try {
      const res = await fetch(`${baseUrl}/routers/${router.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });

      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, true);

      // Confirm router still exists in DB but isActive is false
      const found = await prisma.router.findUnique({ where: { id: router.id } });
      assert.ok(found);
      assert.equal(found.isActive, false);
    } finally {
      await prisma.session.delete({ where: { id: session.id } });
      await prisma.router.delete({ where: { id: router.id } });
    }
  });

  // Slice 5: POST /api/admin/routers/:id/test-connection
  test('POST /api/admin/routers/:id/test-connection returns 404 when router not found', async () => {
    const res = await fetch(`${baseUrl}/routers/non-existent-router-id/test-connection`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(res.status, 404);
    const json = await res.json() as any;
    assert.equal(json.success, false);
    assert.equal(json.error, 'Router not found');
  });

  test('POST /api/admin/routers/:id/test-connection returns { success: true } on successful connection', async () => {
    const router = await prisma.router.create({
      data: {
        name: 'Reachable Router',
        location: 'HQ',
        host: '10.0.0.100',
        port: 8728,
        username: 'admin',
        password: 'password'
      }
    });

    const origConnect = RouterOSAPI.prototype.connect;
    const origClose = RouterOSAPI.prototype.close;
    let connectCalled = false;
    let closeCalled = false;

    (RouterOSAPI.prototype as any).connect = async function () {
      connectCalled = true;
      return this;
    };
    (RouterOSAPI.prototype as any).close = async function () {
      closeCalled = true;
      return this;
    };

    try {
      const res = await fetch(`${baseUrl}/routers/${router.id}/test-connection`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });

      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, true);
      assert.equal(connectCalled, true);
      assert.equal(closeCalled, true);
    } finally {
      RouterOSAPI.prototype.connect = origConnect;
      RouterOSAPI.prototype.close = origClose;
      await prisma.router.delete({ where: { id: router.id } });
    }
  });

  test('POST /api/admin/routers/:id/test-connection returns { success: false, error: ... } on connection failure', async () => {
    const router = await prisma.router.create({
      data: {
        name: 'Unreachable Router',
        location: 'Remote Site',
        host: '10.0.0.200',
        port: 8728,
        username: 'admin',
        password: 'wrongpassword'
      }
    });

    const origConnect = RouterOSAPI.prototype.connect;
    const origClose = RouterOSAPI.prototype.close;

    (RouterOSAPI.prototype as any).connect = async function () {
      throw new Error('Connection refused / timeout');
    };
    (RouterOSAPI.prototype as any).close = async function () {
      return this;
    };

    try {
      const res = await fetch(`${baseUrl}/routers/${router.id}/test-connection`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });

      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, false);
      assert.ok(json.error && json.error.includes('Connection refused'));
    } finally {
      RouterOSAPI.prototype.connect = origConnect;
      RouterOSAPI.prototype.close = origClose;
      await prisma.router.delete({ where: { id: router.id } });
    }
  });
});

