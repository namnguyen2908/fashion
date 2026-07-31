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
    createStockReceipt,
    listStockReceipts,
    getStockReceiptById,
    listTransactions,
    createAdjustment,
    listAdjustments,
    createTransfer,
    listTransfers,
    getTransferByCode,
    listSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    getSupplierVariants,
    addSupplierVariant,
    updateSupplierVariant,
    deleteSupplierVariant,
    getVariantSuppliers,
    getSuppliersByVariantIds
} from '../controllers/warehouse.controller.js';

const router = express.Router();

// Warehouses
router.get('/warehouses', verifyToken, verifyPermission('warehouse:view'), listWarehouses);
router.post('/warehouses', verifyToken, verifyPermission('warehouse:create'), createWarehouse);
router.put('/warehouses/:id', verifyToken, verifyPermission('warehouse:create'), updateWarehouse);

// Stocks
router.get('/stocks', verifyToken, verifyPermission('warehouse:view'), getAllStocks);
router.get('/stocks/:variantId', verifyToken, verifyPermission('warehouse:view'), getVariantStock);
router.get('/stocks/product/:productId', getProductStocks);

// Goods receipts
router.post('/receipts', verifyToken, verifyPermission('warehouse:create'), createStockReceipt);
router.get('/receipts', verifyToken, verifyPermission('warehouse:view'), listStockReceipts);
router.get('/receipts/:id', verifyToken, verifyPermission('warehouse:view'), getStockReceiptById);

// Inventory transactions
router.get('/transactions', verifyToken, verifyPermission('warehouse:view'), listTransactions);

// Adjustments
router.post('/adjustments', verifyToken, verifyPermission('warehouse:adjust'), createAdjustment);
router.get('/adjustments', verifyToken, verifyPermission('warehouse:view'), listAdjustments);

// Transfers
router.post('/transfers', verifyToken, verifyPermission('warehouse:transfer'), createTransfer);
router.get('/transfers', verifyToken, verifyPermission('warehouse:view'), listTransfers);
router.get('/transfers/:code', verifyToken, verifyPermission('warehouse:view'), getTransferByCode);

// Suppliers
router.get('/suppliers', verifyToken, verifyPermission('warehouse:view'), listSuppliers);
router.get('/suppliers/by-variant', verifyToken, verifyPermission('warehouse:view'), getSuppliersByVariantIds);
router.get('/suppliers/:id', verifyToken, verifyPermission('warehouse:view'), getSupplierById);
router.post('/suppliers', verifyToken, verifyPermission('warehouse:create'), createSupplier);
router.put('/suppliers/:id', verifyToken, verifyPermission('warehouse:create'), updateSupplier);
router.get('/suppliers/:id/variants', verifyToken, verifyPermission('warehouse:view'), getSupplierVariants);
router.post('/suppliers/:id/variants', verifyToken, verifyPermission('warehouse:create'), addSupplierVariant);
router.put('/suppliers/:id/variants/:variantId', verifyToken, verifyPermission('warehouse:create'), updateSupplierVariant);
router.delete('/suppliers/:id/variants/:variantId', verifyToken, verifyPermission('warehouse:create'), deleteSupplierVariant);
router.get('/variants/:variantId/suppliers', getVariantSuppliers);

export default router;
