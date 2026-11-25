import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { BachsGateway } from '../paymentGateway';

describe('BachsGateway - Initialization & URL Auto-Detection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      MOCK_SERVICES: 'false'
    };
    delete process.env.BACHS_API_KEY;
    delete process.env.BACHS_WEBHOOK_SECRET;
    delete process.env.BACHS_PAYMENT_METHODS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('auto-detects sandbox URL from sk_sandbox_ prefix and live URL from sk_live_ prefix', () => {
    const sandboxGateway = new BachsGateway({ apiKey: 'sk_sandbox_123' });
    assert.equal(sandboxGateway.getBaseURL(), 'https://sandbox-api.bachs.io');

    const liveGateway = new BachsGateway({ apiKey: 'sk_live_456' });
    assert.equal(liveGateway.getBaseURL(), 'https://api.bachs.io');
  });

  test('reads BACHS_API_KEY from environment when not passed in options', () => {
    process.env.BACHS_API_KEY = 'sk_sandbox_from_env';
    const gateway = new BachsGateway();
    assert.equal(gateway.getBaseURL(), 'https://sandbox-api.bachs.io');
  });

  test('throws on missing or unrecognized API key in non-mock mode', () => {
    assert.throws(() => new BachsGateway(), /BACHS_API_KEY/i);
    assert.throws(() => new BachsGateway({ apiKey: 'invalid_key_123' }), /sk_sandbox_|sk_live_/i);
  });

  test('allows missing API key when MOCK_SERVICES is true', () => {
    process.env.MOCK_SERVICES = 'true';
    const gateway = new BachsGateway();
    assert.equal(gateway.getBaseURL(), 'https://sandbox-api.bachs.io');
  });
});

describe('BachsGateway - initiateTransaction', () => {
  const apiKey = 'sk_sandbox_test_key';
  const originalEnv = process.env;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      MOCK_SERVICES: 'false',
      BACHS_API_KEY: apiKey
    };
    delete process.env.BACHS_PAYMENT_METHODS;
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  test('posts checkout session with NGN two-decimal string, default payment methods, and maps response', async () => {
    let capturedUrl = '';
    let capturedInit: any;

    globalThis.fetch = (async (url: any, init?: any) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return new Response(
        JSON.stringify({
          checkout_id: 'chk_12345',
          checkout_url: 'https://checkout.bachs.io/chk_12345'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    const gateway = new BachsGateway();
    const result = await gateway.initiateTransaction({
      email: 'customer@domain.com',
      amount: 500,
      planId: 'plan-1',
      paymentId: 'pay-uuid-1',
      metadata: { macAddress: 'AA:BB:CC:DD:EE:FF' }
    });

    assert.equal(capturedUrl, 'https://sandbox-api.bachs.io/v1/checkout-sessions');
    assert.equal(capturedInit?.method, 'POST');
    assert.equal(capturedInit?.headers?.['Authorization'], `Bearer ${apiKey}`);
    assert.equal(capturedInit?.headers?.['Content-Type'], 'application/json');

    const body = JSON.parse(capturedInit?.body);
    assert.deepEqual(body, {
      pricing: {
        currency: 'NGN',
        amount: '500.00'
      },
      billing_currency: 'NGN',
      payment_method_types: ['NGN_CARD', 'NGN_BANK_TRANSFER'],
      customer_creation: 'if_required',
      customer: { email: 'customer@domain.com' },
      reference: 'pay-uuid-1',
      metadata: {
        paymentId: 'pay-uuid-1',
        planId: 'plan-1',
        macAddress: 'AA:BB:CC:DD:EE:FF'
      }
    });

    assert.equal(result.reference, 'chk_12345');
    assert.equal(result.access_code, 'chk_12345');
    assert.equal(result.accessCode, 'chk_12345');
    assert.equal(result.authorization_url, 'https://checkout.bachs.io/chk_12345');
    assert.equal(result.checkoutUrl, 'https://checkout.bachs.io/chk_12345');
  });

  test('formats fractional amounts to two decimals and respects BACHS_PAYMENT_METHODS', async () => {
    process.env.BACHS_PAYMENT_METHODS = 'NGN_CARD, NGN_USSD';
    let capturedBody: any;

    globalThis.fetch = (async (_url: any, init?: any) => {
      capturedBody = JSON.parse(init?.body);
      return new Response(
        JSON.stringify({
          checkout_id: 'chk_frac',
          checkout_url: 'https://checkout.bachs.io/chk_frac'
        }),
        { status: 200 }
      );
    }) as any;

    const gateway = new BachsGateway({ apiKey: 'sk_live_key' });
    await gateway.initiateTransaction('pos@domain.com', 125.5, 'plan-2', 'pay-2');

    assert.equal(capturedBody.pricing.amount, '125.50');
    assert.deepEqual(capturedBody.payment_method_types, ['NGN_CARD', 'NGN_USSD']);
    assert.equal(capturedBody.reference, 'pay-2');
  });

  test('throws when checkout session creation returns non-ok HTTP status', async () => {
    globalThis.fetch = (async () => {
      return new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
    }) as any;

    const gateway = new BachsGateway();
    await assert.rejects(
      () => gateway.initiateTransaction('fail@domain.com', 100, 'plan-1', 'pay-1'),
      /Failed to initialize Bachs checkout session: Bad Request/
    );
  });
});

describe('BachsGateway - verifyTransaction', () => {
  const apiKey = 'sk_sandbox_verify_key';
  const originalEnv = process.env;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      MOCK_SERVICES: 'false',
      BACHS_API_KEY: apiKey
    };
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  test('queries checkout session and maps PAID to success', async () => {
    let capturedUrl = '';
    let capturedInit: any;

    globalThis.fetch = (async (url: any, init?: any) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return new Response(
        JSON.stringify({
          checkout_id: 'chk/with/slash',
          status: 'PAID',
          pricing: { currency: 'NGN', amount: '750.00' },
          paid_at: '2026-11-25T10:00:00Z',
          metadata: { paymentId: 'pay-750' }
        }),
        { status: 200 }
      );
    }) as any;

    const gateway = new BachsGateway();
    const result = await gateway.verifyTransaction('chk/with/slash');

    assert.equal(capturedUrl, 'https://sandbox-api.bachs.io/v1/checkout-sessions/chk%2Fwith%2Fslash');
    assert.equal(capturedInit?.method, 'GET');
    assert.equal(capturedInit?.headers?.['Authorization'], `Bearer ${apiKey}`);

    assert.equal(result.status, 'success');
    assert.equal(result.amount, 750);
    assert.equal(result.reference, 'chk/with/slash');
    assert.equal(result.paidAt, '2026-11-25T10:00:00Z');
    assert.deepEqual(result.metadata, { paymentId: 'pay-750' });
  });

  test('maps EXPIRED and FAILED to failed, and other statuses to pending', async () => {
    const cases: Array<[string, string]> = [
      ['EXPIRED', 'failed'],
      ['FAILED', 'failed'],
      ['OPEN', 'pending'],
      ['PENDING', 'pending'],
      ['PROCESSING', 'pending']
    ];

    const gateway = new BachsGateway();

    for (const [remoteStatus, expectedStatus] of cases) {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            checkout_id: 'chk_status',
            status: remoteStatus,
            pricing: { currency: 'NGN', amount: '100.00' }
          }),
          { status: 200 }
        );
      }) as any;

      const result = await gateway.verifyTransaction('chk_status');
      assert.equal(result.status, expectedStatus, `Expected ${remoteStatus} -> ${expectedStatus}`);
      assert.equal(result.amount, 100);
    }
  });

  test('throws when verification request returns non-ok HTTP status', async () => {
    globalThis.fetch = (async () => {
      return new Response('Not Found', { status: 404, statusText: 'Not Found' });
    }) as any;

    const gateway = new BachsGateway();
    await assert.rejects(
      () => gateway.verifyTransaction('chk_missing'),
      /Failed to verify Bachs checkout session: Not Found/
    );
  });
});

