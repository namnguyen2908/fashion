import express from 'express';
import { register, login, logout, refresh, getMe, getCustomers, getUsers, forgotPassword, resetPassword, verifyOTP } from '../controllers/auth.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/me', verifyToken, getMe);
router.get('/customers', verifyToken, verifyPermission('user:view'), getCustomers);
router.get('/users', verifyToken, verifyPermission('user:view'), getUsers);

router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);

export default router;