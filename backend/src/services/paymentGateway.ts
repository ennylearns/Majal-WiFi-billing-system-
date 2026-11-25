import crypto from 'crypto';

export interface InitiatePaymentParams {
  email: string;
  amount: number;
  planId: string;
  paymentId: string;
  metadata?: Record<string, any>;
}

export interface InitiatePaymentResult {
  reference: string;
  access_code: string;
  accessCode?: string;
  authorization_url?: string;
  checkoutUrl?: string;
}

export interface VerifyPaymentResult {
  status: string;
  amount: number;
  reference?: string;
  paidAt?: Date | string;
  metadata?: Record<string, any>;
}

export interface PaymentGateway {
  initiateTransaction(
    paramsOrEmail: InitiatePaymentParams | string,
    amount?: number,
    planId?: string,
    paymentId?: string,
    metadata?: Record<string, any>
  ): Promise<InitiatePaymentResult>;

  verifyTransaction(reference: string): Promise<VerifyPaymentResult>;

  verifyWebhookSignature(rawBody: string | Buffer | any, signature: string, timestamp?: string): boolean;
  verifySignature?(rawBody: string | Buffer | any, signature: string, timestamp?: string): boolean;
}

export function parseInitiatePaymentParams(
  paramsOrEmail: InitiatePaymentParams | string,
  amount?: number,
  planId?: string,
  paymentId?: string,
  metadata?: Record<string, any>
): InitiatePaymentParams {
  if (typeof paramsOrEmail === 'object') {
    return paramsOrEmail;
  }
  return {
    email: paramsOrEmail,
    amount: amount ?? 0,
    planId: planId ?? '',
    paymentId: paymentId ?? '',
    metadata
  };
}

export function createInitiatePaymentResult(
  reference: string,
  accessCode: string,
  authorizationUrl?: string
): InitiatePaymentResult {
  const result: InitiatePaymentResult = {
    reference,
    access_code: accessCode,
    ...(authorizationUrl ? { authorization_url: authorizationUrl } : {})
  };

  Object.defineProperty(result, 'accessCode', {
    get() {
      return this.access_code;
    },
    enumerable: false
  });

  Object.defineProperty(result, 'checkoutUrl', {
    get() {
      return this.authorization_url;
    },
    enumerable: false
  });

  return result;
}

export interface FakePaymentGatewayOptions {
  secretKey?: string;
  defaultStatus?: string;
  referencePrefix?: string;
}

export class FakePaymentGateway implements PaymentGateway {
  private secretKey: string;
  private referencePrefix: string;
  private referenceCounter = 0;
  private defaultStatus: string;

  public initiatedPayments: InitiatePaymentParams[] = [];
  public verifiedReferences: string[] = [];
  public transactions = new Map<string, VerifyPaymentResult>();

  private failInitiationsError: Error | null = null;
  private failVerificationError: Error | null = null;
  private queuedInitiationResults: InitiatePaymentResult[] = [];
  private forcedSignatureValidity: boolean | null = null;

  constructor(options: FakePaymentGatewayOptions = {}) {
    this.secretKey = options.secretKey || 'fake_webhook_secret';
    this.referencePrefix = options.referencePrefix || 'fake_ref_';
    this.defaultStatus = options.defaultStatus || 'success';
  }

  setFailInitiations(error: Error | string | null): void {
    if (typeof error === 'string') {
      this.failInitiationsError = new Error(error);
    } else {
      this.failInitiationsError = error;
    }
  }

  setFailVerification(error: Error | string | null): void {
    if (typeof error === 'string') {
      this.failVerificationError = new Error(error);
    } else {
      this.failVerificationError = error;
    }
  }

  queueInitiationResult(result: Partial<InitiatePaymentResult> & { reference?: string; access_code?: string }): void {
    const reference = result.reference || `${this.referencePrefix}${++this.referenceCounter}`;
    const accessCode = result.access_code || `fake_code_${this.referenceCounter}`;
    this.queuedInitiationResults.push(
      createInitiatePaymentResult(reference, accessCode, result.authorization_url)
    );
  }

  setTransactionStatus(
    reference: string,
    resultOrStatus: Partial<VerifyPaymentResult> | string,
    amount?: number
  ): void {
    if (typeof resultOrStatus === 'string') {
      const existing = this.transactions.get(reference);
      this.transactions.set(reference, {
        status: resultOrStatus,
        amount: amount ?? existing?.amount ?? 10000,
        reference
      });
    } else {
      const existing = this.transactions.get(reference);
      this.transactions.set(reference, {
        status: resultOrStatus.status ?? existing?.status ?? this.defaultStatus,
        amount: resultOrStatus.amount ?? existing?.amount ?? 10000,
        reference,
        ...resultOrStatus
      });
    }
  }

