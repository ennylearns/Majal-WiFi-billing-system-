import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentService } from '../paymentService';
import { FakePaymentGateway } from '../paymentGateway';

// ---------------------------------------------------------------------------
// In-memory Prisma stub
// ---------------------------------------------------------------------------

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

interface FakeUser {
  id: string;
  phone: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakePlan {
  id: string;
  name: string;
  isActive: boolean;
  price: number;
  duration: number;
  dataLimit: string;
  speedLimit: string;
  routerId: string | null;
}

interface FakeSession {
  id: string;
  userId: string;
  planId: string;
  routerId: string | null;
  sessionToken: string;
  status: string;
  dataUsed: bigint;
  startTime: Date;
  endTime: Date | null;
}

interface FakePayment {
  id: string;
  userId: string;
  planId: string;
  amount: number;
  status: string;
  checkoutRequestId: string | null;
  paymentReference: string | null;
  paymentMethod: string;
  createdAt: Date;
  updatedAt: Date;
}

function makeFakePrisma(seed?: {
  plans?: FakePlan[];
  users?: FakeUser[];
  payments?: FakePayment[];
  sessions?: FakeSession[];
}) {
  const users: FakeUser[] = seed?.users ?? [];
  const plans: FakePlan[] = seed?.plans ?? [];
  const payments: FakePayment[] = seed?.payments ?? [];
  const sessions: FakeSession[] = seed?.sessions ?? [];

  const fakePrisma: any = {
    _users: users,
    _plans: plans,
    _payments: payments,
    _sessions: sessions,

    $transaction: async (fnOrArray: any) => {
      if (typeof fnOrArray === 'function') {
        return fnOrArray(fakePrisma);
      }
      return Promise.all(fnOrArray);
    },

    user: {
      findFirst: async (args: any) => {
        const orClauses: any[] = args?.where?.OR ?? [];
        return (
          users.find(u =>
            orClauses.some(clause => {
              if (clause.phone !== undefined) return u.phone === clause.phone;
              if (clause.email !== undefined) return u.email === clause.email;
              return false;
            })
          ) ?? null
        );
      },
      findUnique: async (args: any) => {
        return users.find(u => u.id === args.where.id) ?? null;
      },
      create: async (args: any) => {
        const u: FakeUser = {
          id: makeId(),
          phone: args.data.phone ?? null,
          email: args.data.email ?? null,
          role: args.data.role ?? 'CUSTOMER',
          isActive: true,
          firstName: args.data.firstName ?? null,
          lastName: args.data.lastName ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        users.push(u);
        return u;
      },
    },

    plan: {
      findUnique: async (args: any) => {
        return plans.find(p => p.id === args.where.id) ?? null;
      },
    },

    payment: {
      create: async (args: any) => {
        const p: FakePayment = {
          id: makeId(),
          userId: args.data.userId,
          planId: args.data.planId,
          amount: args.data.amount,
          status: args.data.status ?? 'PENDING',
          checkoutRequestId: args.data.checkoutRequestId ?? null,
          paymentReference: args.data.paymentReference ?? null,
          paymentMethod: args.data.paymentMethod ?? 'PAYSTACK',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        payments.push(p);
        return p;
      },
      update: async (args: any) => {
        const idx = payments.findIndex(p => p.id === args.where.id);
        if (idx === -1) throw new Error(`payment ${args.where.id} not found`);
        Object.assign(payments[idx], args.data, { updatedAt: new Date() });
        return payments[idx];
      },
      updateMany: async (args: any) => {
        let count = 0;
        for (const p of payments) {
          const matchId = args.where.id ? p.id === args.where.id : true;
          const matchStatus = args.where.status ? p.status === args.where.status : true;
          if (matchId && matchStatus) {
            Object.assign(p, args.data, { updatedAt: new Date() });
            count++;
          }
        }
        return { count };
      },
      findFirst: async (args: any) => {
        const match = payments.find(p => {
          const orClauses: any[] = args?.where?.OR ?? [];
          if (orClauses.length > 0) {
            return orClauses.some(clause => {
              if (clause.checkoutRequestId !== undefined)
                return p.checkoutRequestId === clause.checkoutRequestId;
              if (clause.paymentReference !== undefined)
                return p.paymentReference === clause.paymentReference;
              if (clause.id !== undefined)
                return p.id === clause.id;
              return false;
            });
          }
          if (args?.where?.id !== undefined) return p.id === args.where.id;
          if (args?.where?.checkoutRequestId !== undefined) return p.checkoutRequestId === args.where.checkoutRequestId;
          if (args?.where?.paymentReference !== undefined) return p.paymentReference === args.where.paymentReference;
          return false;
        });

        if (!match) return null;

        const result: any = { ...match };
        if (args?.include?.user) {
          result.user = users.find(u => u.id === match.userId) ?? null;
        }
        if (args?.include?.plan) {
          result.plan = plans.find(pl => pl.id === match.planId) ?? null;
        }
        return result;
      },
      findUnique: async (args: any) => {
        const match = payments.find(p => p.id === args.where.id);
        if (!match) return null;
        const result: any = { ...match };
        if (args?.include?.user) {
          result.user = users.find(u => u.id === match.userId) ?? null;
        }
        if (args?.include?.plan) {
          result.plan = plans.find(pl => pl.id === match.planId) ?? null;
        }
        return result;
      },
    },

    session: {
      findFirst: async (args: any) => {
        return sessions.find(s => {
          if (args?.where?.userId && s.userId !== args.where.userId) return false;
          if (args?.where?.planId && s.planId !== args.where.planId) return false;
          if (args?.where?.status && s.status !== args.where.status) return false;
          if (args?.where?.sessionToken && s.sessionToken !== args.where.sessionToken) return false;
          return true;
        }) ?? null;
      },
      create: async (args: any) => {
        const s: FakeSession = {
          id: makeId(),
          userId: args.data.userId,
          planId: args.data.planId,
          routerId: args.data.routerId ?? null,
          sessionToken: args.data.sessionToken,
          status: args.data.status ?? 'ACTIVE',
          dataUsed: BigInt(0),
          startTime: new Date(),
          endTime: args.data.endTime ?? null,
        };
        sessions.push(s);
        return s;
      },
    },
  };

  return fakePrisma;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function activePlan(overrides?: Partial<FakePlan>): FakePlan {
  return {
    id: makeId(),
    name: 'Basic 1-Hour',
    isActive: true,
    price: 100,
    duration: 1,
    dataLimit: '1GB',
    speedLimit: '10Mbps',
    routerId: null,
    ...overrides,
  };
}

function existingUser(overrides?: Partial<FakeUser>): FakeUser {
  return {
    id: makeId(),
    phone: '+2348012345678',
    email: null,
    role: 'CUSTOMER',
    isActive: true,
    firstName: null,
    lastName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentService.initiatePayment — successful initiation', () => {
  let gateway: FakePaymentGateway;
  let prisma: ReturnType<typeof makeFakePrisma>;
  let service: PaymentService;
  let plan: FakePlan;

  beforeEach(() => {
    plan = activePlan();
    gateway = new FakePaymentGateway({ referencePrefix: 'test_ref_' });
    prisma = makeFakePrisma({ plans: [plan] });
    service = new PaymentService(prisma as any, gateway);
  });

  test('returns reference and access_code from gateway', async () => {
    const result = await service.initiatePayment({
      planId: plan.id,
      amount: 100,
      phone: '+2348000000001',
    });

    assert.ok(result.reference, 'reference must be present');
    assert.ok(result.access_code, 'access_code must be present');
  });

  test('creates a pending payment record linked to the resolved customer', async () => {
    await service.initiatePayment({
      planId: plan.id,
      amount: 100,
      phone: '+2348000000002',
    });

    assert.equal(prisma._payments.length, 1);
    const payment = prisma._payments[0];
    assert.equal(payment.status, 'PENDING');
    assert.equal(payment.planId, plan.id);
    assert.equal(payment.amount, 100);
    assert.ok(payment.userId, 'payment must be linked to a user');
  });

  test('records the gateway reference on the payment record', async () => {
    const result = await service.initiatePayment({
      planId: plan.id,
      amount: 100,
      phone: '+2348000000003',
    });

    const payment = prisma._payments[0];
    assert.equal(payment.checkoutRequestId, result.reference);
  });

  test('passes plan amount and email to the gateway', async () => {
    await service.initiatePayment({
      planId: plan.id,
      amount: 250,
      email: 'buyer@example.com',
    });

    const last = gateway.getLastInitiatedPayment();
    assert.ok(last, 'gateway must have been called');
    assert.equal(last.amount, 250);
    assert.equal(last.email, 'buyer@example.com');
    assert.equal(last.planId, plan.id);
  });
});

describe('PaymentService.initiatePayment — guest resolution', () => {
  let gateway: FakePaymentGateway;
  let prisma: ReturnType<typeof makeFakePrisma>;
  let service: PaymentService;
  let plan: FakePlan;

  beforeEach(() => {
    plan = activePlan();
    gateway = new FakePaymentGateway();
    prisma = makeFakePrisma({ plans: [plan] });
    service = new PaymentService(prisma as any, gateway);
  });

  test('creates a new guest customer when phone is not in the database', async () => {
    await service.initiatePayment({
      planId: plan.id,
      amount: 100,
      phone: '+2349011111111',
    });

    assert.equal(prisma._users.length, 1);
    const created = prisma._users[0];
    assert.equal(created.phone, '+2349011111111');
    assert.equal(created.role, 'CUSTOMER');
  });

  test('resolves existing customer by phone instead of creating a duplicate', async () => {
    const existing = existingUser({ phone: '+2348077777777' });
    prisma._users.push(existing);

    await service.initiatePayment({
      planId: plan.id,
      amount: 100,
      phone: '+2348077777777',
    });

    // No new user must have been created
    assert.equal(prisma._users.length, 1);
    const payment = prisma._payments[0];
    assert.equal(payment.userId, existing.id);
  });

  test('resolves existing customer by email when phone is omitted', async () => {
    const existing = existingUser({ phone: '+2348099999999', email: 'known@example.com' });
    prisma._users.push(existing);

    await service.initiatePayment({
      planId: plan.id,
      amount: 100,
      email: 'known@example.com',
    });

    assert.equal(prisma._users.length, 1);
    const payment = prisma._payments[0];
    assert.equal(payment.userId, existing.id);
  });

  test('creates guest with email when neither phone nor email matches existing record', async () => {
    await service.initiatePayment({
      planId: plan.id,
      amount: 100,
      email: 'newguest@example.com',
    });

    assert.equal(prisma._users.length, 1);
    const created = prisma._users[0];
    assert.equal(created.email, 'newguest@example.com');
    // phone is synthesised — must be a non-empty string
    assert.ok(created.phone);
  });
});

describe('PaymentService.initiatePayment — contact validation', () => {
  test('throws when neither phone nor email is provided', async () => {
    const plan = activePlan();
    const gateway = new FakePaymentGateway();
    const prisma = makeFakePrisma({ plans: [plan] });
    const service = new PaymentService(prisma as any, gateway);

    await assert.rejects(
      () => service.initiatePayment({ planId: plan.id, amount: 100 }),
      { message: /at least one of phone or email/i }
    );

    // No side-effects
    assert.equal(gateway.initiatedPayments.length, 0);
    assert.equal(prisma._payments.length, 0);
    assert.equal(prisma._users.length, 0);
  });
});

describe('PaymentService.initiatePayment — authorization_url forwarding', () => {
  test('includes authorization_url in result when gateway provides one', async () => {
    const plan = activePlan();
    const gateway = new FakePaymentGateway({ referencePrefix: 'url_ref_' });
    const prisma = makeFakePrisma({ plans: [plan] });
    const service = new PaymentService(prisma as any, gateway);

    const result = await service.initiatePayment({
      planId: plan.id,
      amount: 100,
      phone: '+2348000000099',
    });

    // FakePaymentGateway always generates an authorization_url
    assert.ok(result.authorization_url, 'authorization_url should be forwarded');
    assert.ok(result.authorization_url!.startsWith('https://'), 'should be a URL');
  });
});

describe('PaymentService.initiatePayment — inactive plan rejection', () => {
  test('throws when plan does not exist', async () => {
    const gateway = new FakePaymentGateway();
    const prisma = makeFakePrisma({ plans: [] });
    const service = new PaymentService(prisma as any, gateway);

    await assert.rejects(
      () => service.initiatePayment({ planId: 'nonexistent-plan-id', amount: 100, phone: '+2341' }),
      { message: /plan not found/i }
    );
  });

  test('throws when plan exists but is inactive', async () => {
    const inactivePlan = activePlan({ isActive: false });
    const gateway = new FakePaymentGateway();
    const prisma = makeFakePrisma({ plans: [inactivePlan] });
    const service = new PaymentService(prisma as any, gateway);

    await assert.rejects(
      () => service.initiatePayment({ planId: inactivePlan.id, amount: 100, phone: '+2341' }),
      { message: /plan not found/i }
    );
  });

  test('does not call gateway or create records when plan is invalid', async () => {
    const gateway = new FakePaymentGateway();
    const prisma = makeFakePrisma({ plans: [] });
    const service = new PaymentService(prisma as any, gateway);

    await assert.rejects(() =>
      service.initiatePayment({ planId: 'bad', amount: 100, phone: '+2341' })
    );

    assert.equal(gateway.initiatedPayments.length, 0);
    assert.equal(prisma._payments.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Fake Session and SMS collaborators for testing fulfillment
// ---------------------------------------------------------------------------

class FakeSessionService {
  public sessions: any[] = [];
  constructor(private prisma?: any) {}

  async createSession(userId: string, planId: string, sessionToken: string) {
    const sess = {
      id: makeId(),
      userId,
      planId,
      sessionToken,
      status: 'ACTIVE',
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      dataUsed: BigInt(0),
      routerId: null
    };
    this.sessions.push(sess);
    if (this.prisma?._sessions) {
      this.prisma._sessions.push(sess);
    }
    return sess;
  }
}

class FakeSmsService {
  public sentConfirmations: Array<{ phone: string; amount: number; receipt: string }> = [];
  async sendPaymentConfirmation(phone: string, amount: number, receiptNumber: string) {
    this.sentConfirmations.push({ phone, amount, receipt: receiptNumber });
    return true;
  }
}

describe('PaymentService.handleWebhook — signature verification & rejection', () => {
  let gateway: FakePaymentGateway;
  let prisma: any;
  let fakeSession: FakeSessionService;
  let fakeSms: FakeSmsService;
  let service: PaymentService;

  beforeEach(() => {
    gateway = new FakePaymentGateway({ secretKey: 'webhook_test_secret' });
    prisma = makeFakePrisma();
    fakeSession = new FakeSessionService(prisma);
    fakeSms = new FakeSmsService();
    service = new PaymentService(prisma, gateway, fakeSession as any, fakeSms as any);
  });

  test('rejects unverified requests with invalid signature', async () => {
    const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'ref_123' } });
    await assert.rejects(
      () => service.handleWebhook(payload, 'invalid_signature_hex'),
      { message: /invalid webhook signature/i }
    );
  });

  test('accepts requests with valid cryptographic HMAC signature', async () => {
    const payload = JSON.stringify({ event: 'ignored.event', data: {} });
    const validSig = gateway.createWebhookSignature(payload);

    // Should not throw
    const res = await service.handleWebhook(payload, validSig);
    assert.ok(res);
  });
});

describe('PaymentService.handleWebhook & fulfillPayment — successful charge fulfillment', () => {
  let gateway: FakePaymentGateway;
  let prisma: any;
  let fakeSession: FakeSessionService;
  let fakeSms: FakeSmsService;
  let service: PaymentService;
  let user: FakeUser;
  let plan: FakePlan;

  beforeEach(() => {
    user = existingUser({ phone: '+254712345678' });
    plan = activePlan({ duration: 2 });
    gateway = new FakePaymentGateway({ secretKey: 'secret_fulfill' });
    prisma = makeFakePrisma({ users: [user], plans: [plan] });
    fakeSession = new FakeSessionService(prisma);
    fakeSms = new FakeSmsService();
    service = new PaymentService(prisma, gateway, fakeSession as any, fakeSms as any);
  });

  test('transitions pending payment to completed, activates network session, and sends SMS', async () => {
    // 1. Create a pending payment
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        planId: plan.id,
        amount: 200,
        status: 'PENDING',
        checkoutRequestId: 'checkout_ref_001'
      }
    });

    const payload = JSON.stringify({
      event: 'charge.success',
      data: {
        reference: 'checkout_ref_001',
        amount: 20000,
        metadata: { paymentId: payment.id }
      }
    });
    const sig = gateway.createWebhookSignature(payload);

    await service.handleWebhook(payload, sig);

    // Verify payment updated to COMPLETED
    const updatedPayment = prisma._payments.find((p: any) => p.id === payment.id);
    assert.equal(updatedPayment.status, 'COMPLETED');
    assert.equal(updatedPayment.paymentReference, 'checkout_ref_001');

    // Verify network session created via sessionService
    assert.equal(fakeSession.sessions.length, 1);
    assert.equal(fakeSession.sessions[0].userId, user.id);
    assert.equal(fakeSession.sessions[0].planId, plan.id);
    assert.ok(fakeSession.sessions[0].sessionToken);

    // Verify SMS receipt sent to customer
    assert.equal(fakeSms.sentConfirmations.length, 1);
    assert.equal(fakeSms.sentConfirmations[0].phone, user.phone);
    assert.equal(fakeSms.sentConfirmations[0].amount, 200);
    assert.equal(fakeSms.sentConfirmations[0].receipt, 'checkout_ref_001');
  });

  test('fulfills payment using metadata paymentId when reference lookup falls back', async () => {
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        planId: plan.id,
        amount: 150,
        status: 'PENDING',
        checkoutRequestId: 'internal_chk_123'
      }
    });

    const payload = JSON.stringify({
      event: 'charge.success',
      data: {
        reference: 'external_gateway_ref_999',
        metadata: { paymentId: payment.id }
      }
    });
    const sig = gateway.createWebhookSignature(payload);

    await service.handleWebhook(payload, sig);

    const updatedPayment = prisma._payments.find((p: any) => p.id === payment.id);
    assert.equal(updatedPayment.status, 'COMPLETED');
    assert.equal(updatedPayment.paymentReference, 'external_gateway_ref_999');
    assert.equal(fakeSession.sessions.length, 1);
    assert.equal(fakeSms.sentConfirmations.length, 1);
  });
});

