import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  PaymentGateway,
  BachsGateway,
  FakePaymentGateway,
  parseInitiatePaymentParams,
  createInitiatePaymentResult
} from '../paymentGateway';

describe('PaymentGateway - Parameter Parsing & Result Creation', () => {
  test('parseInitiatePaymentParams handles object argument', () => {
    const params = {
      email: 'guest@example.com',
      amount: 250,
      planId: 'plan-abc',
      paymentId: 'pay-xyz',
      metadata: { source: 'portal' }
    };
    const parsed = parseInitiatePaymentParams(params);
    assert.deepEqual(parsed, params);
  });

  test('parseInitiatePaymentParams handles positional arguments', () => {
    const parsed = parseInitiatePaymentParams(
      'guest@example.com',
      350,
      'plan-123',
      'pay-456',
      { promo: 'WIFI' }
    );
    assert.deepEqual(parsed, {
      email: 'guest@example.com',
      amount: 350,
      planId: 'plan-123',
      paymentId: 'pay-456',
      metadata: { promo: 'WIFI' }
    });
  });

  test('createInitiatePaymentResult provides both snake_case and camelCase accessors', () => {
    const result = createInitiatePaymentResult(
      'ref_100',
      'code_200',
      'https://checkout.bachs.io/code_200'
    );

    assert.equal(result.reference, 'ref_100');
    assert.equal(result.access_code, 'code_200');
    assert.equal(result.accessCode, 'code_200');
    assert.equal(result.authorization_url, 'https://checkout.bachs.io/code_200');
    assert.equal(result.checkoutUrl, 'https://checkout.bachs.io/code_200');

    // Non-enumerable accessors do not pollute Object.keys
    assert.deepEqual(Object.keys(result).sort(), ['access_code', 'authorization_url', 'reference'].sort());
  });
});

describe('FakePaymentGateway - In-Memory Test Fake', () => {
  let fakeGateway: FakePaymentGateway;

  beforeEach(() => {
    fakeGateway = new FakePaymentGateway({
      secretKey: 'fake_secret_key',
      referencePrefix: 'test_ref_'
    });
  });

  test('generates deterministic sequential references and access codes by default', async () => {
    const res1 = await fakeGateway.initiateTransaction('u1@test.com', 100, 'plan-1', 'pay-1');
    const res2 = await fakeGateway.initiateTransaction('u2@test.com', 200, 'plan-2', 'pay-2');

    assert.equal(res1.reference, 'test_ref_1');
    assert.equal(res1.access_code, 'fake_code_1');
    assert.equal(res1.accessCode, 'fake_code_1');
    assert.ok(res1.authorization_url?.includes('fake_code_1'));

    assert.equal(res2.reference, 'test_ref_2');
    assert.equal(res2.access_code, 'fake_code_2');
    assert.equal(res2.accessCode, 'fake_code_2');
  });

  test('records all initiated transactions and parameters', async () => {
    await fakeGateway.initiateTransaction({
      email: 'recorded@test.com',
      amount: 300,
      planId: 'plan-rec',
      paymentId: 'pay-rec',
      metadata: { tag: 'vip' }
    });

    assert.equal(fakeGateway.initiatedPayments.length, 1);
    const last = fakeGateway.getLastInitiatedPayment();
    assert.deepEqual(last, {
      email: 'recorded@test.com',
      amount: 300,
      planId: 'plan-rec',
      paymentId: 'pay-rec',
      metadata: { tag: 'vip' }
    });
  });

  test('allows simulating initiation failures', async () => {
    fakeGateway.setFailInitiations('Gateway temporarily down');

    await assert.rejects(
      async () => {
        await fakeGateway.initiateTransaction('u@test.com', 100, 'p', 'pay');
      },
      {
        message: 'Gateway temporarily down'
      }
    );

    // Can clear failure
    fakeGateway.setFailInitiations(null);
    const res = await fakeGateway.initiateTransaction('u@test.com', 100, 'p', 'pay');
    assert.ok(res.reference);
  });

  test('supports queued predetermined initiation responses', async () => {
    fakeGateway.queueInitiationResult({
      reference: 'fixed_ref_abc',
      access_code: 'fixed_code_xyz',
      authorization_url: 'https://checkout.custom/xyz'
    });

    const res = await fakeGateway.initiateTransaction('u@test.com', 500, 'p', 'pay');
    assert.equal(res.reference, 'fixed_ref_abc');
    assert.equal(res.access_code, 'fixed_code_xyz');
    assert.equal(res.authorization_url, 'https://checkout.custom/xyz');
  });

  test('verifies initiated transactions and reflects configured status and amounts', async () => {
    const init = await fakeGateway.initiateTransaction('user@test.com', 50, 'plan-50', 'pay-50');

    // Default status for initiated transaction is success
    const verify1 = await fakeGateway.verifyTransaction(init.reference);
    assert.equal(verify1.status, 'success');
    assert.equal(verify1.amount, 5000); // 50 * 100 in kobo

    // Status can be modified per reference
    fakeGateway.setTransactionStatus(init.reference, { status: 'failed', amount: 5000 });
    const verify2 = await fakeGateway.verifyTransaction(init.reference);
    assert.equal(verify2.status, 'failed');

    // Recording of verification calls
    assert.deepEqual(fakeGateway.verifiedReferences, [init.reference, init.reference]);
  });

  test('allows simulating verification failures', async () => {
    fakeGateway.setFailVerification(new Error('Gateway verification service unavailable'));

    await assert.rejects(
      async () => {
        await fakeGateway.verifyTransaction('any_ref');
      },
      {
        message: 'Gateway verification service unavailable'
      }
    );
  });

  test('supports webhook signature generation and cryptographic verification', () => {
    const payload = JSON.stringify({ event: 'charge.success', reference: 'ref_fake' });
    const signature = fakeGateway.createWebhookSignature(payload);

    assert.equal(fakeGateway.verifyWebhookSignature(payload, signature), true);
    assert.equal(fakeGateway.verifySignature(payload, signature), true);
    assert.equal(fakeGateway.verifyWebhookSignature(payload, 'tampered_signature'), false);
    assert.equal(fakeGateway.verifyWebhookSignature(payload, ''), false);
  });

  test('allows forcing signature validity for testing rejection/acceptance independently of hash', () => {
    fakeGateway.setSignatureValid(false);
    assert.equal(fakeGateway.verifyWebhookSignature('payload', 'any_signature'), false);

    fakeGateway.setSignatureValid(true);
    assert.equal(fakeGateway.verifyWebhookSignature('payload', 'any_signature'), true);

    fakeGateway.setSignatureValid(null); // reverts to real HMAC check
  });

  test('reset clears all recorded calls and internal state', async () => {
    await fakeGateway.initiateTransaction('u@test.com', 10, 'p', 'pay');
    await fakeGateway.verifyTransaction('ref');
    fakeGateway.setFailInitiations('error');

    fakeGateway.reset();

    assert.equal(fakeGateway.initiatedPayments.length, 0);
    assert.equal(fakeGateway.verifiedReferences.length, 0);
    assert.equal(fakeGateway.transactions.size, 0);

    // Can initiate again starting from ref 1
    const res = await fakeGateway.initiateTransaction('u@test.com', 10, 'p', 'pay');
    assert.equal(res.reference, 'test_ref_1');
  });
});

