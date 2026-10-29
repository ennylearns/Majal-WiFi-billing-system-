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
}) {
  const users: FakeUser[] = seed?.users ?? [];
  const plans: FakePlan[] = seed?.plans ?? [];
  const payments: FakePayment[] = seed?.payments ?? [];

  return {
    _users: users,
    _plans: plans,
    _payments: payments,

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
      findFirst: async (args: any) => {
        return payments.find(p => {
          const orClauses: any[] = args?.where?.OR ?? [];
          if (orClauses.length > 0) {
            return orClauses.some(clause => {
              if (clause.checkoutRequestId !== undefined)
                return p.checkoutRequestId === clause.checkoutRequestId;
              if (clause.paymentReference !== undefined)
                return p.paymentReference === clause.paymentReference;
              return false;
            });
          }
          if (args?.where?.id !== undefined) return p.id === args.where.id;
          return false;
        }) ?? null;
      },
    },
  };
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