  setSignatureValid(isValid: boolean | null): void {
    this.forcedSignatureValidity = isValid;
  }

  createWebhookSignature(rawBody: string | Buffer | any): string {
    const payload = typeof rawBody === 'string' || Buffer.isBuffer(rawBody)
      ? rawBody
      : JSON.stringify(rawBody);

    return crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');
  }

  verifyWebhookSignature(rawBody: string | Buffer | any, signature: string): boolean {
    if (!signature) {
      return false;
    }
    if (this.forcedSignatureValidity !== null) {
      return this.forcedSignatureValidity;
    }

    const payload = typeof rawBody === 'string' || Buffer.isBuffer(rawBody)
      ? rawBody
      : JSON.stringify(rawBody);

    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  verifySignature(rawBody: string | Buffer | any, signature: string): boolean {
    return this.verifyWebhookSignature(rawBody, signature);
  }

  async initiateTransaction(
    paramsOrEmail: InitiatePaymentParams | string,
    amount?: number,
    planId?: string,
    paymentId?: string,
    metadata?: Record<string, any>
  ): Promise<InitiatePaymentResult> {
    const params = parseInitiatePaymentParams(paramsOrEmail, amount, planId, paymentId, metadata);
    this.initiatedPayments.push(params);

    if (this.failInitiationsError) {
      throw this.failInitiationsError;
    }

    if (this.queuedInitiationResults.length > 0) {
      const next = this.queuedInitiationResults.shift()!;
      this.transactions.set(next.reference, {
        status: this.defaultStatus,
        amount: Math.round(params.amount * 100),
        reference: next.reference
      });
      return next;
    }

    this.referenceCounter++;
    const reference = `${this.referencePrefix}${this.referenceCounter}`;
    const accessCode = `fake_code_${this.referenceCounter}`;
    const authorizationUrl = `https://checkout.fake-gateway.local/${accessCode}`;

    this.transactions.set(reference, {
      status: this.defaultStatus,
      amount: Math.round(params.amount * 100),
      reference
    });

    return createInitiatePaymentResult(reference, accessCode, authorizationUrl);
  }

  async verifyTransaction(reference: string): Promise<VerifyPaymentResult> {
    this.verifiedReferences.push(reference);

    if (this.failVerificationError) {
      throw this.failVerificationError;
    }

    const existing = this.transactions.get(reference);
    if (existing) {
      return { ...existing };
    }

    return {
      status: this.defaultStatus,
      amount: 10000,
      reference
    };
  }

  getLastInitiatedPayment(): InitiatePaymentParams | undefined {
    return this.initiatedPayments[this.initiatedPayments.length - 1];
  }

  reset(): void {
    this.referenceCounter = 0;
    this.initiatedPayments = [];
    this.verifiedReferences = [];
    this.transactions.clear();
    this.failInitiationsError = null;
    this.failVerificationError = null;
    this.queuedInitiationResults = [];
    this.forcedSignatureValidity = null;
  }

  clear(): void {
    this.reset();
  }
}

export interface BachsGatewayOptions {
  apiKey?: string;
  webhookSecret?: string;
  baseURL?: string;
  paymentMethods?: string[];
}

export class BachsGateway implements PaymentGateway {
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly configuredWebhookSecret?: string;
  private readonly configuredPaymentMethods?: string[];