describe('BachsGateway - verifyWebhookSignature', () => {
  const apiKey = 'sk_sandbox_webhook_key';
  const webhookSecret = 'whsec_test_secret_123';
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      MOCK_SERVICES: 'false',
      BACHS_API_KEY: apiKey,
      BACHS_WEBHOOK_SECRET: webhookSecret
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function sign(rawBody: string | Buffer, timestamp: string, secret: string = webhookSecret): string {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    return crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${bodyStr}`)
      .digest('hex');
  }

  test('validates HMAC-SHA256 over "{timestamp}.{rawBody}" for string and Buffer payloads', () => {
    const gateway = new BachsGateway();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify({ event: 'collection.succeeded', data: { checkout_id: 'chk_1' } });
    const signature = sign(rawBody, timestamp);

    assert.equal(gateway.verifyWebhookSignature(rawBody, signature, timestamp), true);
    assert.equal(gateway.verifySignature(rawBody, signature, timestamp), true);
    assert.equal(gateway.verifyWebhookSignature(Buffer.from(rawBody, 'utf8'), signature, timestamp), true);
  });

  test('rejects invalid signatures, missing headers, or missing webhook secret', () => {
    const gateway = new BachsGateway();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify({ event: 'checkout.completed' });
    const validSig = sign(rawBody, timestamp);

    assert.equal(gateway.verifyWebhookSignature(rawBody, 'tampered_sig', timestamp), false);
    assert.equal(gateway.verifyWebhookSignature(rawBody, '', timestamp), false);
    assert.equal(gateway.verifyWebhookSignature(rawBody, validSig, undefined), false);
    assert.equal(gateway.verifyWebhookSignature(rawBody, validSig, ''), false);
    assert.equal(gateway.verifyWebhookSignature(rawBody, validSig, 'not-a-number'), false);

    delete process.env.BACHS_WEBHOOK_SECRET;
    assert.equal(gateway.verifyWebhookSignature(rawBody, validSig, timestamp), false);
  });

  test('rejects requests outside 300-second timestamp tolerance window', () => {
    const gateway = new BachsGateway();
    const nowSec = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify({ event: 'collection.succeeded' });

    const expiredTimestamp = String(nowSec - 301);
    assert.equal(
      gateway.verifyWebhookSignature(rawBody, sign(rawBody, expiredTimestamp), expiredTimestamp),
      false
    );

    const futureTimestamp = String(nowSec + 301);
    assert.equal(
      gateway.verifyWebhookSignature(rawBody, sign(rawBody, futureTimestamp), futureTimestamp),
      false
    );

    const withinPast = String(nowSec - 299);
    assert.equal(
      gateway.verifyWebhookSignature(rawBody, sign(rawBody, withinPast), withinPast),
      true
    );

    const withinFuture = String(nowSec + 299);
    assert.equal(
      gateway.verifyWebhookSignature(rawBody, sign(rawBody, withinFuture), withinFuture),
      true
    );
  });
});
