import express from 'express';
import { generatePaymentQR, sepayWebhook, getPaymentStatus } from '../controllers/payment.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Generate QR for payment (authenticated user)
router.post('/generate-qr', verifyToken, generatePaymentQR);

// SePay webhook - receives payment notification (no auth, uses API key)
router.post('/webhook', sepayWebhook);

// Get payment status (authenticated user)
router.get('/status/:orderId', verifyToken, getPaymentStatus);

export default router;