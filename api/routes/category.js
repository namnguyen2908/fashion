import express from 'express';
import { getCategories, createCategory, getCategoryById, updateCategory, deleteCategory } from '../controllers/category.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyRole } from '../middlewares/verifyRole.middleware.js';

const router = express.Router();

router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.post('/create-category', verifyToken, verifyRole('admin', 'staff'), createCategory);
router.put('/update-category/:id', verifyToken, verifyRole('admin', 'staff'), updateCategory);
router.delete('/delete-category/:id', verifyToken, verifyRole('admin', 'staff'), deleteCategory);

export default router;