import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/permission.middleware.js';
import {
    createPO,
    createPOGroup,
    listPOs,
    getPOById,
    updatePO,
    confirmPO,
    cancelPO,
} from '../controllers/purchaseOrder.controller.js';

const router = express.Router();

router.post('/group', verifyToken, verifyPermission('purchase:create'), createPOGroup);
router.post('/', verifyToken, verifyPermission('purchase:create'), createPO);
router.get('/', verifyToken, verifyPermission('purchase:view'), listPOs);
router.get('/:id', verifyToken, verifyPermission('purchase:view'), getPOById);
router.put('/:id', verifyToken, verifyPermission('purchase:create'), updatePO);
router.post('/:id/confirm', verifyToken, verifyPermission('purchase:create'), confirmPO);
router.post('/:id/cancel', verifyToken, verifyPermission('purchase:create'), cancelPO);

export default router;
