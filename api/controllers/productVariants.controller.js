import pool from '../config/db.js';
import client from '../config/redis.js';
import crypto from 'crypto';
import { effectivePriceSubquery, formatPriceData } from '../utils/price.js';
import { invalidateProductRelatedCaches } from '../utils/cache.js';

const CACHE_TTL = 60;

export const getVariantsByProductId = async (req, res) => {
    try {
        const { productId } = req.params;
        const cacheKey = `v2:variants:product:${productId}`;

        const cached = await client.get(cacheKey);
        if (cached) return res.status(200).json({ success: true, data: JSON.parse(cached) });

        const result = await pool.query(`
            SELECT pv.id, pv.product_id, pv.color, pv.size, pv.sku, pv.is_active, pv.created_at, pv.updated_at,
                   ${effectivePriceSubquery('pv.id')} AS price_data
            FROM product_variants pv
            WHERE pv.product_id = $1 AND pv.is_active = true
            ORDER BY pv.created_at DESC
        `, [productId]);

        const data = result.rows.map(v => formatPriceData(v));
        await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(data)).catch(() => {});
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getVariantById = async (req, res) => {
    try {
        const { id } = req.params;
        const cacheKey = `v2:variant:${id}`;

        const cached = await client.get(cacheKey);
        if (cached === 'null') return res.status(404).json({ success: false, message: 'Variant not found' });
        if (cached) return res.status(200).json({ success: true, data: JSON.parse(cached) });

        const result = await pool.query(`
            SELECT pv.id, pv.product_id, pv.color, pv.size, pv.sku, pv.is_active, pv.created_at, pv.updated_at,
                   p.name AS product_name,
                   ${effectivePriceSubquery('pv.id')} AS price_data
            FROM product_variants pv
            LEFT JOIN products p ON pv.product_id = p.id
            WHERE pv.id = $1 AND pv.is_active = true
        `, [id]);

        if (result.rows.length === 0) {
            await client.setEx(cacheKey, 60, 'null');
            return res.status(404).json({ success: false, message: 'Variant not found' });
        }

        const data = formatPriceData(result.rows[0]);
        await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(data));
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const adminGetVariantById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT pv.id, pv.product_id, pv.color, pv.size, pv.sku, pv.is_active, pv.created_at, pv.updated_at,
                   p.name AS product_name,
                   ${effectivePriceSubquery('pv.id')} AS price_data
            FROM product_variants pv
            LEFT JOIN products p ON pv.product_id = p.id
            WHERE pv.id = $1
        `, [id]);

        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Variant not found' });
        return res.status(200).json({ success: true, data: formatPriceData(result.rows[0]) });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const createVariant = async (req, res) => {
    try {
        const { product_id, color = '', size = '', price, is_active = true } = req.body;
        if (!product_id) return res.status(400).json({ success: false, message: 'Product is required' });

        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        const cleanColor = color.replace(/\s+/g, '-').toUpperCase();
        const cleanSize = size.replace(/\s+/g, '-').toUpperCase();
        const sku = `SKU-${product_id}-${cleanColor}-${cleanSize}-${random}`;

        const result = await pool.query(`
            INSERT INTO product_variants (product_id, color, size, sku, is_active)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, product_id, color, size, sku, is_active, created_at, updated_at
        `, [product_id, color, size, sku, is_active]);

        const variant = result.rows[0];
        await pool.query(`INSERT INTO variant_prices (variant_id, price) VALUES ($1, $2)`, [variant.id, price !== undefined && price !== '' ? Number(price) : 0]);

        await invalidateProductRelatedCaches(product_id, [variant.id]);

        const fullVariant = await pool.query(`
            SELECT pv.id, pv.product_id, pv.color, pv.size, pv.sku, pv.is_active, pv.created_at, pv.updated_at,
                   ${effectivePriceSubquery('pv.id')} AS price_data
            FROM product_variants pv WHERE pv.id = $1
        `, [variant.id]);

        return res.status(201).json({ success: true, message: 'Variant created successfully', data: formatPriceData(fullVariant.rows[0]) });
    } catch (error) {
        console.error(error);
        if (error.code === '23503') return res.status(404).json({ success: false, message: 'Product not found' });
        if (error.code === '23505') return res.status(409).json({ success: false, message: 'Variant already exists or SKU duplicate' });
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const updateVariant = async (req, res) => {
    try {
        const { id } = req.params;
        const { color, size, price, is_active } = req.body;

        if (color === undefined && size === undefined && price === undefined && is_active === undefined) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        const variant = await pool.query(`SELECT id, product_id FROM product_variants WHERE id = $1`, [id]);
        if (variant.rows.length === 0) return res.status(404).json({ success: false, message: 'Variant not found' });
        const currentVariant = variant.rows[0];

        const fields = [];
        const values = [];

        if (color !== undefined) { values.push(color); fields.push(`color = $${values.length}`); }
        if (size !== undefined) { values.push(size); fields.push(`size = $${values.length}`); }
        if (is_active !== undefined) { values.push(is_active); fields.push(`is_active = $${values.length}`); }

        if (fields.length > 0) {
            fields.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(id);
            await pool.query(`UPDATE product_variants SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
        }

        if (price !== undefined) {
            await pool.query(`
                INSERT INTO variant_prices (variant_id, price) VALUES ($1, $2)
                ON CONFLICT (variant_id) DO UPDATE SET price = $2, updated_at = NOW()
            `, [id, price]);
        }

        await invalidateProductRelatedCaches(currentVariant.product_id, [id]);

        const updated = await pool.query(`
            SELECT pv.id, pv.product_id, pv.color, pv.size, pv.sku, pv.is_active, pv.created_at, pv.updated_at,
                   ${effectivePriceSubquery('pv.id')} AS price_data
            FROM product_variants pv WHERE pv.id = $1
        `, [id]);

        return res.status(200).json({ success: true, message: 'Variant updated successfully', data: formatPriceData(updated.rows[0]) });
    } catch (error) {
        console.error(error);
        if (error.code === '23505') return res.status(409).json({ success: false, message: 'Variant already exists' });
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const deleteVariant = async (req, res) => {
    try {
        const { id } = req.params;

        const variant = await pool.query(`SELECT id, product_id FROM product_variants WHERE id = $1 AND is_active = true`, [id]);
        if (variant.rows.length === 0) return res.status(404).json({ success: false, message: 'Variant not found' });
        const { product_id } = variant.rows[0];

        await pool.query(`UPDATE product_variants SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);

        await invalidateProductRelatedCaches(product_id, [id]);

        return res.status(200).json({ success: true, message: 'Variant deleted successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
