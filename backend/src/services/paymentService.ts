import { PrismaClient } from '@prisma/client';
import { PaymentGateway, PaystackGateway } from './paymentGateway';
import sessionServiceInstance, { SessionService } from './sessionService';
import smsServiceInstance from './smsService';
import { prisma as defaultPrisma } from '../database/db';

// Minimal shape returned by Prisma user queries used inside this service.
interface ResolvedUser {
  id: string;
  email: string | null;
  phone: string | null;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface InitiatePaymentParams {
  /** Plan to purchase. */
  planId: string;
  /** Amount in the plan's base currency unit (e.g. NGN). */
  amount: number;
  /** Customer phone number. At least one of phone/email must be provided. */
  phone?: string;
  /** Customer email. At least one of phone/email must be provided. */
  email?: string;
}

export interface InitiatePaymentResult {
  /** Gateway checkout reference (stored as checkoutRequestId on the payment). */
  reference: string;
  /** Gateway access code for the checkout session. */
  access_code: string;
  /** Hosted checkout URL, if the gateway provides one. */
  authorization_url?: string;
}

export interface CheckStatusResult {
  status: string;
  amount?: number;
  sessionToken?: string;
  payment?: any;
}

export interface FulfillPaymentResult {
  payment: any;
  sessionToken?: string;
  alreadyFulfilled: boolean;
}

export interface ListPaymentsParams {
  page?: number | string;
  limit?: number | string;
  status?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  search?: string;
}

export interface ListPaymentsResult {
  payments: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface SessionServiceLike {
  createSession(userId: string, planId: string, sessionToken: string): Promise<any>;
}

export interface SmsServiceLike {
  sendPaymentConfirmation(phone: string, amount: number, receiptNumber: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// PaymentService
// ---------------------------------------------------------------------------

export class PaymentService {
  private prisma: PrismaClient;
  private gateway: PaymentGateway;
  private sessionService: SessionServiceLike;
  private smsService: SmsServiceLike;
  private inFlightFulfillments = new Map<string, Promise<FulfillPaymentResult>>();

  constructor(
    prismaClient: PrismaClient = defaultPrisma,
    gateway: PaymentGateway = new PaystackGateway(),
    sessionService: SessionServiceLike = sessionServiceInstance,
    smsService: SmsServiceLike = smsServiceInstance
  ) {
    this.prisma = prismaClient;
    this.gateway = gateway;
    this.sessionService = sessionService;
    this.smsService = smsService;
  }

  /**
   * Initiate a payment for a plan.
   *
   * Resolves or provisions a guest customer from the supplied contact details,
   * creates a PENDING payment record, calls the gateway, and stamps the returned
   * reference onto the payment record before returning the authorization details.
   */
  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const { planId, amount, phone, email } = params;

    // 0. Guard: at least one contact field is required.
    if (!phone && !email) {
      throw new Error('At least one of phone or email must be provided');
    }

    // 1. Validate plan is active.
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !(plan as any).isActive) {
      throw new Error('Plan not found or inactive');
    }

    // 2. Resolve or create guest customer.
    const user = await this.resolveOrCreateGuest({ phone, email });

    // 3. Derive the email that will be forwarded to the payment gateway.
    //    Prefer the supplied email; fall back to the user's stored email;
    //    synthesise a placeholder from the user's phone (real or synthetic) as a last resort.
    const resolvedPhone = phone ?? user.phone ?? '';
    const gatewayEmail =
      email ||
      user.email ||
      `${resolvedPhone.replace(/\D/g, '')}@guest.collospot.com`;

    // 4. Create the pending payment record.
    const payment = await this.prisma.payment.create({
      data: {
        userId: user.id,
        planId,
        amount,
        status: 'PENDING',
      },
    });
    // 5. Call the gateway to obtain a checkout reference.
    const gatewayResult = await this.gateway.initiateTransaction({
      email: gatewayEmail,
      amount,
      planId,
      paymentId: (payment as any).id,
    });

    // 6. Stamp the gateway reference onto the payment record.
    await this.prisma.payment.update({
      where: { id: (payment as any).id },
      data: { checkoutRequestId: gatewayResult.reference },
    });

    return {
      reference: gatewayResult.reference,
      access_code: gatewayResult.access_code,
      ...(gatewayResult.authorization_url
        ? { authorization_url: gatewayResult.authorization_url }
        : {}),
    };
  }

