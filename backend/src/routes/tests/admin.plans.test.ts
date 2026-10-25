import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import adminRoutes from './admin';
import publicRoutes from './public';

const prisma = new PrismaClient();

describe('Plan API with routerId - Integration Tests', () => {
  let server: http.Server;
  let adminBaseUrl: string;
  let publicBaseUrl: string;
  let adminToken: string;
  let adminUserId: string;
  let testRouterId: string;
  let secondRouterId: string;
  const originalEnv = { ...process.env };
  const JWT_SECRET = 'test_jwt_secret_for_plan_tests';

  before(async () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = JWT_SECRET;

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/admin', adminRoutes);
    app.use('/api/public', publicRoutes);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    adminBaseUrl = `http://127.0.0.1:${port}/api/admin`;
    publicBaseUrl = `http://127.0.0.1:${port}/api/public`;

    const adminUser = await prisma.user.create({
      data: {
        phone: `+254700${Math.floor(100000 + Math.random() * 900000)}`,
        role: 'ADMIN',
        isActive: true
      }
    });
    adminUserId = adminUser.id;
    adminToken = jwt.sign({ userId: adminUser.id }, JWT_SECRET);

    const testRouter = await prisma.router.create({
      data: {
        name: 'Test Plan Router',
        location: 'Building Alpha',
        host: '192.168.10.1',
        port: 8728,
        username: 'admin',
        password: 'password123'
      }
    });
    testRouterId = testRouter.id;

    const secondRouter = await prisma.router.create({
      data: {
        name: 'Second Plan Router',
        location: 'Building Beta',
        host: '192.168.10.2',
        port: 8728,
        username: 'admin',
        password: 'password123'
      }
    });
    secondRouterId = secondRouter.id;
  });

  after(async () => {
    process.env = originalEnv;
    await prisma.plan.deleteMany({
      where: { routerId: { in: [testRouterId, secondRouterId] } }
    });
    await prisma.router.deleteMany({
      where: { id: { in: [testRouterId, secondRouterId] } }
    });
    await prisma.user.deleteMany({
      where: { id: adminUserId }
    });
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await prisma.$disconnect();
  });

  // Slice 1: Admin POST /api/admin/plans requires and validates routerId
  test('POST /api/admin/plans rejects request when routerId is missing', async () => {
    const res = await fetch(`${adminBaseUrl}/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'No Router Plan',
        price: 10,
        duration: 1,
        dataLimit: '1GB',
        speedLimit: '5Mbps'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json() as any;
    assert.equal(body.success, false);
  });

  test('POST /api/admin/plans rejects request when routerId does not reference an existing router', async () => {
    const nonExistentRouterId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${adminBaseUrl}/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Invalid Router Plan',
        price: 15,
        duration: 2,
        dataLimit: '2GB',
        speedLimit: '10Mbps',
        routerId: nonExistentRouterId
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json() as any;
    assert.equal(body.success, false);
  });

  test('POST /api/admin/plans creates plan when valid routerId is provided', async () => {
    const res = await fetch(`${adminBaseUrl}/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Valid Router Plan',
        description: 'Test description',
        price: 20,
        duration: 3,
        dataLimit: '3GB',
        speedLimit: '15Mbps',
        routerId: testRouterId
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.equal(body.data.routerId, testRouterId);
    assert.equal(body.data.name, 'Valid Router Plan');

    // Verify persisted in DB
    const persisted = await prisma.plan.findUnique({
      where: { id: body.data.id }
    });
    assert.ok(persisted);
    assert.equal(persisted?.routerId, testRouterId);
  });

  // Slice 2: Admin PUT /api/admin/plans/:id accepts and validates routerId updates
  test('PUT /api/admin/plans/:id rejects routerId update when router does not exist', async () => {
    const plan = await prisma.plan.create({
      data: {
        name: 'Plan For Update Test',
        price: 30,
        duration: 4,
        dataLimit: '4GB',
        speedLimit: '20Mbps',
        routerId: testRouterId
      }
    });

    const res = await fetch(`${adminBaseUrl}/plans/${plan.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        routerId: '00000000-0000-0000-0000-000000000000'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json() as any;
    assert.equal(body.success, false);
  });

  test('PUT /api/admin/plans/:id updates routerId when valid router referenced', async () => {
    const plan = await prisma.plan.create({
      data: {
        name: 'Plan For Reassignment',
        price: 40,
        duration: 5,
        dataLimit: '5GB',
        speedLimit: '25Mbps',
        routerId: testRouterId
      }
    });

    const res = await fetch(`${adminBaseUrl}/plans/${plan.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Plan Reassigned',
        routerId: secondRouterId
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.equal(body.data.routerId, secondRouterId);
    assert.equal(body.data.name, 'Plan Reassigned');

    const updated = await prisma.plan.findUnique({
      where: { id: plan.id }
    });
    assert.equal(updated?.routerId, secondRouterId);
  });

  // Slice 3: Public GET /api/public/plans includes routerId, router name, and router location
  test('GET /api/public/plans response includes routerId, router name, and router location for each plan', async () => {
    const plan = await prisma.plan.create({
      data: {
        name: 'Public Location Plan',
        price: 50,
        duration: 6,
        dataLimit: '6GB',
        speedLimit: '30Mbps',
        routerId: testRouterId,
        isActive: true
      }
    });

    const res = await fetch(`${publicBaseUrl}/plans`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));

    const foundPlan = body.data.find((p: any) => p.id === plan.id);
    assert.ok(foundPlan, 'Expected created plan to be returned');
    assert.equal(foundPlan.routerId, testRouterId);
    assert.ok(foundPlan.router, 'Expected router object on plan');
    assert.equal(foundPlan.router.name, 'Test Plan Router');
    assert.equal(foundPlan.router.location, 'Building Alpha');
  });

  // Slice 4: Admin GET /api/admin/plans response includes router name for each plan
  test('GET /api/admin/plans response includes router name for each plan', async () => {
    const plan = await prisma.plan.create({
      data: {
        name: 'Admin List Plan',
        price: 60,
        duration: 7,
        dataLimit: '7GB',
        speedLimit: '35Mbps',
        routerId: secondRouterId,
        isActive: true
      }
    });

    const res = await fetch(`${adminBaseUrl}/plans`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));

    const foundPlan = body.data.find((p: any) => p.id === plan.id);
    assert.ok(foundPlan, 'Expected created plan to be returned');
    assert.ok(foundPlan.router, 'Expected router object on plan');
    assert.equal(foundPlan.router.name, 'Second Plan Router');
  });
});

