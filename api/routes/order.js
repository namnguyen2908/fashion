import express from 'express';
import { createOrder, getMyOrders, getOrderDetail, cancelOrder } from '../controllers/order.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Create new order (checkout)
router.post('/', verifyToken, createOrder);

// Get my orders
router.get('/', verifyToken, getMyOrders);

// Get order detail
router.get('/:orderId', verifyToken, getOrderDetail);

// Cancel order (only if not paid)
router.put('/:orderId/cancel', verifyToken, cancelOrder);

export default router;