  /**
   * Handle incoming payment gateway webhooks.
   *
   * Verifies the cryptographic HMAC signature, parses the payload, and
   * triggers atomic fulfillment for successful charge events.
   */
  async handleWebhook(
    rawBody: string | Buffer | any,
    signature: string
  ): Promise<{ received: boolean }> {
    const isValid = this.gateway.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    const payload =
      typeof rawBody === 'string' || Buffer.isBuffer(rawBody)
        ? JSON.parse(rawBody.toString())
        : rawBody;

    if (payload.event === 'charge.success') {
      const reference = payload.data?.reference;
      const paymentId = payload.data?.metadata?.paymentId;

      if (reference) {
        try {
          await this.fulfillPayment(reference);
          return { received: true };
        } catch (err: any) {
          if (err.message !== 'Payment not found' || !paymentId) {
            throw err;
          }
        }
      }

      if (paymentId) {
        await this.fulfillPayment(paymentId, reference);
      }
    }

    return { received: true };
  }

  /**
   * Check payment status by checkout reference or payment ID.
   *
   * If the payment is still PENDING in the database, queries the payment gateway.
   * If the gateway confirms settlement, fulfills the payment and returns the active session token.
   */
  async checkStatus(reference: string): Promise<CheckStatusResult> {
    const payment = await this.findPayment(reference);

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'COMPLETED') {
      // Best-effort fulfillment (idempotent): if it fails, still return completed status.
      try {
        const fulfillment = await this.fulfillPayment(reference);
        return {
          status: 'completed',
          amount: payment.amount,
          sessionToken: fulfillment.sessionToken,
          payment: fulfillment.payment,
        };
      } catch {
        return { status: 'completed', amount: payment.amount, payment };
      }
    }

    // Payment is pending - query gateway
    const verifyResult = await this.gateway.verifyTransaction(reference);
    if (verifyResult.status === 'success') {
      // Best-effort fulfillment: if session provisioning fails (e.g. router offline),
      // report the payment as completed — the session can be retried later.
      try {
        const fulfillment = await this.fulfillPayment(reference);
        return {
          status: 'completed',
          amount: payment.amount,
          sessionToken: fulfillment.sessionToken,
          payment: fulfillment.payment,
        };
      } catch {
        // Re-read from DB so we return the latest persisted status.
        const refreshed = await this.findPayment(reference);
        return {
          status: (refreshed?.status ?? payment.status).toLowerCase(),
          amount: payment.amount,
          payment: refreshed ?? payment,
        };
      }
    }

    return {
      status: payment.status.toLowerCase(),
      amount: payment.amount,
      payment,
    };
  }

