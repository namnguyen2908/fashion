import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyRole } from '../middlewares/verifyRole.middleware.js';
import {
    getVariantStock,
    getProductStock,
    createInboundNote,
    listInboundNotes,
    getInboundNoteById
} from '../controllers/inventory.controller.js';

const router = express.Router();

router.get('/variants/:variantId', verifyToken, verifyRole('admin', 'staff'), getVariantStock);
router.get('/products/:productId', getProductStock);
router.post('/inbound', verifyToken, verifyRole('admin', 'staff'), createInboundNote);
router.get('/inbound', verifyToken, verifyRole('admin', 'staff'), listInboundNotes);
router.get('/inbound/:id', verifyToken, verifyRole('admin', 'staff'), getInboundNoteById);

export default router;
