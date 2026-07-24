import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import {
  createRule,
  getRules,
  updateRule,
  deleteRule,
  getMyDiscounts,
  validateDiscount,
} from '../controllers/discount.controller.js';

const router = express.Router();

// Admin CRUD
router.post('/', verifyToken, createRule);
router.get('/', verifyToken, getRules);
router.put('/:id', verifyToken, updateRule);
router.delete('/:id', verifyToken, deleteRule);

// User
router.get('/my', verifyToken, getMyDiscounts);
router.post('/validate', verifyToken, validateDiscount);

export default router;
