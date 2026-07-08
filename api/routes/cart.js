import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import {
    getCart,
    addItem,
    updateItem,
    removeItem,
    clearCart
} from '../controllers/cart.controller.js';

const router = express.Router();

// All cart routes require authentication
router.use(verifyToken);

router.get('/', getCart);
router.post('/items', addItem);
router.put('/items/:id', updateItem);
router.delete('/items/:id', removeItem);
router.delete('/', clearCart);

export default router;
