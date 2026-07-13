import express from 'express';
import { getVariantsByProductId, getVariantById, adminGetVariantById, createVariant, updateVariant, deleteVariant } from '../controllers/productVariants.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get('/products/:productId/variants', getVariantsByProductId);
router.get('/variant/:id', getVariantById);
router.get('/admin/variant/:id', verifyToken, verifyPermission('product:view'), adminGetVariantById);
router.post('/create-variant', verifyToken, verifyPermission('product:update'), createVariant);
router.patch('/update-variant/:id', verifyToken, verifyPermission('product:update'), updateVariant);
router.delete('/delete-variant/:id', verifyToken, verifyPermission('product:update'), deleteVariant);

export default router;