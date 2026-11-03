import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import paymentService from '../services/paymentService';

const router = express.Router();

// ---------------------------------------------------------------------------
// Public endpoints (no authentication required)
// ---------------------------------------------------------------------------

// Initiate payment
router.post(
  '/',
  [
    body('phone').optional().isMobilePhone('any').withMessage('Valid phone number required'),
    body('planId').isUUID().withMessage('Valid plan ID required'),
    body('amount').isFloat({ min: 1 }).withMessage('Valid amount required'),
    body('email').optional().isEmail().withMessage('Valid email required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { phone: inputPhone, planId, amount, email } = req.body;
      const phone = inputPhone || (email ? undefined : `+254700${Math.floor(100000 + Math.random() * 900000)}`);

      const result = await paymentService.initiatePayment({ phone, planId, amount, email });

      res.json({
        success: true,
        data: {
          reference: result.reference,
          access_code: result.access_code,
          ...(result.authorization_url ? { authorization_url: result.authorization_url } : {}),
        },
        reference: result.reference,
        access_code: result.access_code,
      });
    } catch (error: any) {
      if (error.message === 'Plan not found or inactive') {
        return res.status(404).json({ success: false, error: error.message });
      }
      if (error.message === 'At least one of phone or email must be provided') {
        return res.status(400).json({ success: false, error: error.message });
      }
      console.error('Payment initiation error:', error);
      res.status(500).json({ success: false, error: 'Payment initiation failed' });
    }
  }
);

// Check payment status
router.get('/status/:checkoutRequestId', async (req: Request, res: Response) => {
  try {
    const { checkoutRequestId } = req.params;
    const result = await paymentService.checkStatus(checkoutRequestId);

    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message === 'Payment not found') {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
    console.error('Payment status check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check payment status' });
  }
});

// Paystack webhook
router.post('/paystack/webhook', async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['x-paystack-signature'] as string) || '';
    const rawBody = (req as any).rawBody || req.body;
    await paymentService.handleWebhook(rawBody, signature);
  } catch (error) {
    console.error('Paystack webhook error:', error);
  }
  res.status(200).send('OK');
});

// ---------------------------------------------------------------------------
// Authenticated customer endpoints
// ---------------------------------------------------------------------------

// Get payment history for the authenticated user
// Also available as GET /history (alias) for explicit history access
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const payments = await paymentService.getUserPayments(req.user!.id);
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get payments' });
  }
});

// Get a single payment by ID, scoped to the authenticated user
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Exclude route-reserved segments that are handled by other handlers
    const reservedSegments = ['status', 'paystack'];
    if (reservedSegments.some((seg) => req.params.id === seg)) {
      return res.status(400).json({ success: false, error: 'Invalid payment ID' });
    }

    const payment = await paymentService.getUserPaymentById(req.user!.id, id);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get payment' });
  }
});

export default router;