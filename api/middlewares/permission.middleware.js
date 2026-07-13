import pool from '../config/db.js';
import { getCache, setCache } from '../utils/cache.js';

export const verifyPermission = (...requiredPermissions) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            const cacheKey = `role:permissions:${user.role}`;
            let userPermissions = await getCache(cacheKey);

            if (!userPermissions) {
                const result = await pool.query(
                    `SELECT p.slug FROM role_permissions rp
                     JOIN permissions p ON rp.permission_id = p.id
                     JOIN roles r ON rp.role_id = r.id
                     WHERE r.slug = $1`,
                    [user.role]
                );
                userPermissions = result.rows.map(row => row.slug);
                await setCache(cacheKey, userPermissions, 600);
            }

            const hasAllPermissions = requiredPermissions.every(p => userPermissions.includes(p));

            if (!hasAllPermissions) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: insufficient permissions'
                });
            }

            next();
        } catch (error) {
            console.error(error);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    };
};
