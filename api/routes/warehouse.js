import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/permission.middleware.js';
import {
    listWarehouses,
    createWarehouse,
    updateWarehouse,
    getAllStocks,
    getVariantStock,
    getProductStocks,
    listTransactions,
    listCosts,
    createAdjustment,
    listAdjustments,
    getAdjustmentById,
    updateAdjustment,
    completeAdjustment,
    createCount,
    listCounts,
    getCountById,
    updateCountItem,
    completeCount,
    cancelCount,
    createTransfer,
    listTransfers,
    getTransferById,
    updateTransfer,
    completeTransfer,
    listSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    getSupplierVariants,
    addSupplierVariant,
    updateSupplierVariant,
    deleteSupplierVariant,
    getVariantSuppliers,
    getSuppliersByVariantIds,
    getSupplierVariantsByVariantIds,
} from '../controllers/warehouse.controller.js';
import {
    listGoodsReceipts,
    getGoodsReceiptById,
} from '../controllers/goodsReceipt.controller.js';

const router = express.Router();

// Warehouses
router.get('/warehouses', verifyToken, verifyPermission('warehouse:view'), listWarehouses);
router.post('/warehouses', verifyToken, verifyPermission('warehouse:create'), createWarehouse);
router.put('/warehouses/:id', verifyToken, verifyPermission('warehouse:create'), updateWarehouse);

// Stocks
router.get('/stocks', verifyToken, verifyPermission('warehouse:view'), getAllStocks);
router.get('/stocks/:variantId', verifyToken, verifyPermission('warehouse:view'), getVariantStock);
router.get('/stocks/product/:productId', getProductStocks);

// Inventory transactions + costs
router.get('/transactions', verifyToken, verifyPermission('warehouse:view'), listTransactions);
router.get('/costs', verifyToken, verifyPermission('warehouse:view'), listCosts);

// Goods receipts — legacy alias (giữ tương thích UI hiện tại)
router.get('/receipts', verifyToken, verifyPermission('warehouse:view'), listGoodsReceipts);
router.get('/receipts/:id', verifyToken, verifyPermission('warehouse:view'), getGoodsReceiptById);

// Stock adjustments
router.post('/adjustments', verifyToken, verifyPermission('warehouse:adjust'), createAdjustment);
router.get('/adjustments', verifyToken, verifyPermission('warehouse:view'), listAdjustments);
router.get('/adjustments/:id', verifyToken, verifyPermission('warehouse:view'), getAdjustmentById);
router.put('/adjustments/:id', verifyToken, verifyPermission('warehouse:adjust'), updateAdjustment);
router.post('/adjustments/:id/complete', verifyToken, verifyPermission('warehouse:adjust'), completeAdjustment);

// Stock counts
router.post('/counts', verifyToken, verifyPermission('warehouse:adjust'), createCount);
router.get('/counts', verifyToken, verifyPermission('warehouse:view'), listCounts);
router.get('/counts/:id', verifyToken, verifyPermission('warehouse:view'), getCountById);
router.put('/counts/:id/items/:itemId', verifyToken, verifyPermission('warehouse:adjust'), updateCountItem);
router.post('/counts/:id/complete', verifyToken, verifyPermission('warehouse:adjust'), completeCount);
router.post('/counts/:id/cancel', verifyToken, verifyPermission('warehouse:adjust'), cancelCount);

// Transfers
router.post('/transfers', verifyToken, verifyPermission('warehouse:transfer'), createTransfer);
router.get('/transfers', verifyToken, verifyPermission('warehouse:view'), listTransfers);
router.get('/transfers/:id', verifyToken, verifyPermission('warehouse:view'), getTransferById);
router.put('/transfers/:id', verifyToken, verifyPermission('warehouse:transfer'), updateTransfer);
router.post('/transfers/:id/complete', verifyToken, verifyPermission('warehouse:transfer'), completeTransfer);

// Suppliers
router.get('/suppliers', verifyToken, verifyPermission('warehouse:view'), listSuppliers);
router.get('/suppliers/by-variant', verifyToken, verifyPermission('warehouse:view'), getSuppliersByVariantIds);
router.get('/supplier-variants/by-ids', verifyToken, verifyPermission('warehouse:view'), getSupplierVariantsByVariantIds);
router.get('/suppliers/:id', verifyToken, verifyPermission('warehouse:view'), getSupplierById);
router.post('/suppliers', verifyToken, verifyPermission('warehouse:create'), createSupplier);
router.put('/suppliers/:id', verifyToken, verifyPermission('warehouse:create'), updateSupplier);
router.get('/suppliers/:id/variants', verifyToken, verifyPermission('warehouse:view'), getSupplierVariants);
router.post('/suppliers/:id/variants', verifyToken, verifyPermission('warehouse:create'), addSupplierVariant);
router.put('/suppliers/:id/variants/:variantId', verifyToken, verifyPermission('warehouse:create'), updateSupplierVariant);
router.delete('/suppliers/:id/variants/:variantId', verifyToken, verifyPermission('warehouse:create'), deleteSupplierVariant);
router.get('/variants/:variantId/suppliers', getVariantSuppliers);

export default router;
