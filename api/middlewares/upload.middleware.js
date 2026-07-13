import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

const storage = new CloudinaryStorage({
    cloudinary,

    params: async (req, file) => {

        const folder = buildFolder(req);

        return {
            folder,
            format: 'webp',
            resource_type: 'image',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            transformation: [
                { width: 1600, crop: 'limit', quality: 'auto:best' }
            ],
            public_id: buildFileName(file.originalname),
        };
    }
});

// ============================================
// BUILD FOLDER STRUCTURE
// ============================================

const buildFolder = (req) => {

    const productId = req.body.product_id || 'unknown-product';

    const color = req.body.color;

    if (!color) {
        return `fashion-store/products/${productId}/general`;
    }

    return `fashion-store/products/${productId}/colors/${color}`;
};

// ============================================
// BUILD CLEAN FILE NAME
// ============================================

const buildFileName = (originalName) => {

    const timestamp = Date.now();

    const cleanName = originalName
        .split('.')[0]
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '');

    return `${cleanName}-${timestamp}`;
};

// ============================================
// FILE FILTER
// ============================================

const fileFilter = (req, file, cb) => {

    const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/jpg'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(
            new Error('Only JPG, JPEG, PNG, WEBP images are allowed'),
            false
        );
    }

    cb(null, true);
};

// ============================================
// MULTER CONFIG
// ============================================

const upload = multer({
    storage,

    limits: {
        fileSize: 50 * 1024 * 1024
    },

    fileFilter
});

export default upload;