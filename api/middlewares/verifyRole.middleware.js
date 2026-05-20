// middlewares/verifyRole.middleware.js

export const verifyRole = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            // req.user được gán từ verifyToken
            const user = req.user;
            if (!user) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
            // CHECK ROLE
            if (!allowedRoles.includes(user.role)) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }
            next();
        } catch (error) {
            console.log(error);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    };
};