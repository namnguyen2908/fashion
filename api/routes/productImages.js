import express from 'express';
import { getProductImages, uploadProductImages, deleteProductImage, setThumbnail, reorderProductImages} from "../controllers/productImages.controller.js";
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyRole } from '../middlewares/verifyRole.middleware.js';
import upload from '../middlewares/upload.middleware.js';

const router = express.Router();

router.get('/:productId', getProductImages);
router.post('/create-product-images', verifyToken, verifyRole('admin', 'staff'), upload.array('images', 10), uploadProductImages);
router.delete('/:id',verifyToken,verifyRole('admin'), deleteProductImage);
router.patch('/:id/thumbnail', verifyToken, verifyRole('admin'), setThumbnail);
router.patch('/reorder',verifyToken, verifyRole('admin'), reorderProductImages);

export default router;