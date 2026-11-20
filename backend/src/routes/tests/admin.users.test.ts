import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/db';
import adminRoutes from '../admin';

describe('Admin User Action Endpoints - Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string;
  let customerToken: string;
  let adminUserId: string;
  let customerUserId: string;
  let targetUserId: string;
  const originalEnv = { ...process.env };
  const JWT_SECRET = 'test_jwt_secret_for_user_tests';

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
        isActive: true,
      },
    });
    adminUserId = adminUser.id;
    adminToken = jwt.sign({ userId: adminUser.id }, JWT_SECRET);

    const customerUser = await prisma.user.create({
      data: {
        phone: `+254711${Math.floor(100000 + Math.random() * 900000)}`,
        role: 'CUSTOMER',
        isActive: true,
      },
    });
    customerUserId = customerUser.id;
    customerToken = jwt.sign({ userId: customerUser.id }, JWT_SECRET);

    const targetUser = await prisma.user.create({
      data: {
        phone: `+254722${Math.floor(100000 + Math.random() * 900000)}`,
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'CUSTOMER',
        isActive: true,
      },
    });
    targetUserId = targetUser.id;
  });

  after(async () => {
    process.env = originalEnv;
    await prisma.session.deleteMany({
      where: { userId: { in: [targetUserId, customerUserId, adminUserId] } },
    });
    await prisma.payment.deleteMany({
      where: { userId: { in: [targetUserId, customerUserId, adminUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [targetUserId, customerUserId, adminUserId] } },
    });
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await prisma.$disconnect();
  });

  // Auth protection tests
  test('all four user action endpoints reject unauthenticated requests with 401', async () => {
    const endpoints = [
      { url: `${baseUrl}/users/${targetUserId}/sessions`, method: 'GET' },
      { url: `${baseUrl}/users/${targetUserId}/terminate-sessions`, method: 'POST' },
      { url: `${baseUrl}/users/${targetUserId}/toggle-active`, method: 'POST' },
      { url: `${baseUrl}/users/${targetUserId}/mac-bindings`, method: 'GET' },
    ];

    for (const ep of endpoints) {
      const res = await fetch(ep.url, { method: ep.method });
      assert.equal(res.status, 401, `Expected 401 for ${ep.method} ${ep.url}`);
    }
  });

  test('all four user action endpoints reject non-admin requests with 403', async () => {
    const endpoints = [
      { url: `${baseUrl}/users/${targetUserId}/sessions`, method: 'GET' },
      { url: `${baseUrl}/users/${targetUserId}/terminate-sessions`, method: 'POST' },
      { url: `${baseUrl}/users/${targetUserId}/toggle-active`, method: 'POST' },
      { url: `${baseUrl}/users/${targetUserId}/mac-bindings`, method: 'GET' },
    ];

    for (const ep of endpoints) {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      assert.equal(res.status, 403, `Expected 403 for ${ep.method} ${ep.url}`);
    }
  });

  // Terminate active sessions test
  test('POST /api/admin/users/:id/terminate-sessions sets all ACTIVE sessions to TERMINATED and returns count', async () => {
    // Create 2 active sessions and 1 already expired/terminated session
    await prisma.session.create({
      data: {
        userId: targetUserId,
        sessionToken: `token_active_1_${Date.now()}`,
        status: 'ACTIVE',
        macAddress: 'aa:bb:cc:dd:ee:01',
      },
    });
    await prisma.session.create({
      data: {
        userId: targetUserId,
        sessionToken: `token_active_2_${Date.now()}`,
        status: 'ACTIVE',
        macAddress: 'aa:bb:cc:dd:ee:02',
      },
    });
    await prisma.session.create({
      data: {
        userId: targetUserId,
        sessionToken: `token_expired_${Date.now()}`,
        status: 'EXPIRED',
        macAddress: 'aa:bb:cc:dd:ee:03',
      },
    });

    const res = await fetch(`${baseUrl}/users/${targetUserId}/terminate-sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.terminatedCount, 2);

    // Verify DB state: all sessions for targetUser must now be non-ACTIVE
    const activeRemaining = await prisma.session.count({
      where: { userId: targetUserId, status: 'ACTIVE' },
    });
    assert.equal(activeRemaining, 0);

    const terminatedCount = await prisma.session.count({
      where: { userId: targetUserId, status: 'TERMINATED' },
    });
    assert.equal(terminatedCount, 2);
  });

  // Toggle active/inactive test
  test('POST /api/admin/users/:id/toggle-active flips isActive from true to false and vice versa', async () => {
    // Current isActive is true
    const res1 = await fetch(`${baseUrl}/users/${targetUserId}/toggle-active`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res1.status, 200);
    const body1 = (await res1.json()) as any;
    assert.equal(body1.success, true);
    assert.equal(body1.isActive, false);

    const userInDb1 = await prisma.user.findUnique({ where: { id: targetUserId } });
    assert.equal(userInDb1?.isActive, false);

    // Flip again: false to true
    const res2 = await fetch(`${baseUrl}/users/${targetUserId}/toggle-active`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res2.status, 200);
    const body2 = (await res2.json()) as any;
    assert.equal(body2.success, true);
    assert.equal(body2.isActive, true);

    const userInDb2 = await prisma.user.findUnique({ where: { id: targetUserId } });
    assert.equal(userInDb2?.isActive, true);
  });

  // View session history test
  test('GET /api/admin/users/:id/sessions returns session history with plan name, start time, status, duration', async () => {
    const plan = await prisma.plan.create({
      data: {
        name: 'Super 1hr Plan',
        price: 50,
        duration: 1,
        dataLimit: '1GB',
        speedLimit: '5Mbps',
      },
    });

    await prisma.session.create({
      data: {
        userId: targetUserId,
        planId: plan.id,
        sessionToken: `token_hist_${Date.now()}`,
        status: 'TERMINATED',
        startTime: new Date('2026-01-01T10:00:00Z'),
        endTime: new Date('2026-01-01T11:00:00Z'),
      },
    });

    const res = await fetch(`${baseUrl}/users/${targetUserId}/sessions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
    const foundSession = body.data.find((s: any) => s.plan?.name === 'Super 1hr Plan');
    assert.ok(foundSession);
    assert.equal(foundSession.status, 'TERMINATED');
    assert.equal(foundSession.plan.name, 'Super 1hr Plan');
    assert.equal(foundSession.plan.duration, 1);
  });

  // View MAC bindings test
  test('GET /api/admin/users/:id/mac-bindings returns all MAC addresses associated with user', async () => {
    const res = await fetch(`${baseUrl}/users/${targetUserId}/mac-bindings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    // In previous test we created sessions with 'aa:bb:cc:dd:ee:01', 'aa:bb:cc:dd:ee:02', 'aa:bb:cc:dd:ee:03'
    const macs = body.data.map((item: any) => (typeof item === 'string' ? item : item.macAddress));
    assert.ok(macs.includes('aa:bb:cc:dd:ee:01'));
    assert.ok(macs.includes('aa:bb:cc:dd:ee:02'));
    assert.ok(macs.includes('aa:bb:cc:dd:ee:03'));
  });
});
