import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import paystackService from '../services/paystackService';
import sessionService from '../services/sessionService';
import smsService from '../services/smsService';

const router = express.Router();
const prisma = new PrismaClient();

// Get all active plans
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' }
    });
    
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

// Register new user
router.post('/register', [
  body('phone').isMobilePhone('any').withMessage('Valid phone number required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('firstName').optional().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').optional().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { phone, email, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone },
          ...(email ? [{ email }] : [])
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        error: 'User with this phone number or email already exists' 
      });
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        phone,
        email,
        firstName,
        lastName,
        role: 'CUSTOMER'
      }
    });

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }
    const token = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    // Send welcome SMS
    await smsService.sendWelcomeMessage(phone, firstName);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// Login user
router.post('/login', [
  body('phone').isMobilePhone('any').withMessage('Valid phone number required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { phone } = req.body;

    const user = await prisma.user.findUnique({
      where: { phone }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'User not found or inactive' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }
    const token = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Initiate payment
router.post('/payment', [
  body('phone').isMobilePhone('any').withMessage('Valid phone number required'),
  body('planId').isUUID().withMessage('Valid plan ID required'),
  body('amount').isFloat({ min: 1 }).withMessage('Valid amount required'),
  body('email').optional().isEmail().withMessage('Valid email required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { phone, planId, amount, email } = req.body;

    // Get or create user
    let user = await prisma.user.findUnique({
      where: { phone }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          email: email || undefined,
          role: 'CUSTOMER'
        }
      });
    }

    // Verify plan exists
    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, error: 'Plan not found or inactive' });
    }

    // Create payment record in PENDING status
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        planId,
        amount,
        status: 'PENDING'
      }
    });

    // Initiate Paystack transaction
    const customerEmail = email || user.email || `${phone.replace(/[^0-9]/g, '')}@collospot.com`;
    const paystackResponse = await paystackService.initiateTransaction(
      customerEmail,
      amount,
      plan.id,
      payment.id
    );

    // Update payment with checkout request ID set to Paystack reference
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        checkoutRequestId: paystackResponse.reference
      }
    });

    res.json({
      success: true,
      data: {
        reference: paystackResponse.reference,
        access_code: paystackResponse.access_code
      },
      reference: paystackResponse.reference,
      access_code: paystackResponse.access_code
    });
  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({ success: false, error: 'Payment initiation failed' });
  }
});

// Check payment status
router.get('/payment/status/:checkoutRequestId', async (req: Request, res: Response) => {
  try {
    const { checkoutRequestId } = req.params;

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { checkoutRequestId },
          { paymentReference: checkoutRequestId }
        ]
      },
      include: { user: true, plan: true }
    });

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // If payment is completed, ensure session exists and return sessionToken
    if (payment.status === 'COMPLETED') {
      const existingSession = await prisma.session.findFirst({
        where: {
          userId: payment.userId,
          planId: payment.planId,
          status: 'ACTIVE'
        }
      });

      let sessionToken = existingSession?.sessionToken;
      if (!sessionToken) {
        sessionToken = generateSessionToken();
        await sessionService.createSession(payment.userId, payment.planId, sessionToken);
      }

      return res.json({
        success: true,
        data: {
          status: 'completed',
          sessionToken
        }
      });
    }

    res.json({
      success: true,
      data: {
        status: payment.status.toLowerCase(),
        amount: payment.amount
      }
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check payment status' });
  }
});

// Connect to internet
router.post('/connect', [
  body('sessionToken').notEmpty().withMessage('Session token required')
], async (req: Request, res: Response) => {
  try {
    const { sessionToken } = req.body;

    const session = await sessionService.getActiveSession(sessionToken);
    
    if (!session) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session' });
    }

    res.json({
      success: true,
      data: {
        message: 'Connected successfully',
        session: {
          id: session.id,
          plan: session.plan.name,
          endTime: session.endTime
        }
      }
    });
  } catch (error) {
    console.error('Connection error:', error);
    res.status(500).json({ success: false, error: 'Connection failed' });
  }
});

// Paystack webhook
router.post('/payment/paystack/webhook', async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['x-paystack-signature'] as string) || '';
    const rawBody = (req as any).rawBody || req.body;
    await paystackService.handleWebhook(rawBody, signature);
  } catch (error) {
    console.error('Paystack webhook error:', error);
  }
  res.status(200).send('OK');
});

// Helper function
function generateSessionToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default router;