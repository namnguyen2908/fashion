import pool from '../config/db.js';

function priceSubquery(alias = 'pv') {
    return `COALESCE((SELECT price FROM variant_prices WHERE variant_id = ${alias}.id), 0) AS price`;
}

// =========================================
// SUPPLIERS
// =========================================
export const listSuppliers = async (req, res) => {
    try {
        const { search, active } = req.query;
        let where = '';
        const params = [];
        let idx = 1;

        if (search) {
            where = `WHERE (s.name ILIKE $${idx} OR s.code ILIKE $${idx} OR s.contact_name ILIKE $${idx})`;
            params.push(`%${search}%`);
            idx++;
        }
        if (active === 'true') {
            where += where ? ' AND' : 'WHERE';
            where += ` s.is_active = true`;
        }

        const result = await pool.query(`
            SELECT s.* FROM suppliers s ${where} ORDER BY s.name ASC
        `, params);

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('listSuppliers error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getSupplierById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`SELECT * FROM suppliers WHERE id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }
        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('getSupplierById error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const createSupplier = async (req, res) => {
    try {
        const { name, code, contact_name, phone, email, address } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Supplier name is required' });
        }
        const supplierCode = code || `NCC-${Date.now()}`;
        const result = await pool.query(`
            INSERT INTO suppliers (name, code, contact_name, phone, email, address)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [name.trim(), supplierCode, contact_name || null, phone || null, email || null, address || null]);

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ success: false, message: 'Supplier code already exists' });
        }
        console.error('createSupplier error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const updateSupplier = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, contact_name, phone, email, address, is_active } = req.body;

        const existing = await pool.query(`SELECT id FROM suppliers WHERE id = $1`, [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }

        const result = await pool.query(`
            UPDATE suppliers SET
                name = COALESCE($1, name),
                code = COALESCE($2, code),
                contact_name = COALESCE($3, contact_name),
                phone = COALESCE($4, phone),
                email = COALESCE($5, email),
                address = COALESCE($6, address),
                is_active = COALESCE($7, is_active)
            WHERE id = $8
            RETURNING *
        `, [name || null, code || null, contact_name ?? null, phone ?? null, email ?? null, address ?? null, is_active ?? null, id]);

        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ success: false, message: 'Supplier code already exists' });
        }
        console.error('updateSupplier error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getAllStocks = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, low_stock, threshold = 5 } = req.query;
        const offset = (Math.max(Number(page), 1) - 1) * Number(limit);

        let where = '';
        const params = [];
        let paramIndex = 1;

        if (search) {
            where = `WHERE (p.name ILIKE $${paramIndex} OR pv.sku ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (low_stock === 'true') {
            where += where ? ' AND' : 'WHERE';
            where += ` COALESCE(inv.stock_qty, 0) < $${paramIndex}`;
            params.push(Number(threshold));
            paramIndex++;
        }

        const countResult = await pool.query(`
            SELECT COUNT(*) as total
            FROM product_variants pv
            JOIN products p ON pv.product_id = p.id
            LEFT JOIN inventory inv ON pv.id = inv.variant_id
            ${where}
        `, params);

        const result = await pool.query(`
            SELECT pv.id AS variant_id, pv.sku, pv.color, pv.size, ${priceSubquery()},
                   p.id AS product_id, p.name AS product_name, p.slug AS product_slug,
                   COALESCE(inv.stock_qty, 0) AS stock_qty,
                   inv.updated_at AS stock_updated_at
            FROM product_variants pv
            JOIN products p ON pv.product_id = p.id
            LEFT JOIN inventory inv ON pv.id = inv.variant_id
            ${where}
            ORDER BY stock_qty ASC, p.name ASC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...params, Number(limit), offset]);

        return res.status(200).json({
            success: true,
            data: result.rows,
            total: Number(countResult.rows[0].total),
            totalPages: Math.ceil(Number(countResult.rows[0].total) / Number(limit)),
            currentPage: Number(page),
            limit: Number(limit)
        });
    } catch (error) {
        console.error('getAllStocks error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getVariantStock = async (req, res) => {
    try {
        const { variantId } = req.params;

        const result = await pool.query(
            `SELECT inv.variant_id, inv.stock_qty, inv.updated_at,
                    pv.sku, pv.color, pv.size, ${priceSubquery()},
                    p.id AS product_id, p.name AS product_name
             FROM inventory inv
             JOIN product_variants pv ON inv.variant_id = pv.id
             JOIN products p ON pv.product_id = p.id
             WHERE inv.variant_id = $1`,
            [variantId]
        );

        if (result.rows.length === 0) {
            const variant = await pool.query(
                `SELECT pv.id, pv.sku, pv.color, pv.size, ${priceSubquery()},
                        p.id AS product_id, p.name AS product_name
                 FROM product_variants pv
                 JOIN products p ON pv.product_id = p.id
                 WHERE pv.id = $1`,
                [variantId]
            );
            if (variant.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Variant not found' });
            }
            return res.status(200).json({
                success: true,
                data: { ...variant.rows[0], stock_qty: 0 }
            });
        }

        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('getVariantStock error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getProductStocks = async (req, res) => {
    try {
        const { productId } = req.params;

        const result = await pool.query(`
            SELECT pv.id AS variant_id, pv.sku, pv.color, pv.size, ${priceSubquery()},
                   COALESCE(inv.stock_qty, 0) AS stock_qty
            FROM product_variants pv
            LEFT JOIN inventory inv ON pv.id = inv.variant_id
            WHERE pv.product_id = $1 AND pv.is_active = true
            ORDER BY pv.color, pv.size
        `, [productId]);

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('getProductStocks error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const createStockReceipt = async (req, res) => {
    try {
        const { supplier_id, notes, items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Items are required' });
        }

        for (const item of items) {
            if (!item.variant_id || !item.quantity || item.quantity <= 0) {
                return res.status(400).json({ success: false, message: 'Invalid item data' });
            }
        }

        if (supplier_id) {
            const supplier = await pool.query(`SELECT id FROM suppliers WHERE id = $1 AND is_active = true`, [supplier_id]);
            if (supplier.rows.length === 0) {
                return res.status(400).json({ success: false, message: 'Supplier not found or inactive' });
            }
        }

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.floor(Math.random() * 9000) + 1000;
        const receiptCode = `PN-${dateStr}-${rand}`;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const receiptResult = await client.query(`
                INSERT INTO stock_receipts (receipt_code, supplier_id, created_by, notes)
                VALUES ($1, $2, $3, $4)
                RETURNING id, receipt_code, receipt_date, supplier_id, created_by, notes, created_at
            `, [receiptCode, supplier_id || null, req.user.userId, notes || null]);

            const receiptId = receiptResult.rows[0].id;

            for (const item of items) {
                await client.query(`
                    INSERT INTO stock_receipt_details (stock_receipt_id, variant_id, quantity, unit_cost)
                    VALUES ($1, $2, $3, $4)
                `, [receiptId, item.variant_id, item.quantity, item.unit_cost || null]);

                await client.query(`
                    INSERT INTO inventory (variant_id, stock_qty)
                    VALUES ($1, $2)
                    ON CONFLICT (variant_id)
                    DO UPDATE SET stock_qty = inventory.stock_qty + $2, updated_at = NOW()
                `, [item.variant_id, item.quantity]);
            }

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                message: 'Stock receipt created successfully',
                data: receiptResult.rows[0]
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('createStockReceipt error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const listStockReceipts = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Math.max(Number(page), 1) - 1) * Number(limit);

        const countResult = await pool.query(
            `SELECT COUNT(*) as total FROM stock_receipts`
        );

        const result = await pool.query(`
            SELECT sr.id, sr.receipt_code, sr.receipt_date, sr.supplier_id, sr.notes, sr.created_at,
                   u.name AS created_by_name,
                   s.name AS supplier_name
            FROM stock_receipts sr
            LEFT JOIN users u ON sr.created_by = u.id
            LEFT JOIN suppliers s ON sr.supplier_id = s.id
            ORDER BY sr.created_at DESC
            LIMIT $1 OFFSET $2
        `, [Number(limit), offset]);

        return res.status(200).json({
            success: true,
            data: result.rows,
            total: Number(countResult.rows[0].total),
            totalPages: Math.ceil(Number(countResult.rows[0].total) / Number(limit)),
            currentPage: Number(page),
            limit: Number(limit)
        });
    } catch (error) {
        console.error('listStockReceipts error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getStockReceiptById = async (req, res) => {
    try {
        const { id } = req.params;

        const receipt = await pool.query(`
            SELECT sr.*, u.name AS created_by_name,
                   s.name AS supplier_name, s.code AS supplier_code
            FROM stock_receipts sr
            LEFT JOIN users u ON sr.created_by = u.id
            LEFT JOIN suppliers s ON sr.supplier_id = s.id
            WHERE sr.id = $1
        `, [id]);

        if (receipt.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Stock receipt not found' });
        }

        const details = await pool.query(`
            SELECT srd.id, srd.variant_id, srd.quantity, srd.unit_cost, srd.created_at,
                   pv.sku, pv.color, pv.size, ${priceSubquery()},
                   p.name AS product_name, p.id AS product_id
            FROM stock_receipt_details srd
            JOIN product_variants pv ON srd.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            WHERE srd.stock_receipt_id = $1
            ORDER BY p.name, pv.color, pv.size
        `, [id]);

        return res.status(200).json({
            success: true,
            data: { ...receipt.rows[0], items: details.rows }
        });
    } catch (error) {
        console.error('getStockReceiptById error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// SUPPLIER VARIANTS
// =========================================
export const getSupplierVariants = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT sv.id, sv.variant_id, sv.cost_price, sv.previous_cost_price, sv.updated_at,
                   pv.sku, pv.color, pv.size, ${priceSubquery()},
                   p.name AS product_name, p.id AS product_id
            FROM supplier_variants sv
            JOIN product_variants pv ON sv.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            WHERE sv.supplier_id = $1
            ORDER BY p.name, pv.color, pv.size
        `, [id]);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('getSupplierVariants error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const addSupplierVariant = async (req, res) => {
    try {
        const { id } = req.params;
        const { variant_id, cost_price } = req.body;

        if (!variant_id) {
            return res.status(400).json({ success: false, message: 'variant_id is required' });
        }

        const supplier = await pool.query(`SELECT id FROM suppliers WHERE id = $1 AND is_active = true`, [id]);
        if (supplier.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }

        const existing = await pool.query(
            `SELECT sv.id, sv.cost_price FROM supplier_variants sv WHERE sv.supplier_id = $1 AND sv.variant_id = $2`,
            [id, variant_id]
        );

        let result;
        if (existing.rows.length > 0) {
            result = await pool.query(`
                UPDATE supplier_variants SET
                    previous_cost_price = cost_price,
                    cost_price = COALESCE($1, cost_price),
                    updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `, [cost_price || null, existing.rows[0].id]);
        } else {
            result = await pool.query(`
                INSERT INTO supplier_variants (supplier_id, variant_id, cost_price)
                VALUES ($1, $2, $3)
                RETURNING *
            `, [id, variant_id, cost_price || null]);
        }

        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('addSupplierVariant error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const updateSupplierVariant = async (req, res) => {
    try {
        const { id, variantId } = req.params;
        const { cost_price } = req.body;

        const result = await pool.query(`
            UPDATE supplier_variants SET
                previous_cost_price = cost_price,
                cost_price = $1,
                updated_at = NOW()
            WHERE supplier_id = $2 AND variant_id = $3
            RETURNING *
        `, [cost_price || null, id, variantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Supplier variant not found' });
        }

        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('updateSupplierVariant error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const deleteSupplierVariant = async (req, res) => {
    try {
        const { id, variantId } = req.params;
        const result = await pool.query(
            `DELETE FROM supplier_variants WHERE supplier_id = $1 AND variant_id = $2 RETURNING id`,
            [id, variantId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Supplier variant not found' });
        }
        return res.status(200).json({ success: true, message: 'Removed' });
    } catch (error) {
        console.error('deleteSupplierVariant error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getVariantSuppliers = async (req, res) => {
    try {
        const { variantId } = req.params;
        const result = await pool.query(`
            SELECT sv.cost_price, sv.previous_cost_price, sv.updated_at,
                   s.id AS supplier_id, s.name AS supplier_name, s.code AS supplier_code
            FROM supplier_variants sv
            JOIN suppliers s ON sv.supplier_id = s.id
            WHERE sv.variant_id = $1 AND s.is_active = true
            ORDER BY sv.cost_price ASC NULLS LAST
        `, [variantId]);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('getVariantSuppliers error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getSuppliersByVariantIds = async (req, res) => {
    try {
        const { ids } = req.query;
        if (!ids) {
            return res.status(400).json({ success: false, message: 'ids query param is required (comma-separated)' });
        }
        const variantIds = ids.split(',').map(Number).filter(Boolean);
        if (variantIds.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        const result = await pool.query(`
            SELECT DISTINCT s.id, s.name, s.code
            FROM supplier_variants sv
            JOIN suppliers s ON sv.supplier_id = s.id
            WHERE sv.variant_id = ANY($1) AND s.is_active = true
            ORDER BY s.name
        `, [variantIds]);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('getSuppliersByVariantIds error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
