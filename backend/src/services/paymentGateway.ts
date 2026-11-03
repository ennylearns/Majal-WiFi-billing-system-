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

  verifyWebhookSignature(rawBody: string | Buffer | any, signature: string): boolean;
  verifySignature?(rawBody: string | Buffer | any, signature: string): boolean;
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

export interface PaystackGatewayOptions {
  secretKey?: string;
  baseURL?: string;
}

export class PaystackGateway implements PaymentGateway {
  private baseURL: string;
  private configuredSecretKey?: string;

  constructor(options: PaystackGatewayOptions = {}) {
    this.baseURL = options.baseURL || 'https://api.paystack.co';
    this.configuredSecretKey = options.secretKey;
  }

  private get secretKey(): string {
    return this.configuredSecretKey || process.env.PAYSTACK_SECRET_KEY || '';
  }

  verifyWebhookSignature(rawBody: string | Buffer | any, signature: string): boolean {
    if (!signature) {
      return false;
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

    if (process.env.NODE_ENV === 'development') {
      const mockReference = 'mock_ref_' + Date.now();
      const mockAccessCode = 'mock_code_' + Date.now();

      return createInitiatePaymentResult(
        mockReference,
        mockAccessCode,
        `https://checkout.paystack.com/${mockAccessCode}`
      );
    }

    const amountInKobo = Math.round(params.amount * 100);

    const response = await fetch(`${this.baseURL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: params.email,
        amount: amountInKobo,
        currency: 'NGN',
        metadata: {
          planId: params.planId,
          paymentId: params.paymentId,
          ...(params.metadata || {})
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize Paystack transaction: ${response.statusText}`);
    }

    const data: any = await response.json();
    return createInitiatePaymentResult(
      data.data.reference,
      data.data.access_code,
      data.data.authorization_url
    );
  }

  async verifyTransaction(reference: string): Promise<VerifyPaymentResult> {
    if (reference.startsWith('mock_ref_')) {
      return {
        status: 'success',
        amount: 10000,
        reference
      };
    }

    const response = await fetch(`${this.baseURL}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to verify Paystack transaction: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      status: data.data.status,
      amount: data.data.amount,
      reference: data.data.reference,
      paidAt: data.data.paid_at,
      metadata: data.data.metadata
    };
  }
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
    this.secretKey = options.secretKey || 'fake_paystack_secret_key';
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

export const paystackGateway = new PaystackGateway();
export default paystackGateway;

