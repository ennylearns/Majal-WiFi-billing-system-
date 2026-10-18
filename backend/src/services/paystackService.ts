import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

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

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  private get secretKey(): string {
    return process.env.PAYSTACK_SECRET_KEY || '';
  }

  verifySignature(rawBody: string | Buffer | any, signature: string): boolean {
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

  async initiateTransaction(
    email: string,
    amount: number,
    planId: string,
    paymentId: string
  ): Promise<InitiateTransactionResponse> {
    if (process.env.NODE_ENV === 'development') {
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

    const amountInKobo = Math.round(amount * 100);

    const response = await fetch(`${this.baseURL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        currency: 'NGN',
        metadata: {
          planId,
          paymentId
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize Paystack transaction: ${response.statusText}`);
    }

    const data: any = await response.json();
    return {
      reference: data.data.reference,
      access_code: data.data.access_code
    };
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResponse> {
    if (process.env.NODE_ENV === 'development' || reference.startsWith('mock_ref_')) {
      return {
        status: 'success',
        amount: 10000
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
      amount: data.data.amount
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
      const signature = crypto
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
          const durationHours = payment.plan?.duration || 1;
          const endTime = new Date();
          endTime.setHours(endTime.getHours() + durationHours);

          await this.prisma.session.create({
            data: {
              userId: payment.userId,
              planId: payment.planId,
              sessionToken,
              endTime,
              status: 'ACTIVE'
            }
          });
        }
      }
    }
  }
}





export default new PaystackService();
