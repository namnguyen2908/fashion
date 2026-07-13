import express from 'express';
import { getProductImages, uploadProductImages, deleteProductImage, setThumbnail, reorderProductImages} from "../controllers/productImages.controller.js";
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/permission.middleware.js';
import upload from '../middlewares/upload.middleware.js';

const router = express.Router();

router.get('/:productId', getProductImages);
router.post('/create-product-images', verifyToken, verifyPermission('product:update'), upload.array('images', 10), uploadProductImages);
router.delete('/:id',verifyToken,verifyPermission('product:update'), deleteProductImage);
router.patch('/:id/thumbnail', verifyToken, verifyPermission('product:update'), setThumbnail);
router.patch('/reorder',verifyToken, verifyPermission('product:update'), reorderProductImages);

export default router;