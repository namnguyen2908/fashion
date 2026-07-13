import pool from '../config/db.js';
import { getCache, setCache } from '../utils/cache.js';

export const verifyRole = (...allowedRoles) => {
    const cacheKey = `roles:slugs`;

    return async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            let validRoles = await getCache(cacheKey);

            if (!validRoles) {
                const result = await pool.query('SELECT slug FROM roles');
                validRoles = result.rows.map(r => r.slug);
                await setCache(cacheKey, validRoles, 600);
            }

            const hasRole = allowedRoles.some(r => validRoles.includes(r)) && allowedRoles.includes(user.role);

            if (!hasRole) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }

            next();
        } catch (error) {
            console.log(error);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    };
};
