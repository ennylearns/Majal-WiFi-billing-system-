import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import sessionService, { SessionService } from './sessionService';
import { prisma as defaultPrisma } from '../database/db';
import { PaymentGateway, PaystackGateway } from './paymentGateway';

export interface InitiateTransactionResponse {
  reference: string;
  access_code: string;
}

export interface VerifyTransactionResponse {
  status: string;
  amount: number;
}

export class PaystackService {
  private baseURL = 'https://api.paystack.co';
  private prisma: PrismaClient;
  public sessionService: SessionService;
  public gateway: PaymentGateway;

  constructor(
    prismaClient: PrismaClient = defaultPrisma,
    sessionServiceInstance?: SessionService,
    gatewayInstance?: PaymentGateway
  ) {
    if (!process.env.PAYSTACK_SECRET_KEY && process.env.MOCK_SERVICES !== 'true') {
      throw new Error(
        'Missing PAYSTACK_SECRET_KEY. Set PAYSTACK_SECRET_KEY to a real Paystack secret, ' +
        'or set MOCK_SERVICES=true to enable mock mode for local development.'
      );
    }
    this.prisma = prismaClient;
    this.sessionService = sessionServiceInstance || sessionService;
    this.gateway = gatewayInstance || new PaystackGateway();
  }

  private get secretKey(): string {
    return process.env.PAYSTACK_SECRET_KEY || '';
  }

  verifySignature(rawBody: string | Buffer | any, signature: string): boolean {
    return this.gateway.verifyWebhookSignature(rawBody, signature);
  }

  async initiateTransaction(
    email: string,
    amount: number,
    planId: string,
    paymentId: string
  ): Promise<InitiateTransactionResponse> {
    if (process.env.MOCK_SERVICES === 'true') {
      const mockReference = 'mock_ref_' + Date.now();
      const mockAccessCode = 'mock_code_' + Date.now();

      // Simulate payment callback after 5 seconds
      const timer = setTimeout(async () => {
        await this.simulateWebhookCallback(mockReference, amount, planId, paymentId);
      }, 5000);
      if (timer && typeof timer.unref === 'function') {
        timer.unref();
      }

      return {
        reference: mockReference,
        access_code: mockAccessCode
      };
    }

    const result = await this.gateway.initiateTransaction(email, amount, planId, paymentId);
    return {
      reference: result.reference,
      access_code: result.access_code
    };
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResponse> {
    const result = await this.gateway.verifyTransaction(reference);
    return {
      status: result.status,
      amount: result.amount
    };
  }

  private async simulateWebhookCallback(
    reference: string,
    amount: number,
    planId: string,
    paymentId: string
  ): Promise<void> {
    try {
      const mockPayload = {
        event: 'charge.success',
        data: {
          reference,
          status: 'success',
          amount: Math.round(amount * 100),
          metadata: { planId, paymentId }
        }
      };
      const rawBody = JSON.stringify(mockPayload);
      const signature = typeof (this.gateway as any).createWebhookSignature === 'function'
        ? (this.gateway as any).createWebhookSignature(rawBody)
        : crypto
            .createHmac('sha512', this.secretKey)
            .update(rawBody)
            .digest('hex');

      await this.handleWebhook(rawBody, signature);
      console.log(`🎭 Mock Paystack payment completed for reference: ${reference}`);
    } catch (error) {
      console.error('Mock Paystack callback error:', error);
    }
  }

  generateSessionToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  async handleWebhook(rawBody: string | Buffer | any, signature: string): Promise<void> {
    if (!this.verifySignature(rawBody, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const payload = typeof rawBody === 'string' || Buffer.isBuffer(rawBody)
      ? JSON.parse(rawBody.toString())
      : rawBody;

    if (payload.event === 'charge.success') {
      const data = payload.data;
      const reference = data?.reference;
      const paymentId = data?.metadata?.paymentId;

      let payment: any = null;
      if (reference) {
        payment = await this.prisma.payment.findFirst({
          where: {
            OR: [
              { checkoutRequestId: reference },
              { paymentReference: reference }
            ]
          },
          include: { user: true, plan: true }
        });
      }

      if (!payment && paymentId) {
        payment = await this.prisma.payment.findUnique({
          where: { id: paymentId },
          include: { user: true, plan: true }
        });
      }

      if (payment) {
        if (payment.status === 'COMPLETED') {
          return;
        }

        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            paymentReference: reference
          }
        });

        const existingSession = await this.prisma.session.findFirst({
          where: {
            userId: payment.userId,
            planId: payment.planId,
            status: 'ACTIVE'
          }
        });

        if (!existingSession) {
          const sessionToken = this.generateSessionToken();
          await this.sessionService.createSession(payment.userId, payment.planId, sessionToken);
        }
      }
    }
  }
}

export default new PaystackService();
