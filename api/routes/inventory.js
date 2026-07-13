import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/permission.middleware.js';
import {
    getVariantStock,
    getProductStock,
    createInboundNote,
    listInboundNotes,
    getInboundNoteById
} from '../controllers/inventory.controller.js';

const router = express.Router();

router.get('/variants/:variantId', verifyToken, verifyPermission('inventory:view'), getVariantStock);
router.get('/products/:productId', getProductStock);
router.post('/inbound', verifyToken, verifyPermission('inventory:create'), createInboundNote);
router.get('/inbound', verifyToken, verifyPermission('inventory:view'), listInboundNotes);
router.get('/inbound/:id', verifyToken, verifyPermission('inventory:view'), getInboundNoteById);

export default router;
