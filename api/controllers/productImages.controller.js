import pool from '../config/db.js';
import client from '../config/redis.js';
import cloudinary from '../config/cloudinary.js';

const CACHE_TTL = 900;

// =========================================
// CACHE
// =========================================

const invalidateProductImagesCache = async (productId) => {
    await client.del(`product:images:${productId}`);
};

// =========================================
// GET PRODUCT IMAGES
// =========================================

export const getProductImages = async (req, res) => {
    try {
        const { productId } = req.params;

        const cacheKey = `product:images:${productId}`;

        const cachedImages = await client.get(cacheKey);

        if (cachedImages) {
            return res.status(200).json({
                success: true,
                source: 'redis',
                data: JSON.parse(cachedImages),
            });
        }

        const result = await pool.query(
            `
            SELECT
                id,
                product_id,
                color,
                image_url,
                public_id,
                is_thumbnail,
                sort_order,
                created_at,
                updated_at
            FROM product_images
            WHERE product_id = $1
            ORDER BY
                is_thumbnail DESC,
                sort_order ASC,
                id ASC
            `,
            [productId]
        );

        await client.setEx(
            cacheKey,
            CACHE_TTL,
            JSON.stringify(result.rows)
        );

        return res.status(200).json({
            success: true,
            data: result.rows,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// =========================================
// UPLOAD PRODUCT IMAGES
// =========================================

export const uploadProductImages = async (req, res) => {
    try {

        const {
            product_id,
            color = null,
            is_thumbnail = false,
        } = req.body;

        if (!product_id) {
            return res.status(400).json({
                success: false,
                message: 'Product id is required',
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Images are required',
            });
        }

        // =========================================
        // CHECK PRODUCT
        // =========================================

        const product = await pool.query(
            `SELECT id FROM products WHERE id = $1`,
            [product_id]
        );

        if (product.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        // =========================================
        // HANDLE THUMBNAIL
        // =========================================

        if (String(is_thumbnail) === 'true') {

            await pool.query(
                `
                UPDATE product_images
                SET is_thumbnail = false
                WHERE product_id = $1
                `,
                [product_id]
            );
        }

        // =========================================
        // INSERT IMAGES
        // =========================================

        const uploadedImages = [];

        for (const file of req.files) {

            const result = await pool.query(
                `
                INSERT INTO product_images(
                    product_id,
                    color,
                    image_url,
                    public_id,
                    is_thumbnail
                )
                VALUES($1, $2, $3, $4, $5)
                RETURNING *
                `,
                [
                    product_id,
                    color || null,
                    file.path,
                    file.filename,
                    String(is_thumbnail) === 'true',
                ]
            );

            uploadedImages.push(result.rows[0]);
        }

        // =========================================
        // CACHE
        // =========================================

        await invalidateProductImagesCache(product_id);

        return res.status(201).json({
            success: true,
            message: 'Images uploaded successfully',
            data: uploadedImages,
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// =========================================
// DELETE IMAGE
// =========================================

export const deleteProductImage = async (req, res) => {
    try {

        const { id } = req.params;

        const image = await pool.query(
            `
            SELECT *
            FROM product_images
            WHERE id = $1
            `,
            [id]
        );

        if (image.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Image not found',
            });
        }

        const currentImage = image.rows[0];

        // =========================================
        // DELETE CLOUDINARY
        // =========================================

        await cloudinary.uploader.destroy(currentImage.public_id);

        // =========================================
        // DELETE DB
        // =========================================

        await pool.query(
            `
            DELETE FROM product_images
            WHERE id = $1
            `,
            [id]
        );

        // =========================================
        // AUTO NEW THUMBNAIL
        // =========================================

        if (currentImage.is_thumbnail) {

            const nextImage = await pool.query(
                `
                SELECT id
                FROM product_images
                WHERE product_id = $1
                ORDER BY sort_order ASC, id ASC
                LIMIT 1
                `,
                [currentImage.product_id]
            );

            if (nextImage.rows.length > 0) {

                await pool.query(
                    `
                    UPDATE product_images
                    SET is_thumbnail = true
                    WHERE id = $1
                    `,
                    [nextImage.rows[0].id]
                );
            }
        }

        // =========================================
        // CACHE
        // =========================================

        await invalidateProductImagesCache(currentImage.product_id);

        return res.status(200).json({
            success: true,
            message: 'Image deleted successfully',
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// =========================================
// SET THUMBNAIL
// =========================================

export const setThumbnail = async (req, res) => {
    try {

        const { id } = req.params;

        const image = await pool.query(
            `
            SELECT *
            FROM product_images
            WHERE id = $1
            `,
            [id]
        );

        if (image.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Image not found',
            });
        }

        const currentImage = image.rows[0];

        await pool.query(
            `
            UPDATE product_images
            SET is_thumbnail = false
            WHERE product_id = $1
            `,
            [currentImage.product_id]
        );

        await pool.query(
            `
            UPDATE product_images
            SET is_thumbnail = true
            WHERE id = $1
            `,
            [id]
        );

        await invalidateProductImagesCache(currentImage.product_id);

        return res.status(200).json({
            success: true,
            message: 'Thumbnail updated successfully',
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};

// =========================================
// REORDER IMAGES
// =========================================

export const reorderProductImages = async (req, res) => {
    try {

        const { product_id, images } = req.body;

        if (!product_id || !Array.isArray(images)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payload',
            });
        }

        for (const item of images) {

            await pool.query(
                `
                UPDATE product_images
                SET sort_order = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                `,
                [item.sort_order, item.id]
            );
        }

        await invalidateProductImagesCache(product_id);

        return res.status(200).json({
            success: true,
            message: 'Images reordered successfully',
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
};