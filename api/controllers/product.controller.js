import pool from '../config/db.js';
import {
    getCache,
    getCacheEntry,
    getCacheVersion,
    setCache,
    setNotFoundCache,
    deleteCache,
    incrCache,
    invalidateProductRelatedCaches,
} from '../utils/cache.js';
import { generateSlug } from '../utils/slugify.js';
import { effectivePriceSubquery, formatPriceData } from '../utils/price.js';

const stripTotalCount = (rows) =>
    rows.map(({ total_count, ...product }) => product);

// =========================================
// GET ALL PRODUCTS
// =========================================
export const getProducts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            category,
            show_all,
            warehouse_id
        } = req.query;

        const currentPage = Math.max(Number(page), 1);

        const pageLimit = Math.min(
            Math.max(Number(limit), 1),
            50
        );

        const offset = (currentPage - 1) * pageLimit;

        const version = await getCacheVersion('products:version', 1);

        const cacheKey =
            `products:v${version}:page=${currentPage}:limit=${pageLimit}:search=${search}:category=${category || 'all'}:wh=${warehouse_id || 'all'}`;

        const cachedProducts = await getCache(cacheKey);

        if (cachedProducts) {
            return res.status(200).json({
                source: 'redis',
                ...cachedProducts
            });
        }

        const values = [];
        const where = [];

        if (warehouse_id && /^\d+$/.test(String(warehouse_id))) {
            values.push(Number(warehouse_id));
        }

        if (search) {
            values.push(`%${search}%`);
            where.push(`p.name ILIKE $${values.length}`);
        }

        if (!show_all) {
            where.push(`p.is_active = true`);
        }

        if (category) {
            values.push(category);
            where.push(`p.category_id = $${values.length}`);
        }

        const totalStockExpr = values.length
            ? `(SELECT COALESCE(SUM(ib.on_hand), 0) FROM inventory_balances ib
                JOIN product_variants pv ON pv.id = ib.variant_id
                WHERE pv.product_id = p.id AND ib.warehouse_id = $1)`
            : `0`;

        let query = `
            SELECT
                p.id,
                p.name,
                p.slug,
                p.description,
                p.created_at,
                p.is_active,
                c.id AS category_id,
                c.name AS category_name,
                (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id) AS variant_count,
                (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = p.id) AS image_count,
                COALESCE(
                    (SELECT pi.image_url FROM product_images pi
                     WHERE pi.product_id = p.id AND pi.is_thumbnail = true
                     ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1),
                    (SELECT pi.image_url FROM product_images pi
                     WHERE pi.product_id = p.id
                     ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1)
                ) AS image_url,
                ${totalStockExpr} AS total_stock,
                (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', pv.id,
                    'color', pv.color,
                    'size', pv.size,
                    'sku', pv.sku,
                    'is_active', pv.is_active,
                    'price', COALESCE((SELECT price FROM variant_prices WHERE variant_id = pv.id), 0),
                    'price_data', ${effectivePriceSubquery('pv.id')}
                )), '[]'::jsonb) FROM product_variants pv WHERE pv.product_id = p.id) AS variants,
                COUNT(*) OVER() AS total_count
            FROM products p
            LEFT JOIN categories c
            ON p.category_id = c.id
        `;

        if (where.length) {
            query += ` WHERE ${where.join(' AND ')}`;
        }

        values.push(pageLimit);
        query += ` ORDER BY p.created_at DESC LIMIT $${values.length}`;

        values.push(offset);
        query += ` OFFSET $${values.length}`;

        const result = await pool.query(query, values);

        const products = result.rows;

        products.forEach(p => {
            if (p.variants) {
                p.variants = p.variants.map(v => formatPriceData(v));
            }
        });

        const total =
            products.length > 0
                ? Number(products[0].total_count)
                : 0;

        const response = {
            success: true,
            total,
            totalPages: Math.ceil(total / pageLimit),
            currentPage,
            limit: pageLimit,
            data: stripTotalCount(products),
        };

        await setCache(cacheKey, response, 300);

        return res.status(200).json(response);

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};


