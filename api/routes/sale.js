import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/permission.middleware.js';
import {
    listSales,
    getSaleById,
    createSale,
    updateSale,
    deleteSale,
    addSaleVariants,
    removeSaleVariant,
    getActiveSaleVariants
} from '../controllers/sale.controller.js';

const router = express.Router();

router.get('/', verifyToken, verifyPermission('sale:view'), listSales);
router.get('/active', getActiveSaleVariants);
router.get('/:id', verifyToken, verifyPermission('sale:view'), getSaleById);
router.post('/', verifyToken, verifyPermission('sale:create'), createSale);
router.put('/:id', verifyToken, verifyPermission('sale:create'), updateSale);
router.delete('/:id', verifyToken, verifyPermission('sale:create'), deleteSale);
router.post('/:id/variants', verifyToken, verifyPermission('sale:create'), addSaleVariants);
router.delete('/:id/variants/:variantId', verifyToken, verifyPermission('sale:create'), removeSaleVariant);

export default router;