  /**
   * Atomically and idempotently fulfill a payment.
   *
   * Uses in-flight deduplication and an atomic database check-and-set
   * (PENDING -> COMPLETED). Exactly one execution provisions a network session
   * and sends an SMS receipt. Concurrent and duplicate calls return the active
   * session safely.
   */
  async fulfillPayment(
    referenceOrId: string,
    gatewayReference?: string
  ): Promise<FulfillPaymentResult> {
    const payment = await this.findPayment(referenceOrId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    const dedupeKey = payment.id;
    const inFlight = this.inFlightFulfillments.get(dedupeKey);
    if (inFlight) {
      return await inFlight;
    }

    const promise = (async () => {
      try {
        return await this.doFulfillPayment(payment, referenceOrId, gatewayReference);
      } finally {
        this.inFlightFulfillments.delete(dedupeKey);
      }
    })();

    this.inFlightFulfillments.set(dedupeKey, promise);
    return await promise;
  }

  private async doFulfillPayment(
    payment: any,
    referenceOrId: string,
    gatewayReference?: string
  ): Promise<FulfillPaymentResult> {
    const finalReference =
      gatewayReference || payment.paymentReference || payment.checkoutRequestId || referenceOrId;

    if (payment.status === 'COMPLETED') {
      const existingSession = await this.findActiveSession(payment.userId, payment.planId);

      return {
        payment,
        sessionToken: existingSession?.sessionToken,
        alreadyFulfilled: true,
      };
    }

    // Attempt atomic conditional transition: PENDING -> COMPLETED
    let transitioned = false;
    const performTransition = async (txPrisma: any) => {
      const result = await txPrisma.payment.updateMany({
        where: {
          id: payment.id,
          status: 'PENDING',
        },
        data: {
          status: 'COMPLETED',
          paymentReference: finalReference,
        },
      });
      return result.count > 0;
    };

    if (typeof (this.prisma as any).$transaction === 'function') {
      transitioned = await (this.prisma as any).$transaction(async (tx: any) =>
        performTransition(tx)
      );
    } else {
      transitioned = await performTransition(this.prisma);
    }

    if (!transitioned) {
      // Lost the race or already transitioned concurrently
      const existingSession = await this.findActiveSession(payment.userId, payment.planId);

      return {
        payment: {
          ...payment,
          status: 'COMPLETED',
          paymentReference: finalReference,
        },
        sessionToken: existingSession?.sessionToken,
        alreadyFulfilled: true,
      };
    }

    // Winner of the transition: provision network session and dispatch receipt SMS
    let existingSession = await this.findActiveSession(payment.userId, payment.planId);

    let sessionToken = existingSession?.sessionToken;
    if (!sessionToken) {
      sessionToken = this.generateSessionToken();
      await this.sessionService.createSession(
        payment.userId,
        payment.planId,
        sessionToken
      );
    }

    const phone = payment.user?.phone;
    if (phone && this.smsService?.sendPaymentConfirmation) {
      try {
        await this.smsService.sendPaymentConfirmation(
          phone,
          payment.amount,
          finalReference
        );
      } catch (err) {
        console.error('Failed to dispatch payment confirmation SMS:', err);
      }
    }

    return {
      payment: {
        ...payment,
        status: 'COMPLETED',
        paymentReference: finalReference,
      },
      sessionToken,
      alreadyFulfilled: false,
    };
  }

  private async findPayment(referenceOrId: string) {
    return this.prisma.payment.findFirst({
      where: {
        OR: [
          { checkoutRequestId: referenceOrId },
          { paymentReference: referenceOrId },
          { id: referenceOrId },
        ],
      },
      include: { user: true, plan: true },
    });
  }

  private async findActiveSession(userId: string, planId: string) {
    return this.prisma.session.findFirst({
      where: {
        userId,
        planId,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Retrieve payment history for an authenticated customer,
   * scoped to their user ID, ordered by date descending, including plan name and duration.
   */
  async getUserPayments(userId: string): Promise<any[]> {
    return this.prisma.payment.findMany({
      where: { userId },
      include: {
        plan: {
          select: {
            name: true,
            duration: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieve a single payment record scoped to the authenticated customer ID,
   * including complete plan details.
   */
  async getUserPaymentById(userId: string, paymentId: string): Promise<any | null> {
    return this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId,
      },
      include: {
        plan: true,
      },
    });
  }

  /**
   * Administrative payment listing query supporting pagination, status filtering,
   * date range filtering, and customer search across user profile fields.
   */
  async listPayments(params: ListPaymentsParams = {}): Promise<ListPaymentsResult> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        const start = new Date(params.startDate);
        if (!isNaN(start.getTime())) {
          where.createdAt.gte = start;
        }
      }
      if (params.endDate) {
        let endStr =
          typeof params.endDate === 'string'
            ? params.endDate
            : params.endDate.toISOString();
        if (/^\d{4}-\d{2}-\d{2}$/.test(endStr)) {
          endStr = `${endStr}T23:59:59.999Z`;
        }
        const end = new Date(endStr);
        if (!isNaN(end.getTime())) {
          where.createdAt.lte = end;
        }
      }
    }

    if (params.search) {
      where.user = {
        OR: [
          { phone: { contains: params.search } },
          { email: { contains: params.search } },
          { firstName: { contains: params.search } },
          { lastName: { contains: params.search } },
        ],
      };
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              phone: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          plan: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Generate random alphanumeric token for router hotspot session.
   */
  generateSessionToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Find an existing customer by phone or email; if none is found, create a
   * guest customer record using whichever contact detail was supplied.
   *
   * A synthesised phone number is used when only an email is provided, so the
   * NOT NULL `phone` column constraint is always satisfied.
   */
  private async resolveOrCreateGuest(contact: {
    phone?: string;
    email?: string;
  }): Promise<ResolvedUser> {
    const { phone, email } = contact;

    const orClauses: any[] = [];
    if (phone) orClauses.push({ phone });
    if (email) orClauses.push({ email });

    if (orClauses.length > 0) {
      const existing = await this.prisma.user.findFirst({
        where: { OR: orClauses },
        select: { id: true, email: true, phone: true },
      });
      if (existing) return existing;
    }

    const syntheticPhone =
      phone ?? `+000${Date.now()}${Math.floor(Math.random() * 10000)}`;

    return this.prisma.user.create({
      data: {
        phone: syntheticPhone,
        email: email ?? undefined,
        role: 'CUSTOMER',
      },
      select: { id: true, email: true, phone: true },
    });
  }
}

export default new PaymentService();

