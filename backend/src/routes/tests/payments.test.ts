import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import crypto from 'crypto';
import { AddressInfo } from 'net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/db';
import paymentsRoutes, { createPaymentsRouter } from '../payments';
import adminRoutes from '../admin';
import { PaymentService } from '../../services/paymentService';
import { BachsGateway } from '../../services/paymentGateway';

describe('Payment History & Admin Payment Queries - Integration Tests', () => {
  let server: http.Server;
  let paymentsBaseUrl: string;
  let adminBaseUrl: string;

  let adminUser: any;
  let adminToken: string;

  let customer1: any;
  let customer1Token: string;

  let customer2: any;
  let customer2Token: string;

  let testRouter: any;
  let plan1: any;
  let plan2: any;

  let payment1Customer1: any;
  let payment2Customer1: any;
  let payment1Customer2: any;
  let baseTime: number;

  const originalEnv = { ...process.env };
  const JWT_SECRET = 'test_jwt_secret_payments_issue_04';

  before(async () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = JWT_SECRET;

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/payments', paymentsRoutes);
    app.use('/api/admin', adminRoutes);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    paymentsBaseUrl = `http://127.0.0.1:${port}/api/payments`;
    adminBaseUrl = `http://127.0.0.1:${port}/api/admin`;

    // Create admin user
    adminUser = await prisma.user.create({
      data: {
        phone: `+254700${Math.floor(100000 + Math.random() * 900000)}`,
        role: 'ADMIN',
        isActive: true,
      },
    });
    adminToken = jwt.sign({ userId: adminUser.id }, JWT_SECRET);

    // Create customer 1
    customer1 = await prisma.user.create({
      data: {
        phone: `+254711${Math.floor(100000 + Math.random() * 900000)}`,
        email: `cust1_${Date.now()}@example.com`,
        firstName: 'Farah',
        lastName: 'Ahmed',
        role: 'CUSTOMER',
        isActive: true,
      },
    });
    customer1Token = jwt.sign({ userId: customer1.id }, JWT_SECRET);

    // Create customer 2
    customer2 = await prisma.user.create({
      data: {
        phone: `+254722${Math.floor(100000 + Math.random() * 900000)}`,
        email: `cust2_${Date.now()}@example.com`,
        firstName: 'Hassan',
        lastName: 'Noor',
        role: 'CUSTOMER',
        isActive: true,
      },
    });
    customer2Token = jwt.sign({ userId: customer2.id }, JWT_SECRET);

    // Create router and plans
    testRouter = await prisma.router.create({
      data: {
        name: 'Payment Test Router',
        location: 'Zone 1',
        host: '192.168.88.10',
        port: 8728,
        username: 'admin',
        password: 'password123',
      },
    });

    plan1 = await prisma.plan.create({
      data: {
        name: 'Speedy Hourly',
        description: '1 hour access',
        price: 50,
        duration: 60,
        dataLimit: '1GB',
        speedLimit: '5Mbps',
        routerId: testRouter.id,
      },
    });

    plan2 = await prisma.plan.create({
      data: {
        name: 'Speedy Daily',
        description: '24 hours access',
        price: 200,
        duration: 1440,
        dataLimit: '10GB',
        speedLimit: '10Mbps',
        routerId: testRouter.id,
      },
    });

    // Create payments with future timestamps so they sort to the top above any legacy test records
    baseTime = Date.now() + 1_000_000;

    // payment1 for customer1: PENDING, earlier date
    payment1Customer1 = await prisma.payment.create({
      data: {
        userId: customer1.id,
        planId: plan1.id,
        amount: 50,
        status: 'PENDING',
        checkoutRequestId: `cr_c1_1_${Date.now()}`,
        paymentReference: `pr_c1_1_${Date.now()}`,
        paymentMethod: 'PAYSTACK',
        createdAt: new Date(baseTime + 10_000),
      },
    });

    // payment1 for customer2: COMPLETED, mid date
    payment1Customer2 = await prisma.payment.create({
      data: {
        userId: customer2.id,
        planId: plan1.id,
        amount: 50,
        status: 'COMPLETED',
        checkoutRequestId: `cr_c2_1_${Date.now()}`,
        paymentReference: `pr_c2_1_${Date.now()}`,
        paymentMethod: 'PAYSTACK',
        createdAt: new Date(baseTime + 20_000),
      },
    });

    // payment2 for customer1: COMPLETED, latest date
    payment2Customer1 = await prisma.payment.create({
      data: {
        userId: customer1.id,
        planId: plan2.id,
        amount: 200,
        status: 'COMPLETED',
        checkoutRequestId: `cr_c1_2_${Date.now()}`,
        paymentReference: `pr_c1_2_${Date.now()}`,
        paymentMethod: 'PAYSTACK',
        createdAt: new Date(baseTime + 30_000),
      },
    });
  });

  after(async () => {
    process.env = originalEnv;
    await prisma.payment.deleteMany({
      where: {
        id: { in: [payment1Customer1.id, payment2Customer1.id, payment1Customer2.id] },
      },
    });
    await prisma.plan.deleteMany({
      where: { id: { in: [plan1.id, plan2.id] } },
    });
    await prisma.router.deleteMany({
      where: { id: testRouter.id },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, customer1.id, customer2.id] } },
    });

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // ---------------------------------------------------------------------------
  // Customer History Endpoints: GET /api/payments
  // ---------------------------------------------------------------------------

  test('GET /api/payments rejects unauthenticated requests with 401', async () => {
    const res = await fetch(paymentsBaseUrl);
    assert.equal(res.status, 401);
  });

  test('GET /api/payments returns user-scoped payments ordered by createdAt desc with plan name and duration', async () => {
    const res = await fetch(paymentsBaseUrl, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));

    // Customer 1 has 2 payments
    assert.equal(body.data.length, 2);
    // Ordered desc: payment2 (March 5) before payment1 (March 1)
    assert.equal(body.data[0].id, payment2Customer1.id);
    assert.equal(body.data[0].plan.name, 'Speedy Daily');
    assert.equal(body.data[0].plan.duration, 1440);

    assert.equal(body.data[1].id, payment1Customer1.id);
    assert.equal(body.data[1].plan.name, 'Speedy Hourly');
    assert.equal(body.data[1].plan.duration, 60);
  });

  test('GET /api/payments enforces user isolation between different accounts', async () => {
    const res1 = await fetch(paymentsBaseUrl, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const body1: any = await res1.json();
    assert.ok(!body1.data.some((p: any) => p.id === payment1Customer2.id));

    const res2 = await fetch(paymentsBaseUrl, {
      headers: { Authorization: `Bearer ${customer2Token}` },
    });
    const body2: any = await res2.json();
    assert.equal(body2.data.length, 1);
    assert.equal(body2.data[0].id, payment1Customer2.id);
  });

  // ---------------------------------------------------------------------------
  // Customer Payment Detail Endpoint: GET /api/payments/:id
  // ---------------------------------------------------------------------------

  test('GET /api/payments/:id rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${paymentsBaseUrl}/${payment1Customer1.id}`);
    assert.equal(res.status, 401);
  });

  test('GET /api/payments/:id returns payment with full plan details when owned by authenticated user', async () => {
    const res = await fetch(`${paymentsBaseUrl}/${payment2Customer1.id}`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, payment2Customer1.id);
    assert.equal(body.data.userId, customer1.id);
    assert.equal(body.data.plan.name, 'Speedy Daily');
    assert.equal(body.data.plan.dataLimit, '10GB');
  });

  test('GET /api/payments/:id returns 404 when payment belongs to a different customer', async () => {
    const res = await fetch(`${paymentsBaseUrl}/${payment1Customer2.id}`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    assert.equal(res.status, 404);
    const body: any = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error, 'Payment not found');
  });

  test('GET /api/payments/:id returns 404 when payment ID does not exist', async () => {
    const res = await fetch(`${paymentsBaseUrl}/non-existent-payment-id`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    assert.equal(res.status, 404);
    const body: any = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error, 'Payment not found');
  });

  // ---------------------------------------------------------------------------
  // Administrative Listing Endpoint: GET /api/admin/payments
  // ---------------------------------------------------------------------------

  test('GET /api/admin/payments rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${adminBaseUrl}/payments`);
    assert.equal(res.status, 401);
  });

  test('GET /api/admin/payments rejects customer accounts with 403', async () => {
    const res = await fetch(`${adminBaseUrl}/payments`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    assert.equal(res.status, 403);
  });

  test('GET /api/admin/payments delegates to service and returns structured paginated response', async () => {
    const res = await fetch(`${adminBaseUrl}/payments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.payments));
    assert.ok(body.data.pagination);
    assert.equal(typeof body.data.pagination.page, 'number');
    assert.equal(typeof body.data.pagination.limit, 'number');
    assert.equal(typeof body.data.pagination.total, 'number');
    assert.equal(typeof body.data.pagination.pages, 'number');

    // Totals object included in response
    assert.ok(body.totals || body.data.totals);
    const totals = body.totals || body.data.totals;
    assert.equal(typeof totals.revenue, 'number');
    assert.equal(typeof totals.count, 'number');
    assert.equal(typeof totals.pending, 'number');
    assert.equal(typeof totals.failed, 'number');
    assert.ok(totals.count >= 3);
  });

  test('GET /api/admin/payments supports pagination with page and limit parameters', async () => {
    const res = await fetch(`${adminBaseUrl}/payments?page=1&limit=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.payments.length, 1);
    assert.equal(body.data.pagination.page, 1);
    assert.equal(body.data.pagination.limit, 1);
    assert.ok(body.data.pagination.total >= 3);
  });

  test('GET /api/admin/payments filters by payment status', async () => {
    const resPending = await fetch(`${adminBaseUrl}/payments?status=PENDING`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resPending.status, 200);
    const bodyPending: any = await resPending.json();
    assert.ok(bodyPending.data.payments.some((p: any) => p.id === payment1Customer1.id));
    assert.ok(!bodyPending.data.payments.some((p: any) => p.id === payment2Customer1.id));

    const resCompleted = await fetch(`${adminBaseUrl}/payments?status=COMPLETED`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resCompleted.status, 200);
    const bodyCompleted: any = await resCompleted.json();
    assert.ok(bodyCompleted.data.payments.some((p: any) => p.id === payment2Customer1.id));
    assert.ok(!bodyCompleted.data.payments.some((p: any) => p.id === payment1Customer1.id));
  });

  test('GET /api/admin/payments filters by date range (startDate & endDate)', async () => {
    const startDate = new Date(baseTime + 25_000).toISOString();
    const endDate = new Date(baseTime + 35_000).toISOString();
    const res = await fetch(
      `${adminBaseUrl}/payments?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.ok(body.data.payments.some((p: any) => p.id === payment2Customer1.id));
    assert.ok(!body.data.payments.some((p: any) => p.id === payment1Customer1.id));
  });

  test('GET /api/admin/payments filters by customer search', async () => {
    // Search customer 1 by firstName 'Farah'
    const resName = await fetch(`${adminBaseUrl}/payments?search=Farah`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resName.status, 200);
    const bodyName: any = await resName.json();
    assert.ok(bodyName.data.payments.length > 0);
    assert.ok(bodyName.data.payments.every((p: any) => p.userId === customer1.id));

    // Search customer 2 by phone substring
    const phoneSub = customer2.phone.slice(-5);
    const resPhone = await fetch(`${adminBaseUrl}/payments?search=${phoneSub}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resPhone.status, 200);
    const bodyPhone: any = await resPhone.json();
    assert.ok(bodyPhone.data.payments.length > 0);
    assert.ok(bodyPhone.data.payments.every((p: any) => p.userId === customer2.id));
  });
});

