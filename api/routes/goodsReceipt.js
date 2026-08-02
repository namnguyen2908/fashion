import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/permission.middleware.js';
import {
    createGoodsReceipt,
    listGoodsReceipts,
    getGoodsReceiptById,
    updateGoodsReceipt,
    completeGoodsReceipt,
    cancelGoodsReceipt,
} from '../controllers/goodsReceipt.controller.js';

const router = express.Router();

router.post('/', verifyToken, verifyPermission('warehouse:create'), createGoodsReceipt);
router.get('/', verifyToken, verifyPermission('warehouse:view'), listGoodsReceipts);
router.get('/:id', verifyToken, verifyPermission('warehouse:view'), getGoodsReceiptById);
router.put('/:id', verifyToken, verifyPermission('warehouse:create'), updateGoodsReceipt);
router.post('/:id/complete', verifyToken, verifyPermission('warehouse:create'), completeGoodsReceipt);
router.post('/:id/cancel', verifyToken, verifyPermission('warehouse:create'), cancelGoodsReceipt);

export default router;