  constructor(options: BachsGatewayOptions = {}) {
    const isMockMode = process.env.MOCK_SERVICES === 'true';
    const apiKey = options.apiKey ?? process.env.BACHS_API_KEY ?? '';

    if (!isMockMode) {
      if (!apiKey) {
        throw new Error('BACHS_API_KEY is required in non-mock mode');
      }
      if (!apiKey.startsWith('sk_sandbox_') && !apiKey.startsWith('sk_live_')) {
        throw new Error('Invalid BACHS_API_KEY: must start with sk_sandbox_ or sk_live_');
      }
    }

    this.apiKey = apiKey;
    this.configuredWebhookSecret = options.webhookSecret;
    this.configuredPaymentMethods = options.paymentMethods;

    if (options.baseURL) {
      this.baseURL = options.baseURL;
    } else if (apiKey.startsWith('sk_live_')) {
      this.baseURL = 'https://api.bachs.io';
    } else {
      this.baseURL = 'https://sandbox-api.bachs.io';
    }
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  private get webhookSecret(): string {
    return (
      this.configuredWebhookSecret ??
      process.env.BACHS_WEBHOOK_SECRET ??
      (process.env.MOCK_SERVICES === 'true' ? 'mock_bachs_webhook_secret' : '')
    );
  }

  createWebhookSignature(rawBody: string | Buffer | any, timestamp: string): string {
    const payload = Buffer.isBuffer(rawBody)
      ? rawBody.toString('utf8')
      : typeof rawBody === 'string'
        ? rawBody
        : JSON.stringify(rawBody);

    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
  }

  verifyWebhookSignature(rawBody: string | Buffer | any, signature: string, timestamp?: string): boolean {
    const secret = this.webhookSecret;
    if (!signature || !timestamp || !secret) {
      return false;
    }

    const parsedTimestamp = Number(timestamp);
    if (!Number.isFinite(parsedTimestamp)) {
      return false;
    }

    if (Math.abs(Date.now() / 1000 - parsedTimestamp) > 300) {
      return false;
    }

    const payload = Buffer.isBuffer(rawBody)
      ? rawBody.toString('utf8')
      : typeof rawBody === 'string'
        ? rawBody
        : JSON.stringify(rawBody);

    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedHash, 'utf8');
    const actualBuffer = Buffer.from(signature, 'utf8');
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  }

  verifySignature(rawBody: string | Buffer | any, signature: string, timestamp?: string): boolean {
    return this.verifyWebhookSignature(rawBody, signature, timestamp);
  }

  private get paymentMethods(): string[] {
    if (this.configuredPaymentMethods && this.configuredPaymentMethods.length > 0) {
      return this.configuredPaymentMethods;
    }
    const envMethods = process.env.BACHS_PAYMENT_METHODS;
    if (envMethods) {
      const parsed = envMethods.split(',').map((m) => m.trim()).filter(Boolean);
      if (parsed.length > 0) {
        return parsed;
      }
    }
    return ['NGN_CARD', 'NGN_BANK_TRANSFER'];
  }

  async initiateTransaction(
    paramsOrEmail: InitiatePaymentParams | string,
    amount?: number,
    planId?: string,
    paymentId?: string,
    metadata?: Record<string, any>
  ): Promise<InitiatePaymentResult> {
    const params = parseInitiatePaymentParams(paramsOrEmail, amount, planId, paymentId, metadata);

    if (process.env.MOCK_SERVICES === 'true') {
      const mockReference = `chk_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return createInitiatePaymentResult(
        mockReference,
        mockReference,
        `https://checkout.bachs.io/mock/${mockReference}`
      );
    }

    const response = await fetch(`${this.baseURL}/v1/checkout-sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pricing: {
          currency: 'NGN',
          amount: params.amount.toFixed(2)
        },
        billing_currency: 'NGN',
        payment_method_types: this.paymentMethods,
        customer_creation: 'if_required',
        customer: { email: params.email },
        reference: params.paymentId,
        metadata: {
          paymentId: params.paymentId,
          planId: params.planId,
          ...(params.metadata || {})
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize Bachs checkout session: ${response.statusText}`);
    }

    const data: any = await response.json();
    const payload = data.data ?? data;

    return createInitiatePaymentResult(
      payload.checkout_id,
      payload.checkout_id,
      payload.checkout_url
    );
  }

  async verifyTransaction(reference: string): Promise<VerifyPaymentResult> {
    if (process.env.MOCK_SERVICES === 'true') {
      return {
        status: 'pending',
        amount: 0,
        reference
      };
    }

    const response = await fetch(
      `${this.baseURL}/v1/checkout-sessions/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to verify Bachs checkout session: ${response.statusText}`);
    }

    const data: any = await response.json();
    const payload = data.data ?? data;

    let status = 'pending';
    if (payload.status === 'PAID') {
      status = 'success';
    } else if (payload.status === 'EXPIRED' || payload.status === 'FAILED') {
      status = 'failed';
    }

    const amount = Number(payload.pricing?.amount ?? payload.amount ?? 0);

    return {
      status,
      amount,
      reference: payload.checkout_id || reference,
      paidAt: payload.paid_at,
      metadata: payload.metadata
    };
  }
}