describe('POST /api/payments/webhook & reserved segments - Integration Tests', () => {
  let server: http.Server;
  let webhookBaseUrl: string;
  let customer: any;
  let customerToken: string;
  let testRouter: any;
  let plan: any;
  const createdPaymentIds: string[] = [];
  const webhookSecret = 'bachs_http_integration_secret';
  const JWT_SECRET = 'test_jwt_secret_webhook_route';
  const originalEnv = { ...process.env };

  let sessionCalls: any[] = [];
  let smsCalls: any[] = [];

  function signBachs(rawBody: string, timestamp: string): string {
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
  }

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = JWT_SECRET;

    const gateway = new BachsGateway({
      apiKey: 'sk_sandbox_http_test',
      webhookSecret,
    });
    const fakeSessionService = {
      async createSession(userId: string, planId: string, sessionToken: string, phone?: string, email?: string) {
        sessionCalls.push({ userId, planId, sessionToken, phone, email });
        return prisma.session.create({
          data: {
            userId,
            planId,
            sessionToken,
            phone,
            email,
            status: 'ACTIVE',
            startTime: new Date(),
            endTime: new Date(Date.now() + 60 * 60 * 1000),
          },
        });
      },
    };
    const fakeSmsService = {
      async sendPaymentConfirmation(phone: string, amount: number, receiptNumber: string) {
        smsCalls.push({ phone, amount, receiptNumber });
        return true;
      },
    };

    const paymentService = new PaymentService(prisma, gateway, fakeSessionService, fakeSmsService);

    const app = express();
    app.use(
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf;
        },
      })
    );
    app.use('/api/payments', createPaymentsRouter(paymentService));

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const port = (server.address() as AddressInfo).port;
    webhookBaseUrl = `http://127.0.0.1:${port}/api/payments`;

    customer = await prisma.user.create({
      data: {
        phone: `+254733${Math.floor(100000 + Math.random() * 900000)}`,
        email: `wh_cust_${Date.now()}@example.com`,
        role: 'CUSTOMER',
        isActive: true,
      },
    });
    customerToken = jwt.sign({ userId: customer.id }, JWT_SECRET);

    testRouter = await prisma.router.create({
      data: {
        name: 'Webhook Test Router',
        location: 'Zone W',
        host: '192.168.88.20',
        port: 8728,
        username: 'admin',
        password: 'password123',
      },
    });

    plan = await prisma.plan.create({
      data: {
        name: 'Webhook Plan',
        description: '1 hour',
        price: 100,
        duration: 60,
        dataLimit: '1GB',
        speedLimit: '5Mbps',
        routerId: testRouter.id,
      },
    });
  });

  after(async () => {
    process.env = originalEnv;
    await prisma.session.deleteMany({ where: { userId: customer.id } });
    if (createdPaymentIds.length > 0) {
      await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    await prisma.plan.deleteMany({ where: { id: plan.id } });
    await prisma.router.deleteMany({ where: { id: testRouter.id } });
    await prisma.user.deleteMany({ where: { id: customer.id } });

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  test('GET /api/payments/webhook hits reserved segment check and returns 400 Invalid payment ID', async () => {
    const res = await fetch(`${webhookBaseUrl}/webhook`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(res.status, 400);
    const body: any = await res.json();
    assert.equal(body.error, 'Invalid payment ID');
  });

  test('POST /api/payments/webhook rejects invalid signature and expired timestamp with 401', async () => {
    const rawBody = JSON.stringify({
      event: 'collection.succeeded',
      data: { checkout_id: 'chk_invalid_sig' },
    });
    const nowTs = String(Math.floor(Date.now() / 1000));

    const invalidRes = await fetch(`${webhookBaseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bachs-Signature': 'bad_signature',
        'X-Bachs-Timestamp': nowTs,
      },
      body: rawBody,
    });
    assert.equal(invalidRes.status, 401);

    const expiredTs = String(Math.floor(Date.now() / 1000) - 400);
    const expiredRes = await fetch(`${webhookBaseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bachs-Signature': signBachs(rawBody, expiredTs),
        'X-Bachs-Timestamp': expiredTs,
      },
      body: rawBody,
    });
    assert.equal(expiredRes.status, 401);
  });

  test('POST /api/payments/webhook fulfills once across dual-fired collection.succeeded and checkout.completed', async () => {
    sessionCalls = [];
    smsCalls = [];

    const payment = await prisma.payment.create({
      data: {
        userId: customer.id,
        planId: plan.id,
        amount: 100,
        status: 'PENDING',
        checkoutRequestId: `chk_http_${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);

    const ts = String(Math.floor(Date.now() / 1000));
    const collectionBody = JSON.stringify({
      event: 'collection.succeeded',
      data: {
        checkout_id: payment.checkoutRequestId,
        metadata: { paymentId: payment.id },
      },
    });

    const res1 = await fetch(`${webhookBaseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bachs-Signature': signBachs(collectionBody, ts),
        'X-Bachs-Timestamp': ts,
      },
      body: collectionBody,
    });
    assert.equal(res1.status, 200);

    const checkoutBody = JSON.stringify({
      event: 'checkout.completed',
      data: {
        checkout_id: payment.checkoutRequestId,
        metadata: { paymentId: payment.id },
      },
    });

    const res2 = await fetch(`${webhookBaseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bachs-Signature-V2': signBachs(checkoutBody, ts),
        'X-Bachs-Timestamp': ts,
      },
      body: checkoutBody,
    });
    assert.equal(res2.status, 200);

    const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
    assert.equal(updated?.status, 'COMPLETED');
    assert.equal(updated?.paymentReference, payment.checkoutRequestId);
    assert.equal(sessionCalls.length, 1);
    assert.equal(smsCalls.length, 1);
  });

  test('end-to-end payment initiation, status polling fallback, and webhook fulfillment work offline in MOCK_SERVICES=true mode', async () => {
    await prisma.session.deleteMany({ where: { userId: customer.id } });
    sessionCalls = [];
    smsCalls = [];
    const prevMock = process.env.MOCK_SERVICES;
    process.env.MOCK_SERVICES = 'true';

    const realFetch = globalThis.fetch;
    globalThis.fetch = ((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.url ?? '';
      if (!url.startsWith('http://127.0.0.1')) {
        throw new Error(`Unexpected external network call in mock mode: ${url}`);
      }
      return realFetch(input, init);
    }) as typeof fetch;

    try {
      const initRes = await fetch(`${webhookBaseUrl}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: customer.phone,
          email: customer.email,
          planId: plan.id,
          amount: plan.price,
        }),
      });
      assert.equal(initRes.status, 200);
      const initJson: any = await initRes.json();
      assert.equal(initJson.success, true);
      assert.ok(initJson.data.reference.startsWith('chk_mock_'));
      assert.equal(initJson.data.access_code, initJson.data.reference);
      assert.ok(initJson.data.authorization_url);

      const createdPayment = await prisma.payment.findFirst({
        where: { checkoutRequestId: initJson.data.reference },
      });
      if (createdPayment) {
        createdPaymentIds.push(createdPayment.id);
      }

      // Polling fallback before 5s fulfillment returns pending without external fetch
      const pollBefore = await fetch(`${webhookBaseUrl}/status/${initJson.data.reference}`);
      assert.equal(pollBefore.status, 200);
      const pollBeforeJson: any = await pollBefore.json();
      assert.equal(pollBeforeJson.data.status, 'pending');

      // Wait for the 5s simulated collection.succeeded webhook callback to complete
      let pollAfterJson: any = null;
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const pollRes = await fetch(`${webhookBaseUrl}/status/${initJson.data.reference}`);
        assert.equal(pollRes.status, 200);
        pollAfterJson = await pollRes.json();
        if (pollAfterJson.data.status === 'completed') {
          break;
        }
      }

      assert.equal(pollAfterJson?.data?.status, 'completed');
      assert.ok(pollAfterJson?.data?.sessionToken);
      assert.equal(sessionCalls.length, 1);
      assert.equal(smsCalls.length, 1);
    } finally {
      globalThis.fetch = realFetch;
      if (prevMock === undefined) {
        delete process.env.MOCK_SERVICES;
      } else {
        process.env.MOCK_SERVICES = prevMock;
      }
    }
  });
});
