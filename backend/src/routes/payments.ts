import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import paymentService from '../services/paymentService';

const router = express.Router();

// Get user payments
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const payments = await paymentService.getUserPayments(req.user!.id);
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get payments' });
  }
});

// Get payment by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
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