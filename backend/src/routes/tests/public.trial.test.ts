import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import { RouterOSAPI } from 'node-routeros';
import { prisma } from '../../database/db';
import publicRoutes from '../public';
import paymentService from '../../services/paymentService';

describe('Public Trial Routes - /api/public/trial', () => {
  let server: http.Server;
  let baseUrl: string;
  let testRouterId: string;
  let writtenCommands: Array<{ command: string; args?: string[] }>;
  let origConnect: any;
  let origClose: any;
  let origWrite: any;
  const originalEnv = { ...process.env };

  before(async () => {
    process.env.MOCK_SERVICES = 'true';
    // Stub RouterOS API so network calls do not attempt to contact real MikroTik
    writtenCommands = [];
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
      if (command === '/ip/hotspot/user/print') {
        return [{ '.id': '*test-user-id', name: args?.[0]?.replace('?name=', '') || 'user' }];
      }
      return [];
    };

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/public', publicRoutes);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}/api/public/trial`;

    // Ensure a test router exists in the DB
    let router = await prisma.router.findFirst({ where: { isActive: true } });
    if (!router) {
      router = await prisma.router.create({
        data: {
          name: 'Trial Test Router',
          location: 'Test Zone',
          host: '10.250.0.1',
          port: 8728,
          username: 'admin',
          password: 'password',
          isActive: true,
        },
      });
    }
    testRouterId = router.id;
  });

  after(async () => {
    RouterOSAPI.prototype.connect = origConnect;
    RouterOSAPI.prototype.close = origClose;
    RouterOSAPI.prototype.write = origWrite;

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    writtenCommands = [];
  });

  test('POST /api/public/trial/start rejects with 400 when routerId or macAddress missing/invalid', async () => {
    const res1 = await fetch(`${baseUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routerId: testRouterId }),
    });
    assert.equal(res1.status, 400);

    const res2 = await fetch(`${baseUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routerId: testRouterId, macAddress: 'invalid-mac' }),
    });
    assert.equal(res2.status, 400);
  });

  test('POST /api/public/trial/start creates a 10-minute trial session and MikroTik credentials', async () => {
    const uniqueMac = `00:11:22:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}`;

    const res = await fetch(`${baseUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routerId: testRouterId,
        macAddress: uniqueMac,
        ipAddress: '192.168.88.75',
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.ok(body.data?.session?.id);
    assert.ok(body.data?.session?.sessionToken);

    // Verify RouterOS commands
    const profileCmd = writtenCommands.find((c) => c.command === '/ip/hotspot/user/profile/add');
    assert.ok(profileCmd, 'Should add profile on router');
    assert.ok(profileCmd.args?.includes('=name=trial_10m'));
    assert.ok(profileCmd.args?.includes('=rate-limit=2M/1M'));
    assert.ok(profileCmd.args?.includes('=session-timeout=10m'));

    const userCmd = writtenCommands.find((c) => c.command === '/ip/hotspot/user/add');
    assert.ok(userCmd, 'Should add hotspot user on router');
    assert.ok(userCmd.args?.includes('=profile=trial_10m'));

    // Verify DB record
    const saved = await prisma.session.findUnique({
      where: { id: body.data.session.id },
    });
    assert.ok(saved);
    assert.equal(saved?.isTrial, true);
    assert.equal(saved?.macAddress, uniqueMac.toLowerCase());
  });

  test('POST /api/public/trial/start rejects with 429 when MAC is in 24-hour cooldown', async () => {
    const cooldownMac = `00:22:33:44:55:${Math.floor(10 + Math.random() * 89)}`;

    // First trial start succeeds
    const res1 = await fetch(`${baseUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routerId: testRouterId,
        macAddress: cooldownMac,
      }),
    });
    assert.equal(res1.status, 201);

    // Second trial start within 24 hours should be rejected with 429
    const res2 = await fetch(`${baseUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routerId: testRouterId,
        macAddress: cooldownMac,
      }),
    });

    assert.equal(res2.status, 429);
    const body2 = (await res2.json()) as any;
    assert.equal(body2.success, false);
    assert.equal(body2.inCooldown, true);
    assert.ok(typeof body2.remainingHours === 'number');
    assert.ok(typeof body2.remainingMinutes === 'number');
  });

  test('GET /api/public/trial/status returns 400 if macAddress is missing or invalid', async () => {
    const res1 = await fetch(`${baseUrl}/status`);
    assert.equal(res1.status, 400);

    const res2 = await fetch(`${baseUrl}/status?macAddress=not-a-mac`);
    assert.equal(res2.status, 400);
  });

  test('GET /api/public/trial/status reports ELIGIBLE, ACTIVE, or COOLDOWN status accurately', async () => {
    const freshMac = `00:55:66:77:88:${Math.floor(10 + Math.random() * 89)}`;

    // 1. Fresh MAC => ELIGIBLE
    const res1 = await fetch(`${baseUrl}/status?macAddress=${freshMac}`);
    assert.equal(res1.status, 200);
    const body1 = (await res1.json()) as any;
    assert.equal(body1.data?.status, 'ELIGIBLE');
    assert.equal(body1.data?.isEligible, true);

    // 2. Start trial => now ACTIVE
    await fetch(`${baseUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routerId: testRouterId,
        macAddress: freshMac,
      }),
    });

    const res2 = await fetch(`${baseUrl}/status?mac=${freshMac}`);
    assert.equal(res2.status, 200);
    const body2 = (await res2.json()) as any;
    assert.equal(body2.data?.status, 'ACTIVE');
    assert.equal(body2.data?.isEligible, false);
    assert.ok(body2.data?.remainingSeconds > 0);
  });

  test('completing a payment during an active trial upgrades the session and router seamlessly without duplicate sessions', async () => {
    // 1. Ensure a paid plan exists
    let paidPlan = await prisma.plan.findFirst({
      where: { routerId: testRouterId, isActive: true },
    });
    if (!paidPlan) {
      paidPlan = await prisma.plan.create({
        data: {
          name: '1 Hour Fast Pass',
          price: 20,
          duration: 1,
          dataLimit: 'Unlimited',
          speedLimit: '10Mbps',
          isActive: true,
          routerId: testRouterId,
        },
      });
    }

    const clientMac = `00:99:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}`;

    // 2. Start free trial
    const trialRes = await fetch(`${baseUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routerId: testRouterId,
        macAddress: clientMac,
      }),
    });
    assert.equal(trialRes.status, 201);
    const trialBody = (await trialRes.json()) as any;
    const initialSessionToken = trialBody.data.session.sessionToken;
    const initialSessionId = trialBody.data.session.id;

    // Reset writtenCommands to inspect upgrade commands
    writtenCommands = [];

    // 3. Initiate payment specifying clientMac
    const paymentUrl = baseUrl.replace('/trial', '/payment');
    const payInitRes = await fetch(paymentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: paidPlan.id,
        amount: paidPlan.price,
        macAddress: clientMac,
        phone: `+254799${Math.floor(100000 + Math.random() * 899999)}`,
      }),
    });
    assert.equal(payInitRes.status, 200);
    const payInitBody = (await payInitRes.json()) as any;
    const paymentReference = payInitBody.reference;
    assert.ok(paymentReference);

    // 4. Complete / Fulfill payment
    const fulfillResult = await paymentService.fulfillPayment(paymentReference);

    // Assertions:
    // a) Session token remains identical to trial session (no user re-login needed)
    assert.equal(fulfillResult.sessionToken, initialSessionToken);

    // b) Session record in database is upgraded in-place
    const dbSession = await prisma.session.findUnique({
      where: { id: initialSessionId },
    });
    assert.ok(dbSession);
    assert.equal(dbSession?.isTrial, false);
    assert.equal(dbSession?.planId, paidPlan.id);
    assert.equal(dbSession?.status, 'ACTIVE');

    // c) Expiration measured from payment time: ~1 hour from now, not original 10m
    const remainingMs = dbSession!.endTime!.getTime() - Date.now();
    assert.ok(remainingMs > 50 * 60 * 1000, 'Expiration should be ~1 hour in the future');

    // d) Verify MikroTik router profile updated without disconnect
    const userSetCmd = writtenCommands.find((c) => c.command === '/ip/hotspot/user/set');
    assert.ok(userSetCmd, 'Router hotspot user should be updated');
    assert.ok(userSetCmd.args?.includes(`=profile=plan_${paidPlan.id}`));

    const removeCmd = writtenCommands.find((c) => c.command === '/ip/hotspot/user/remove');
    assert.equal(removeCmd, undefined, 'Must not remove hotspot user');

    const activeRemoveCmd = writtenCommands.find((c) => c.command === '/ip/hotspot/active/remove');
    assert.equal(activeRemoveCmd, undefined, 'Must not disconnect active session');

    // e) Verify no duplicate sessions created for this MAC
    const allSessionsForMac = await prisma.session.findMany({
      where: { macAddress: clientMac.toLowerCase() },
    });
    assert.equal(allSessionsForMac.length, 1, 'Only one session should exist for MAC after upgrade');

    // f) Idempotent fulfillment check: fulfilling again returns same session
    const secondFulfill = await paymentService.fulfillPayment(paymentReference);
    assert.equal(secondFulfill.sessionToken, initialSessionToken);
    assert.equal(secondFulfill.alreadyFulfilled, true);
  });
});

