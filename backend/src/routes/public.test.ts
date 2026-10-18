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

  test('POST /api/public/payment/mpesa/callback route is removed and returns 404', async () => {
    const res = await fetch(`${baseUrl}/payment/mpesa/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    assert.equal(res.status, 404);
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
});
