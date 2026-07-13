import express from 'express';
import {
    getRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
    getPermissions,
    getPermissionsGrouped,
    assignPermissions,
    updateUserRole
} from '../controllers/role.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', verifyPermission('role:view'), getRoles);
router.get('/grouped', verifyPermission('role:view'), getPermissionsGrouped);
router.get('/permissions/list', verifyPermission('role:view'), getPermissions);
router.get('/:id', verifyPermission('role:view'), getRoleById);

router.post('/create-role', verifyPermission('role:create'), createRole);
router.put('/update-role/:id', verifyPermission('role:update'), updateRole);
router.delete('/delete-role/:id', verifyPermission('role:delete'), deleteRole);
router.post('/:id/permissions', verifyPermission('role:assign'), assignPermissions);

router.put('/users/:id/role', verifyPermission('role:assign'), updateUserRole);

export default router;