describe('PaymentService.checkStatus — polling & gateway verification', () => {
  let gateway: FakePaymentGateway;
  let prisma: any;
  let fakeSession: FakeSessionService;
  let fakeSms: FakeSmsService;
  let service: PaymentService;
  let user: FakeUser;
  let plan: FakePlan;

  beforeEach(() => {
    user = existingUser({ phone: '+254700000000' });
    plan = activePlan();
    gateway = new FakePaymentGateway();
    prisma = makeFakePrisma({ users: [user], plans: [plan] });
    fakeSession = new FakeSessionService(prisma);
    fakeSms = new FakeSmsService();
    service = new PaymentService(prisma, gateway, fakeSession as any, fakeSms as any);
  });

  test('returns completed status and active session token when payment is already COMPLETED', async () => {
    await prisma.payment.create({
      data: {
        userId: user.id,
        planId: plan.id,
        amount: 100,
        status: 'COMPLETED',
        checkoutRequestId: 'poll_completed_ref'
      }
    });
    await prisma.session.create({
      data: {
        userId: user.id,
        planId: plan.id,
        sessionToken: 'token_existing_active',
        status: 'ACTIVE'
      }
    });

    const result = await service.checkStatus('poll_completed_ref');
    assert.equal(result.status, 'completed');
    assert.equal(result.sessionToken, 'token_existing_active');
    // Did not create additional session or send duplicate SMS
    assert.equal(fakeSession.sessions.length, 0);
    assert.equal(fakeSms.sentConfirmations.length, 0);
  });

  test('triggers fulfillment when payment is PENDING and gateway confirms settlement', async () => {
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        planId: plan.id,
        amount: 100,
        status: 'PENDING',
        checkoutRequestId: 'poll_pending_settled'
      }
    });

    // Gateway reports transaction as successful
    gateway.setTransactionStatus('poll_pending_settled', {
      status: 'success',
      amount: 10000,
      reference: 'poll_pending_settled'
    });

    const result = await service.checkStatus('poll_pending_settled');

    assert.equal(result.status, 'completed');
    assert.ok(result.sessionToken);

    const updatedPayment = prisma._payments.find((p: any) => p.id === payment.id);
    assert.equal(updatedPayment.status, 'COMPLETED');
    assert.equal(fakeSession.sessions.length, 1);
    assert.equal(fakeSms.sentConfirmations.length, 1);
  });

  test('returns pending status when payment is PENDING and gateway verification is not successful', async () => {
    await prisma.payment.create({
      data: {
        userId: user.id,
        planId: plan.id,
        amount: 100,
        status: 'PENDING',
        checkoutRequestId: 'poll_not_yet_paid'
      }
    });

    gateway.setTransactionStatus('poll_not_yet_paid', {
      status: 'pending',
      amount: 10000
    });

    const result = await service.checkStatus('poll_not_yet_paid');
    assert.equal(result.status, 'pending');
    assert.equal(result.sessionToken, undefined);
    assert.equal(fakeSession.sessions.length, 0);
    assert.equal(fakeSms.sentConfirmations.length, 0);
  });

  test('throws error when payment is not found', async () => {
    await assert.rejects(
      () => service.checkStatus('non_existent_ref'),
      { message: /payment not found/i }
    );
  });
});

