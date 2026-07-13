import express from 'express';
import { getCategories, createCategory, getCategoryById, updateCategory, deleteCategory } from '../controllers/category.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.post('/create-category', verifyToken, verifyPermission('category:create'), createCategory);
router.put('/update-category/:id', verifyToken, verifyPermission('category:update'), updateCategory);
router.delete('/delete-category/:id', verifyToken, verifyPermission('category:delete'), deleteCategory);

export default router;