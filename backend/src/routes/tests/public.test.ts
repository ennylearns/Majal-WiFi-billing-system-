import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import publicRoutes from './public';

const prisma = new PrismaClient();

describe('Public Payment Routes - POST /api/public/payment', () => {
  let server: http.Server;
  let baseUrl: string;
  let testPlanId: string;
  const originalEnv = { ...process.env };

  before(async () => {
    process.env.NODE_ENV = 'development';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_secret_key';

    const app = express();
    app.use(express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      }
    }));
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/public', publicRoutes);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}/api/public`;

    const plan = await prisma.plan.findFirst({ where: { isActive: true } });
    if (!plan) {
      throw new Error('No active plan found');
    }
    testPlanId = plan.id;
  });

  after(async () => {
    process.env = originalEnv;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await prisma.$disconnect();
  });

  test('POST /api/public/payment initiates Paystack payment and returns reference in dev mode', async () => {
    const testPhone = `+2547${Math.floor(10000000 + Math.random() * 90000000)}`;

    const res = await fetch(`${baseUrl}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        planId: testPlanId,
        amount: 20
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json() as any;

    // Check that reference and access_code are returned
    const reference = body.reference || body.data?.reference;
    const accessCode = body.access_code || body.data?.access_code;

    assert.ok(reference, 'Expected reference in response');
    assert.ok(accessCode, 'Expected access_code in response');
    assert.match(reference, /^mock_ref_/);

    // Verify payment record in DB
    const payment = await prisma.payment.findFirst({
      where: { checkoutRequestId: reference }
    });

    assert.ok(payment, 'Expected payment record with checkoutRequestId = reference');
    assert.equal(payment.status, 'PENDING');
  });

  test('POST /api/public/payment/paystack/webhook updates payment and creates session on valid charge.success', async () => {
    const crypto = await import('crypto');
    const secret = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_secret_key';
    const testReference = 'ref_webhook_' + Date.now();

    // Create a user and a pending payment
    const user = await prisma.user.create({
      data: {
        phone: `+2547${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: 'CUSTOMER'
      }
    });

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        planId: testPlanId,
        amount: 20,
        status: 'PENDING',
        checkoutRequestId: testReference
      }
    });

    const payload = {
      event: 'charge.success',
      data: {
        reference: testReference,
        status: 'success',
        amount: 2000,
        metadata: {
          planId: testPlanId,
          paymentId: payment.id
        }
      }
    };
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

    const res = await fetch(`${baseUrl}/payment/paystack/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': signature
      },
      body: rawBody
    });

    assert.equal(res.status, 200);

    // Verify payment updated to COMPLETED
    const updatedPayment = await prisma.payment.findUnique({
      where: { id: payment.id }
    });
    assert.equal(updatedPayment?.status, 'COMPLETED');
    assert.equal(updatedPayment?.paymentReference, testReference);

    // Verify session created
    const session = await prisma.session.findFirst({
      where: {
        userId: user.id,
        planId: testPlanId,
        status: 'ACTIVE'
      }
    });
    assert.ok(session, 'Expected active session to be created');
  });

  test('POST /api/public/payment/paystack/webhook always responds 200 OK even on invalid signature', async () => {
    const res = await fetch(`${baseUrl}/payment/paystack/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': 'invalid_signature_hex'
      },
      body: JSON.stringify({ event: 'charge.success', data: { reference: 'unknown' } })
    });

    assert.equal(res.status, 200);
  });

  test('GET /api/public/payment/status/:checkoutRequestId returns pending status for pending payment', async () => {
    const testRef = 'ref_pending_' + Date.now();
    const user = await prisma.user.create({
      data: {
        phone: `+2547${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: 'CUSTOMER'
      }
    });

    await prisma.payment.create({
      data: {
        userId: user.id,
        planId: testPlanId,
        amount: 20,
        status: 'PENDING',
        checkoutRequestId: testRef
      }
    });

    const res = await fetch(`${baseUrl}/payment/status/${testRef}`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;

    assert.equal(body.success, true);
    assert.equal(body.data.status, 'pending');
    assert.equal(body.data.amount, 20);
  });

  test('GET /api/public/payment/status/:checkoutRequestId returns completed status and sessionToken for completed payment with existing session', async () => {
    const testRef = 'ref_completed_' + Date.now();
    const user = await prisma.user.create({
      data: {
        phone: `+2547${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: 'CUSTOMER'
      }
    });

    await prisma.payment.create({
      data: {
        userId: user.id,
        planId: testPlanId,
        amount: 20,
        status: 'COMPLETED',
        checkoutRequestId: testRef,
        paymentReference: testRef
      }
    });

    // Create session (as would be created by webhook)
    const existingSession = await prisma.session.create({
      data: {
        userId: user.id,
        planId: testPlanId,
        sessionToken: 'token_' + Date.now(),
        status: 'ACTIVE'
      }
    });

    const res = await fetch(`${baseUrl}/payment/status/${testRef}`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;

    assert.equal(body.success, true);
    assert.equal(body.data.status, 'completed');
    assert.equal(body.data.sessionToken, existingSession.sessionToken);
  });

  test('GET /api/public/payment/status/:checkoutRequestId returns 404 for unknown reference', async () => {
    const res = await fetch(`${baseUrl}/payment/status/unknown_ref_12345`);
    assert.equal(res.status, 404);
  });

  test('POST /api/public/payment succeeds without phone provided', async () => {
    const res = await fetch(`${baseUrl}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: testPlanId,
        amount: 25
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json() as any;
    const reference = body.reference || body.data?.reference;
    assert.ok(reference);
  });

  test('Full payment-to-connection flow completes in dev mode', async () => {
    const crypto = await import('crypto');
    const secret = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_secret_key';

    // 1. Initiate payment (as portal does when clicking Pay)
    const initRes = await fetch(`${baseUrl}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: testPlanId,
        amount: 50
      })
    });
    assert.equal(initRes.status, 200);
    const initBody = await initRes.json() as any;
    const reference = initBody.reference || initBody.data?.reference;
    const accessCode = initBody.access_code || initBody.data?.access_code;
    assert.ok(reference);
    assert.ok(accessCode);

    // 2. Initial polling returns pending
    const statusPendingRes = await fetch(`${baseUrl}/payment/status/${reference}`);
    assert.equal(statusPendingRes.status, 200);
    const statusPendingBody = await statusPendingRes.json() as any;
    assert.equal(statusPendingBody.data.status, 'pending');

    // 3. Webhook delivers charge.success
    const payment = await prisma.payment.findFirst({ where: { checkoutRequestId: reference } });
    assert.ok(payment);
    const webhookPayload = {
      event: 'charge.success',
      data: {
        reference,
        status: 'success',
        amount: 5000,
        metadata: {
          planId: testPlanId,
          paymentId: payment.id
        }
      }
    };
    const rawBody = JSON.stringify(webhookPayload);
    const signature = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

    const webhookRes = await fetch(`${baseUrl}/payment/paystack/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': signature
      },
      body: rawBody
    });
    assert.equal(webhookRes.status, 200);

    // 4. Polling returns completed and sessionToken
    const statusCompletedRes = await fetch(`${baseUrl}/payment/status/${reference}`);
    assert.equal(statusCompletedRes.status, 200);
    const statusCompletedBody = await statusCompletedRes.json() as any;
    assert.equal(statusCompletedBody.data.status, 'completed');
    const sessionToken = statusCompletedBody.data.sessionToken;
    assert.ok(sessionToken);

    // 5. Connect to internet with sessionToken
    const connectRes = await fetch(`${baseUrl}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken })
    });
    assert.equal(connectRes.status, 200);
    const connectBody = await connectRes.json() as any;
    assert.equal(connectBody.success, true);
    assert.ok(connectBody.data.session.plan);
    assert.ok(connectBody.data.session.endTime);
  });

  test('GET /api/public/routers returns active routers without exposing credentials', async () => {
    // Create an active router and an inactive router
    const activeRouter = await prisma.router.create({
      data: {
        name: 'Public Test Active Router',
        location: 'Downtown Branch',
        host: '192.168.10.1',
        port: 8728,
        username: 'admin_active',
        password: 'secret_password_123',
        isActive: true,
      }
    });

    const inactiveRouter = await prisma.router.create({
      data: {
        name: 'Public Test Inactive Router',
        location: 'Old Branch',
        host: '192.168.10.2',
        port: 8728,
        username: 'admin_inactive',
        password: 'secret_password_456',
        isActive: false,
      }
    });

    const res = await fetch(`${baseUrl}/routers`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));

    const foundActive = body.data.find((r: any) => r.id === activeRouter.id);
    const foundInactive = body.data.find((r: any) => r.id === inactiveRouter.id);

    assert.ok(foundActive, 'Active router should be returned in public routers list');
    assert.equal(foundInactive, undefined, 'Inactive router should NOT be returned');
    assert.equal(foundActive.name, 'Public Test Active Router');
    assert.equal(foundActive.location, 'Downtown Branch');
    assert.equal(foundActive.password, undefined, 'Password must not be exposed');
    assert.equal(foundActive.host, undefined, 'Host must not be exposed');
  });

  test('GET /api/public/plans filters by routerId and router query params', async () => {
    // Create two test routers
    const routerA = await prisma.router.create({
      data: {
        name: 'Router Alpha',
        location: 'North Zone',
        host: '10.0.1.1',
        port: 8728,
        username: 'admin',
        password: 'password',
        isActive: true,
      }
    });

    const routerB = await prisma.router.create({
      data: {
        name: 'Router Beta',
        location: 'South Zone',
        host: '10.0.2.1',
        port: 8728,
        username: 'admin',
        password: 'password',
        isActive: true,
      }
    });

    // Create plan on routerA
    const planA = await prisma.plan.create({
      data: {
        name: 'Plan Alpha Only',
        price: 30,
        duration: 2,
        dataLimit: '2GB',
        speedLimit: '5Mbps',
        isActive: true,
        routerId: routerA.id,
      }
    });

    // Create plan on routerB
    const planB = await prisma.plan.create({
      data: {
        name: 'Plan Beta Only',
        price: 60,
        duration: 5,
        dataLimit: '5GB',
        speedLimit: '10Mbps',
        isActive: true,
        routerId: routerB.id,
      }
    });

    // 1. Fetch with ?routerId=<routerA.id>
    const resId = await fetch(`${baseUrl}/plans?routerId=${routerA.id}`);
    assert.equal(resId.status, 200);
    const bodyId = await resId.json() as any;
    assert.equal(bodyId.success, true);
    assert.ok(bodyId.data.some((p: any) => p.id === planA.id));
    assert.ok(!bodyId.data.some((p: any) => p.id === planB.id));

    // 2. Fetch with ?router=Router Alpha (by name)
    const resName = await fetch(`${baseUrl}/plans?router=${encodeURIComponent('Router Alpha')}`);
    assert.equal(resName.status, 200);
    const bodyName = await resName.json() as any;
    assert.equal(bodyName.success, true);
    assert.ok(bodyName.data.some((p: any) => p.id === planA.id));
    assert.ok(!bodyName.data.some((p: any) => p.id === planB.id));

    // 3. Fetch with ?router=South Zone (by location)
    const resLoc = await fetch(`${baseUrl}/plans?router=${encodeURIComponent('South Zone')}`);
    assert.equal(resLoc.status, 200);
    const bodyLoc = await resLoc.json() as any;
    assert.equal(bodyLoc.success, true);
    assert.ok(bodyLoc.data.some((p: any) => p.id === planB.id));
    assert.ok(!bodyLoc.data.some((p: any) => p.id === planA.id));

    // 4. Fetch with unrecognized router
    const resUnrec = await fetch(`${baseUrl}/plans?router=NonexistentLocation12345`);
    assert.equal(resUnrec.status, 200);
    const bodyUnrec = await resUnrec.json() as any;
    assert.equal(bodyUnrec.success, true);
    assert.equal(bodyUnrec.data.length, 0);
  });
});

