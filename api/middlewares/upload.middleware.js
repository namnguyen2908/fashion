import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

const storage = new CloudinaryStorage({
    cloudinary,

    params: async (req, file) => {

        const folder = buildFolder(req);

        return {
            folder,

            resource_type: 'image',

            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],

            transformation: [
                {
                    width: 1200,
                    crop: 'limit',
                    quality: 'auto',
                    fetch_format: 'auto'
                }
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

    const variantId = req.body.variant_id;

    // PRODUCT ROOT
    // fashion-store/products/1

    if (!variantId) {
        return `fashion-store/products/${productId}/general`;
    }

    // VARIANT IMAGES
    // fashion-store/products/1/variants/12

    return `fashion-store/products/${productId}/variants/${variantId}`;
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
        fileSize: 5 * 1024 * 1024 // 5MB
    },

    fileFilter
});

export default upload;