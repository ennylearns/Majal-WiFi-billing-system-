import { PrismaClient } from '@prisma/client';
import { PaymentGateway, PaystackGateway } from './paymentGateway';
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

// ---------------------------------------------------------------------------
// PaymentService
// ---------------------------------------------------------------------------

export class PaymentService {
  private prisma: PrismaClient;
  private gateway: PaymentGateway;

  constructor(
    prismaClient: PrismaClient = defaultPrisma,
    gateway: PaymentGateway = new PaystackGateway()
  ) {
    this.prisma = prismaClient;
    this.gateway = gateway;
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
    //    synthesise a placeholder from the phone number as a last resort.
    const gatewayEmail =
      email ||
      user.email ||
      `${phone!.replace(/\D/g, '')}@guest.collospot.com`;

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
      paymentId: payment.id,
    });

    // 6. Stamp the gateway reference onto the payment record.
    await this.prisma.payment.update({
      where: { id: payment.id },
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