// =========================================
// GET PRODUCT BY ID
// =========================================
export const getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        const cacheKey = `v2:product:${id}`;

        const cached = await getCacheEntry(cacheKey);

        if (cached.notFound) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        if (cached.hit && cached.value) {
            return res.status(200).json({
                success: true,
                data: cached.value
            });
        }

        const result = await pool.query(
            `
            SELECT
                p.id,
                p.name,
                p.slug,
                p.description,
                p.category_id,
                p.created_at,
                c.name AS category_name,
                (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', pv.id,
                    'color', pv.color,
                    'size', pv.size,
                    'sku', pv.sku,
                    'is_active', pv.is_active,
                    'price', COALESCE((SELECT price FROM variant_prices WHERE variant_id = pv.id), 0),
                    'price_data', ${effectivePriceSubquery('pv.id')}
                )), '[]'::jsonb) FROM product_variants pv WHERE pv.product_id = p.id) AS variants
            FROM products p
            LEFT JOIN categories c
            ON p.category_id = c.id
            WHERE p.id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            await setNotFoundCache(cacheKey, 60);

            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const product = result.rows[0];

        if (product.variants) {
            product.variants = product.variants.map(v => formatPriceData(v));
        }

        await setCache(cacheKey, product, 60);

        return res.status(200).json({
            success: true,
            data: product
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};


// =========================================
// GET PRODUCT BY SLUG
// =========================================
export const getProductBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const result = await pool.query(
            `
            SELECT
                p.id,
                p.name,
                p.slug,
                p.description,
                p.category_id,
                p.created_at,
                c.name AS category_name,
                (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', pv.id,
                    'color', pv.color,
                    'size', pv.size,
                    'sku', pv.sku,
                    'is_active', pv.is_active,
                    'price', COALESCE((SELECT price FROM variant_prices WHERE variant_id = pv.id), 0),
                    'price_data', ${effectivePriceSubquery('pv.id')}
                )), '[]'::jsonb) FROM product_variants pv WHERE pv.product_id = p.id) AS variants
            FROM products p
            LEFT JOIN categories c
            ON p.category_id = c.id
            WHERE p.slug = $1
            `,
            [slug]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const product = result.rows[0];

        if (product.variants) {
            product.variants = product.variants.map(v => formatPriceData(v));
        }

        return res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// =========================================
// CREATE PRODUCT (standalone — variants & images via separate APIs)
// =========================================
export const createProduct = async (req, res) => {
    try {
        const { name, category_id, description } = req.body;

        if (!name || !category_id) {
            return res.status(400).json({ success: false, message: 'Name and category are required' });
        }

        const category = await pool.query('SELECT id FROM categories WHERE id = $1', [category_id]);
        if (category.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        const childCategory = await pool.query(
            'SELECT id FROM categories WHERE parent_id = $1 LIMIT 1', [category_id]
        );
        if (childCategory.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Cannot assign product to parent category' });
        }

        let slug = generateSlug(name);
        const existing = await pool.query('SELECT id FROM products WHERE slug LIKE $1', [`${slug}%`]);
        if (existing.rows.length > 0) {
            slug = `${slug}-${existing.rows.length + 1}`;
        }

        const result = await pool.query(
            `INSERT INTO products (category_id, name, slug, description) VALUES ($1, $2, $3, $4) RETURNING id, name, slug, category_id, description, created_at`,
            [category_id, name, slug, description || null]
        );

        await incrCache('products:version');

        return res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// UPDATE PRODUCT
// =========================================
export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category_id, description } = req.body;

        if (!name || !category_id) {
            return res.status(400).json({
                success: false,
                message: 'Name and category are required'
            });
        }

        const product = await pool.query(
            `SELECT id FROM products WHERE id = $1`,
            [id]
        );

        if (product.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const category = await pool.query(
            `SELECT id FROM categories WHERE id = $1`,
            [category_id]
        );

        if (category.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        const childCategory = await pool.query(
            `SELECT id FROM categories WHERE parent_id = $1 LIMIT 1`,
            [category_id]
        );

        if (childCategory.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot assign product to parent category'
            });
        }

        let slug = generateSlug(name);

        const duplicateSlug = await pool.query(
            `SELECT id FROM products WHERE slug = $1 AND id != $2`,
            [slug, id]
        );

        if (duplicateSlug.rows.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }

        const result = await pool.query(
            `
            UPDATE products
            SET category_id=$1, name=$2, slug=$3, description=$4
            WHERE id=$5
            RETURNING *
            `,
            [category_id, name, slug, description ?? null, id]
        );

        await invalidateProductRelatedCaches(id);

        return res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};


// =========================================
// DELETE PRODUCT
// =========================================
export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await pool.query(
            `SELECT id FROM products WHERE id = $1`,
            [id]
        );

        if (product.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const variantsResult = await pool.query(
            `SELECT id FROM product_variants WHERE product_id = $1`,
            [id]
        );
        const variantIds = variantsResult.rows.map((row) => row.id);

        await pool.query(
            `DELETE FROM products WHERE id=$1`,
            [id]
        );

        await invalidateProductRelatedCaches(id, variantIds);

        return res.status(200).json({
            success: true,
            message: 'Product deleted successfully'
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

export const toggleProductActive = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await pool.query(`SELECT id, is_active FROM products WHERE id = $1`, [id]);
        if (product.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const newStatus = !product.rows[0].is_active;
        await pool.query(`UPDATE products SET is_active = $1 WHERE id = $2`, [newStatus, id]);

        await invalidateProductRelatedCaches(id);

        return res.status(200).json({
            success: true,
            message: newStatus ? 'Product activated' : 'Product deactivated',
            data: { is_active: newStatus }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
