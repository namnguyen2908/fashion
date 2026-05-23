import express from 'express';
import { getVariantsByProductId, getVariantById, adminGetVariantById, createVariant, updateVariant, deleteVariant } from '../controllers/productVariants.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyRole } from '../middlewares/verifyRole.middleware.js';

const router = express.Router();

router.get('/products/:productId/variants', getVariantsByProductId);
router.get('/variant/:id', getVariantById);
router.get('/admin/variant/:id', verifyToken, verifyRole('admin', 'staff'), adminGetVariantById);
router.post('/create-variant', verifyToken, verifyRole('admin', 'staff'), createVariant);
router.patch('/update-variant/:id', verifyToken, verifyRole('admin', 'staff'), updateVariant);
router.delete('/delete-variant/:id', verifyToken, verifyRole('admin', 'staff'), deleteVariant);

export default router;