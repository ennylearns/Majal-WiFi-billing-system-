import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import paystackService, { PaystackService } from './paystackService';
import sessionService, { SessionService } from './sessionService';

describe('PaystackService - initiateTransaction', () => {
  const originalEnv = process.env;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PAYSTACK_SECRET_KEY: 'sk_test_mock_secret_key'
    };
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  test('calls Paystack Initialize API with amount in kobo, NGN currency and auth header', async () => {
    let capturedUrl = '';
    let capturedInit: any;

    globalThis.fetch = (async (input: any, init?: any) => {
      capturedUrl = input.toString();
      capturedInit = init;
      return new Response(
        JSON.stringify({
          status: true,
          message: 'Authorization URL created',
          data: {
            authorization_url: 'https://checkout.paystack.com/0peioxfhpn',
            access_code: '0peioxfhpn',
            reference: 'ref_12345678'
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    const service = new PaystackService();
    const result = await service.initiateTransaction('user@example.com', 500, 'plan-uuid-1', 'payment-uuid-1');

    assert.equal(capturedUrl, 'https://api.paystack.co/transaction/initialize');
    assert.equal(capturedInit?.method, 'POST');
    
    const headers = capturedInit?.headers as Record<string, string>;
    assert.equal(headers['Authorization'], 'Bearer sk_test_mock_secret_key');
    assert.equal(headers['Content-Type'], 'application/json');

    const body = JSON.parse(capturedInit?.body as string);
    assert.equal(body.email, 'user@example.com');
    assert.equal(body.amount, 50000); // 500 * 100 in kobo
    assert.equal(body.currency, 'NGN');
    assert.equal(body.metadata?.planId, 'plan-uuid-1');
    assert.equal(body.metadata?.paymentId, 'payment-uuid-1');

    assert.deepEqual(result, {
      reference: 'ref_12345678',
      access_code: '0peioxfhpn'
    });
  });
});

describe('PaystackService - verifyTransaction', () => {
  const originalEnv = process.env;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PAYSTACK_SECRET_KEY: 'sk_test_mock_secret_key'
    };
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  test('calls Paystack Verify API with auth header and returns status and amount', async () => {
    let capturedUrl = '';
    let capturedInit: any;

    globalThis.fetch = (async (input: any, init?: any) => {
      capturedUrl = input.toString();
      capturedInit = init;
      return new Response(
        JSON.stringify({
          status: true,
          message: 'Verification successful',
          data: {
            status: 'success',
            amount: 50000,
            reference: 'ref_12345678'
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    const service = new PaystackService();
    const result = await service.verifyTransaction('ref_12345678');

    assert.equal(capturedUrl, 'https://api.paystack.co/transaction/verify/ref_12345678');
    assert.equal(capturedInit?.method, 'GET');

    const headers = capturedInit?.headers as Record<string, string>;
    assert.equal(headers['Authorization'], 'Bearer sk_test_mock_secret_key');

    assert.deepEqual(result, {
      status: 'success',
      amount: 50000
    });
  });
});

describe('PaystackService - handleWebhook signature verification', () => {
  const secret = 'sk_test_mock_secret_key';
  const crypto = require('crypto');
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PAYSTACK_SECRET_KEY: secret
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('rejects invalid signature without touching database', async () => {

    let dbTouched = false;
    const mockPrisma = {
      payment: {
        update: async () => { dbTouched = true; },
        findUnique: async () => { dbTouched = true; }
      }
    };

    const service = new PaystackService(mockPrisma as any);
    const rawBody = JSON.stringify({ event: 'charge.success', data: { reference: 'ref_123' } });
    const invalidSignature = 'invalid_hex_signature';

    await assert.rejects(
      async () => {
        await service.handleWebhook(rawBody, invalidSignature);
      },
      {
        message: 'Invalid webhook signature'
      }
    );

    assert.equal(dbTouched, false);
  });

  test('on charge.success event with valid signature, updates payment to COMPLETED and delegates to sessionService', async () => {
    let paymentUpdated = false;
    let capturedPaymentUpdate: any = null;
    let sessionCreatedArgs: { userId: string; planId: string; sessionToken: string } | null = null;

    const mockPayment = {
      id: 'pay-uuid-1',
      userId: 'user-uuid-1',
      planId: 'plan-uuid-1',
      status: 'PENDING',
      plan: {
        id: 'plan-uuid-1',
        duration: 2
      }
    };

    const mockPrisma = {
      payment: {
        findFirst: async ({ where }: any) => {
          if (where.OR?.some((cond: any) => cond.checkoutRequestId === 'ref_123' || cond.paymentReference === 'ref_123') ||
              where.checkoutRequestId === 'ref_123' || where.paymentReference === 'ref_123') {
            return mockPayment;
          }
          return null;
        },
        findUnique: async ({ where }: any) => {
          if (where.checkoutRequestId === 'ref_123' || where.id === 'pay-uuid-1') {
            return mockPayment;
          }
          return null;
        },
        update: async ({ where, data }: any) => {
          if (data.status === 'COMPLETED' && data.paymentReference === 'ref_123') {
            paymentUpdated = true;
            capturedPaymentUpdate = data;
          }
          return { ...mockPayment, ...data };
        }
      },
      session: {
        findFirst: async () => null
      }
    };

    const mockSessionService = {
      createSession: async (userId: string, planId: string, sessionToken: string) => {
        sessionCreatedArgs = { userId, planId, sessionToken };
        return { id: 'sess-uuid-1', userId, planId, sessionToken };
      }
    } as unknown as SessionService;

    const service = new PaystackService(mockPrisma as any, mockSessionService);
    const rawBody = JSON.stringify({
      event: 'charge.success',
      data: {
        reference: 'ref_123',
        status: 'success',
        amount: 50000,
        metadata: {
          planId: 'plan-uuid-1',
          paymentId: 'pay-uuid-1'
        }
      }
    });

    const validSignature = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    await service.handleWebhook(rawBody, validSignature);

    assert.equal(paymentUpdated, true);
    assert.equal(capturedPaymentUpdate?.status, 'COMPLETED');
    assert.equal(capturedPaymentUpdate?.paymentReference, 'ref_123');
    assert.notEqual(sessionCreatedArgs, null, 'sessionService.createSession should have been invoked');
    assert.equal(sessionCreatedArgs!.userId, 'user-uuid-1');
    assert.equal(sessionCreatedArgs!.planId, 'plan-uuid-1');
    assert.equal(typeof sessionCreatedArgs!.sessionToken, 'string');
    assert.ok(sessionCreatedArgs!.sessionToken.length > 0);
  });

  test('webhook deliveries for already COMPLETED payments are idempotent no-ops', async () => {
    let paymentUpdateCalled = false;
    let sessionCreateCalled = false;

    const completedPayment = {
      id: 'pay-uuid-completed',
      userId: 'user-uuid-1',
      planId: 'plan-uuid-1',
      status: 'COMPLETED',
      paymentReference: 'ref_completed',
      plan: {
        id: 'plan-uuid-1',
        duration: 2
      }
    };

    const mockPrisma = {
      payment: {
        findFirst: async () => completedPayment,
        findUnique: async () => completedPayment,
        update: async () => {
          paymentUpdateCalled = true;
        }
      },
      session: {
        findFirst: async () => null
      }
    };

    const mockSessionService = {
      createSession: async () => {
        sessionCreateCalled = true;
      }
    } as unknown as SessionService;

    const service = new PaystackService(mockPrisma as any, mockSessionService);
    const rawBody = JSON.stringify({
      event: 'charge.success',
      data: {
        reference: 'ref_completed',
        status: 'success',
        amount: 50000,
        metadata: {
          planId: 'plan-uuid-1',
          paymentId: 'pay-uuid-completed'
        }
      }
    });

    const validSignature = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    await service.handleWebhook(rawBody, validSignature);

    assert.equal(paymentUpdateCalled, false, 'Should not update payment again');
    assert.equal(sessionCreateCalled, false, 'Should not create session again');
  });

  test('delegates to sessionService which provisions router hotspot credentials matching sessionToken', async () => {
    let routerUserCreated: { username: string; password: string; profile: string } | null = null;
    const fakeSessionService = {
      createSession: async (userId: string, planId: string, sessionToken: string) => {
        routerUserCreated = { username: sessionToken, password: sessionToken, profile: `plan_${planId}` };
        return { id: 'sess-123', userId, planId, sessionToken, status: 'ACTIVE' };
      }
    } as unknown as SessionService;

    const mockPayment = {
      id: 'pay-uuid-mikrotik',
      userId: 'user-uuid-99',
      planId: 'plan-uuid-88',
      status: 'PENDING',
      plan: { id: 'plan-uuid-88', duration: 2 }
    };

    const mockPrisma = {
      payment: {
        findFirst: async () => mockPayment,
        findUnique: async () => mockPayment,
        update: async () => mockPayment
      },
      session: {
        findFirst: async () => null
      }
    };

    const service = new PaystackService(mockPrisma as any, fakeSessionService);
    const rawBody = JSON.stringify({
      event: 'charge.success',
      data: {
        reference: 'ref_mikrotik',
        status: 'success',
        amount: 50000,
        metadata: {
          planId: 'plan-uuid-88',
          paymentId: 'pay-uuid-mikrotik'
        }
      }
    });

    const validSignature = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    await service.handleWebhook(rawBody, validSignature);

    assert.notEqual(routerUserCreated, null);
    assert.equal(typeof routerUserCreated!.username, 'string');
    assert.equal(routerUserCreated!.username, routerUserCreated!.password);
    assert.equal(routerUserCreated!.profile, 'plan_plan-uuid-88');
  });
});

describe('PaystackService - dev-mode stub', () => {
  const originalEnv = process.env;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      PAYSTACK_SECRET_KEY: 'mock_dev_secret'
    };
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  test('skips real API calls and returns mock reference and access_code in development mode', async () => {
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error('fetch should not be called in dev mode');
    }) as any;

    const service = new PaystackService();
    const result = await service.initiateTransaction('dev@example.com', 200, 'plan-dev', 'pay-dev');

    assert.equal(fetchCalled, false);
    assert.ok(result.reference.startsWith('mock_ref_'));
    assert.ok(result.access_code.startsWith('mock_code_'));
  });
});

describe('PaystackService - SessionService dependency injection', () => {
  test('defaults to default sessionService singleton when omitted from constructor', () => {
    const service = new PaystackService();
    assert.equal(service.sessionService, sessionService);
  });

  test('defaults to default sessionService singleton when only prismaClient is provided', () => {
    const mockPrisma = {} as any;
    const service = new PaystackService(mockPrisma);
    assert.equal(service.sessionService, sessionService);
  });

  test('accepts and retains custom sessionService mock instance in constructor', () => {
    const mockSessionService = {
      createSession: async () => ({ id: 'mock-session-id' }),
      extendSession: async () => ({ id: 'mock-extended-id' })
    } as unknown as SessionService;

    const service = new PaystackService(undefined, mockSessionService);
    assert.equal(service.sessionService, mockSessionService);
  });
});