describe('PaymentService — idempotent fulfillment & concurrency race safety', () => {
  let gateway: FakePaymentGateway;
  let prisma: any;
  let fakeSession: FakeSessionService;
  let fakeSms: FakeSmsService;
  let service: PaymentService;
  let user: FakeUser;
  let plan: FakePlan;

  beforeEach(() => {
    user = existingUser({ phone: '+254711111111' });
    plan = activePlan();
    gateway = new FakePaymentGateway({ secretKey: 'race_secret' });
    prisma = makeFakePrisma({ users: [user], plans: [plan] });
    fakeSession = new FakeSessionService(prisma);
    fakeSms = new FakeSmsService();
    service = new PaymentService(prisma, gateway, fakeSession as any, fakeSms as any);
  });

  test('repeated webhook calls for the same payment reference execute fulfillment exactly once', async () => {
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        planId: plan.id,
        amount: 100,
        status: 'PENDING',
        checkoutRequestId: 'repeat_ref_1'
      }
    });

    const payload = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'repeat_ref_1', metadata: { paymentId: payment.id } }
    });
    const sig = gateway.createWebhookSignature(payload);

    // Call webhook 3 times sequentially
    await service.handleWebhook(payload, sig);
    await service.handleWebhook(payload, sig);
    await service.handleWebhook(payload, sig);

    assert.equal(fakeSession.sessions.length, 1, 'Only one session should be created');
    assert.equal(fakeSms.sentConfirmations.length, 1, 'Only one SMS should be sent');
  });

  test('concurrent webhook and polling requests execute exactly-once fulfillment without duplicated sessions or SMS', async () => {
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        planId: plan.id,
        amount: 100,
        status: 'PENDING',
        checkoutRequestId: 'concurrent_ref_99'
      }
    });

    gateway.setTransactionStatus('concurrent_ref_99', {
      status: 'success',
      amount: 10000,
      reference: 'concurrent_ref_99'
    });

    const payload = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'concurrent_ref_99', metadata: { paymentId: payment.id } }
    });
    const sig = gateway.createWebhookSignature(payload);

    // Fire 5 concurrent requests (2 webhooks and 3 status polls) simultaneously
    const results = await Promise.all([
      service.handleWebhook(payload, sig),
      service.checkStatus('concurrent_ref_99'),
      service.handleWebhook(payload, sig),
      service.checkStatus('concurrent_ref_99'),
      service.checkStatus('concurrent_ref_99'),
    ]);

    // Check sessions and SMS
    assert.equal(fakeSession.sessions.length, 1, 'Exactly one network session created');
    assert.equal(fakeSms.sentConfirmations.length, 1, 'Exactly one confirmation SMS sent');

    // Status checks should all observe completed status
    const pollResults = [results[1], results[3], results[4]];
    for (const res of pollResults) {
      assert.equal(res.status, 'completed');
      assert.ok(res.sessionToken);
    }
  });
});


