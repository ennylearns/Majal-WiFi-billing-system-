import express, { Request, Response } from 'express';
import { prisma } from '../database/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import sessionService from '../services/sessionService';
import smsService from '../services/smsService';
import paymentsRouter from './payments';

const router = express.Router();

// Forward all /payment/* subpaths to the consolidated payments route module.
// This preserves the existing public URL contracts:
//   POST   /api/public/payment              → initiate payment
//   GET    /api/public/payment/status/:ref  → check payment status
//   POST   /api/public/payment/paystack/webhook → Paystack webhook
router.use('/payment', paymentsRouter);

// Get all active routers (public location info only)
router.get('/routers', async (req: Request, res: Response) => {
  try {
    const routers = await prisma.router.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        location: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({ success: true, data: routers });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch routers' });
  }
});

// Get all active plans (optionally filtered by routerId or router name/location)
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const { routerId, router: routerQuery } = req.query;

    const where: any = { isActive: true };

    if (typeof routerId === 'string' && routerId.trim() !== '') {
      where.routerId = routerId.trim();
    } else if (typeof routerQuery === 'string' && routerQuery.trim() !== '') {
      const q = routerQuery.trim().toLowerCase();
      const activeRouters = await prisma.router.findMany({
        where: { isActive: true },
        select: { id: true, name: true, location: true }
      });

      const matched = activeRouters.filter(r =>
        r.id.toLowerCase() === q ||
        r.name.toLowerCase() === q ||
        r.location.toLowerCase() === q
      );

      if (matched.length === 0) {
        return res.json({ success: true, data: [] });
      }

      where.routerId = { in: matched.map(r => r.id) };
    }

    const plans = await prisma.plan.findMany({
      where,
      orderBy: { price: 'asc' },
      include: {
        router: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      }
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

export default router;