describe('PaymentGateway - Polymorphism & Interface Interactivity', () => {
  // Test consumer that relies only on the PaymentGateway seam
  async function performCheckoutFlow(
    gateway: PaymentGateway,
    email: string,
    amount: number,
    signPayload: (payload: string, timestamp: string) => string
  ) {
    const init = await gateway.initiateTransaction({
      email,
      amount,
      planId: 'plan-test',
      paymentId: 'pay-test'
    });

    const verify = await gateway.verifyTransaction(init.reference);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const payload = JSON.stringify({ ref: init.reference });
    const signature = signPayload(payload, timestamp);

    const isValid = gateway.verifyWebhookSignature(payload, signature, timestamp);

    return { init, verify, isValid };
  }

  test('both BachsGateway and FakePaymentGateway satisfy the PaymentGateway seam', async () => {
    const fakeGateway = new FakePaymentGateway({ secretKey: 'shared_secret' });
    const fakeResult = await performCheckoutFlow(
      fakeGateway,
      'test@fake.com',
      100,
      (payload) =>
        crypto.createHmac('sha512', 'shared_secret').update(payload).digest('hex')
    );

    assert.ok(fakeResult.init.reference);
    assert.ok(fakeResult.init.access_code);
    assert.equal(fakeResult.verify.status, 'success');
    assert.equal(fakeResult.isValid, true);

    // Now test with BachsGateway with mocked fetch
    let fetchCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any) => {
      fetchCount++;
      const urlStr = url.toString();
      if (urlStr.includes('/v1/checkout-sessions') && fetchCount === 1) {
        return new Response(
          JSON.stringify({
            checkout_id: 'chk_real_1',
            checkout_url: 'https://checkout.bachs.io/chk_real_1'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          checkout_id: 'chk_real_1',
          status: 'PAID',
          pricing: { amount: 100 }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    try {
      const realGateway = new BachsGateway({
        apiKey: 'sk_sandbox_shared',
        webhookSecret: 'shared_secret'
      });
      const realResult = await performCheckoutFlow(
        realGateway,
        'test@real.com',
        100,
        (payload, timestamp) =>
          crypto.createHmac('sha256', 'shared_secret').update(`${timestamp}.${payload}`).digest('hex')
      );

      assert.equal(realResult.init.reference, 'chk_real_1');
      assert.equal(realResult.verify.status, 'success');
      assert.equal(realResult.isValid, true);
      assert.equal(fetchCount, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

