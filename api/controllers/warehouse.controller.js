import pool from '../config/db.js';
import { applyStockChange, transferStock } from '../utils/stock.js';

function priceSubquery(alias = 'pv') {
    return `COALESCE((SELECT price FROM variant_prices WHERE variant_id = ${alias}.id), 0) AS price`;
}

function genCode(prefix) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `${prefix}-${dateStr}-${rand}`;
}

async function ensureActiveWarehouse(clientOrPool, warehouseId) {
    const result = await clientOrPool.query(
        `SELECT id FROM warehouses WHERE id = $1 AND is_active = true`, [warehouseId]
    );
    if (result.rows.length === 0) {
        throw new Error('Warehouse not found or inactive');
    }
}

// =========================================
// WAREHOUSES
// =========================================
export const listWarehouses = async (req, res) => {
    try {
        const { search, active } = req.query;
        let where = '';
        const params = [];
        let idx = 1;

        if (search) {
            where = `WHERE (w.name ILIKE $${idx} OR w.code ILIKE $${idx})`;
            params.push(`%${search}%`);
            idx++;
        }
        if (active === 'true') {
            where += where ? ' AND' : 'WHERE';
            where += ` w.is_active = true`;
        }

        const result = await pool.query(`
            SELECT w.*,
                   COALESCE((SELECT SUM(ib.stock_qty) FROM inventory_balances ib WHERE ib.warehouse_id = w.id), 0) AS total_stock
            FROM warehouses w ${where}
            ORDER BY w.is_active DESC, w.name ASC
        `, params);

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('listWarehouses error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const createWarehouse = async (req, res) => {
    try {
        const { name, code, location } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Warehouse name is required' });
        }
        const warehouseCode = code || genCode('KHO');
        const result = await pool.query(`
            INSERT INTO warehouses (name, code, location)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [name.trim(), warehouseCode, location || null]);

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ success: false, message: 'Warehouse code already exists' });
        }
        console.error('createWarehouse error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const updateWarehouse = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, location, is_active } = req.body;

        const existing = await pool.query(`SELECT id FROM warehouses WHERE id = $1`, [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Warehouse not found' });
        }

        const result = await pool.query(`
            UPDATE warehouses SET
                name = COALESCE($1, name),
                code = COALESCE($2, code),
                location = COALESCE($3, location),
                is_active = COALESCE($4, is_active)
            WHERE id = $5
            RETURNING *
        `, [name || null, code || null, location ?? null, is_active ?? null, id]);

        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ success: false, message: 'Warehouse code already exists' });
        }
        console.error('updateWarehouse error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

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
        const supplierCode = code || genCode('NCC');
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

// =========================================
// STOCKS
// =========================================
export const getAllStocks = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, low_stock, threshold = 5, warehouse_id } = req.query;
        const offset = (Math.max(Number(page), 1) - 1) * Number(limit);

        let where = '';
        let having = '';
        let warehouseJoin = '';
        const params = [];
        let paramIndex = 1;

        if (search) {
            where = `WHERE (p.name ILIKE $${paramIndex} OR pv.sku ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (warehouse_id) {
            warehouseJoin = ` AND ib.warehouse_id = $${paramIndex}`;
            params.push(Number(warehouse_id));
            paramIndex++;
        }

        if (low_stock === 'true') {
            having = `HAVING COALESCE(SUM(ib.stock_qty), 0) < $${paramIndex}`;
            params.push(Number(threshold));
            paramIndex++;
        }

        const fromClause = `
            FROM product_variants pv
            JOIN products p ON pv.product_id = p.id
            LEFT JOIN inventory_balances ib ON pv.id = ib.variant_id${warehouseJoin}
            ${where}
        `;

        const countResult = await pool.query(`
            SELECT COUNT(*) as total
            FROM (SELECT pv.id ${fromClause} GROUP BY pv.id ${having}) t
        `, params);

        const result = await pool.query(`
            SELECT pv.id AS variant_id, pv.sku, pv.color, pv.size, ${priceSubquery()},
                   p.id AS product_id, p.name AS product_name, p.slug AS product_slug,
                   COALESCE(SUM(ib.stock_qty), 0) AS stock_qty,
                   MAX(ib.updated_at) AS stock_updated_at
            ${fromClause}
            GROUP BY pv.id, pv.sku, pv.color, pv.size, p.id, p.name, p.slug
            ${having}
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
        const { warehouse_id } = req.query;

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

        if (warehouse_id) {
            const balance = await pool.query(
                `SELECT COALESCE(stock_qty, 0) AS stock_qty, updated_at
                 FROM inventory_balances WHERE warehouse_id = $1 AND variant_id = $2`,
                [Number(warehouse_id), variantId]
            );
            const data = {
                ...variant.rows[0],
                warehouse_id: Number(warehouse_id),
                stock_qty: balance.rows.length > 0 ? Number(balance.rows[0].stock_qty) : 0,
                updated_at: balance.rows.length > 0 ? balance.rows[0].updated_at : null
            };
            return res.status(200).json({ success: true, data });
        }

        const balances = await pool.query(`
            SELECT ib.warehouse_id, w.name AS warehouse_name, ib.stock_qty, ib.updated_at
            FROM inventory_balances ib
            JOIN warehouses w ON ib.warehouse_id = w.id
            WHERE ib.variant_id = $1
            ORDER BY ib.stock_qty DESC
        `, [variantId]);

        return res.status(200).json({
            success: true,
            data: {
                ...variant.rows[0],
                stock_qty: balances.rows.reduce((s, b) => s + Number(b.stock_qty), 0),
                balances: balances.rows,
                updated_at: balances.rows.length > 0 ? balances.rows[0].updated_at : null
            }
        });
    } catch (error) {
        console.error('getVariantStock error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getProductStocks = async (req, res) => {
    try {
        const { productId } = req.params;
        const { warehouse_id } = req.query;

        const warehouseJoin = warehouse_id ? ` AND ib.warehouse_id = ${Number(warehouse_id)}` : '';

        const result = await pool.query(`
            SELECT pv.id AS variant_id, pv.sku, pv.color, pv.size, ${priceSubquery()},
                   COALESCE(SUM(ib.stock_qty), 0) AS stock_qty
            FROM product_variants pv
            LEFT JOIN inventory_balances ib ON pv.id = ib.variant_id${warehouseJoin}
            WHERE pv.product_id = $1 AND pv.is_active = true
            GROUP BY pv.id, pv.sku, pv.color, pv.size
            ORDER BY pv.color, pv.size
        `, [productId]);

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('getProductStocks error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// GOODS RECEIPTS
// =========================================
export const createStockReceipt = async (req, res) => {
    try {
        const { supplier_id, warehouse_id, notes, items } = req.body;

        if (!warehouse_id) {
            return res.status(400).json({ success: false, message: 'Warehouse is required' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Items are required' });
        }
        for (const item of items) {
            if (!item.variant_id || !item.quantity || item.quantity <= 0) {
                return res.status(400).json({ success: false, message: 'Invalid item data' });
            }
        }

        try {
            await ensureActiveWarehouse(pool, warehouse_id);
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        if (supplier_id) {
            const supplier = await pool.query(`SELECT id FROM suppliers WHERE id = $1 AND is_active = true`, [supplier_id]);
            if (supplier.rows.length === 0) {
                return res.status(400).json({ success: false, message: 'Supplier not found or inactive' });
            }
        }

        const receiptCode = genCode('PN');
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const receiptResult = await client.query(`
                INSERT INTO goods_receipts (receipt_code, supplier_id, warehouse_id, created_by, notes)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, receipt_code, receipt_date, supplier_id, warehouse_id, created_by, notes, created_at
            `, [receiptCode, supplier_id || null, warehouse_id, req.user.userId, notes || null]);

            const receiptId = receiptResult.rows[0].id;

            for (const item of items) {
                const itemResult = await client.query(`
                    INSERT INTO goods_receipt_items (goods_receipt_id, variant_id, quantity, unit_cost)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                `, [receiptId, item.variant_id, item.quantity, item.unit_cost || null]);

                await applyStockChange(client, {
                    warehouseId: warehouse_id,
                    variantId: item.variant_id,
                    qtyChange: item.quantity,
                    refType: 'GOODS_RECEIPT',
                    refId: itemResult.rows[0].id,
                    unitCost: item.unit_cost || null,
                    createdBy: req.user.userId,
                    note: receiptCode,
                });
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
            `SELECT COUNT(*) as total FROM goods_receipts`
        );

        const result = await pool.query(`
            SELECT gr.id, gr.receipt_code, gr.receipt_date, gr.supplier_id, gr.warehouse_id, gr.notes, gr.created_at,
                   u.name AS created_by_name,
                   s.name AS supplier_name,
                   w.name AS warehouse_name
            FROM goods_receipts gr
            LEFT JOIN users u ON gr.created_by = u.id
            LEFT JOIN suppliers s ON gr.supplier_id = s.id
            LEFT JOIN warehouses w ON gr.warehouse_id = w.id
            ORDER BY gr.created_at DESC
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
            SELECT gr.*, u.name AS created_by_name,
                   s.name AS supplier_name, s.code AS supplier_code,
                   w.name AS warehouse_name
            FROM goods_receipts gr
            LEFT JOIN users u ON gr.created_by = u.id
            LEFT JOIN suppliers s ON gr.supplier_id = s.id
            LEFT JOIN warehouses w ON gr.warehouse_id = w.id
            WHERE gr.id = $1
        `, [id]);

        if (receipt.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Stock receipt not found' });
        }

        const details = await pool.query(`
            SELECT gri.id, gri.variant_id, gri.quantity, gri.unit_cost, gri.created_at,
                   pv.sku, pv.color, pv.size, ${priceSubquery()},
                   p.name AS product_name, p.id AS product_id
            FROM goods_receipt_items gri
            JOIN product_variants pv ON gri.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            WHERE gri.goods_receipt_id = $1
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
// INVENTORY TRANSACTIONS
// =========================================
export const listTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 20, ref_type, warehouse_id, variant_id, search } = req.query;
        const offset = (Math.max(Number(page), 1) - 1) * Number(limit);

        let where = 'WHERE 1 = 1';
        const params = [];
        let idx = 1;

        if (ref_type) {
            where += ` AND it.ref_type = $${idx}`;
            params.push(ref_type);
            idx++;
        }
        if (warehouse_id) {
            where += ` AND it.warehouse_id = $${idx}`;
            params.push(Number(warehouse_id));
            idx++;
        }
        if (variant_id) {
            where += ` AND it.variant_id = $${idx}`;
            params.push(Number(variant_id));
            idx++;
        }
        if (search) {
            where += ` AND (p.name ILIKE $${idx} OR pv.sku ILIKE $${idx})`;
            params.push(`%${search}%`);
            idx++;
        }

        const countResult = await pool.query(`
            SELECT COUNT(*) as total
            FROM inventory_transactions it
            JOIN product_variants pv ON it.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            ${where}
        `, params);

        const result = await pool.query(`
            SELECT it.id, it.qty_change, it.balance_after, it.ref_type, it.ref_id, it.unit_cost, it.note, it.created_at,
                   it.variant_id, pv.sku, pv.color, pv.size, ${priceSubquery()},
                   p.id AS product_id, p.name AS product_name,
                   w.id AS warehouse_id, w.name AS warehouse_name,
                   u.name AS created_by_name
            FROM inventory_transactions it
            JOIN product_variants pv ON it.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            JOIN warehouses w ON it.warehouse_id = w.id
            LEFT JOIN users u ON it.created_by = u.id
            ${where}
            ORDER BY it.created_at DESC, it.id DESC
            LIMIT $${idx} OFFSET $${idx + 1}
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
        console.error('listTransactions error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// ADJUSTMENTS
// =========================================
export const createAdjustment = async (req, res) => {
    try {
        const { warehouse_id, items, note } = req.body;

        if (!warehouse_id) {
            return res.status(400).json({ success: false, message: 'Warehouse is required' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Items are required' });
        }
        for (const item of items) {
            if (!item.variant_id || !item.quantity || item.quantity === 0) {
                return res.status(400).json({ success: false, message: 'Invalid item data' });
            }
        }

        try {
            await ensureActiveWarehouse(pool, warehouse_id);
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        const adjCode = genCode('DCNH');
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            for (const item of items) {
                await applyStockChange(client, {
                    warehouseId: warehouse_id,
                    variantId: item.variant_id,
                    qtyChange: item.quantity,
                    refType: 'ADJUSTMENT',
                    refId: null,
                    unitCost: null,
                    createdBy: req.user.userId,
                    note: `${adjCode}${note ? ` - ${note}` : ''}`,
                });
            }

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                message: 'Adjustment created successfully',
                data: { adjustment_code: adjCode }
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        if (error.message === 'INSUFFICIENT_STOCK') {
            return res.status(400).json({ success: false, message: 'Insufficient stock for adjustment' });
        }
        console.error('createAdjustment error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const listAdjustments = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Math.max(Number(page), 1) - 1) * Number(limit);

        const countResult = await pool.query(
            `SELECT COUNT(*) as total FROM inventory_transactions WHERE ref_type = 'ADJUSTMENT'`
        );

        const result = await pool.query(`
            SELECT it.id, it.qty_change, it.balance_after, it.note, it.created_at,
                   it.variant_id, pv.sku, pv.color, pv.size, ${priceSubquery()},
                   p.name AS product_name,
                   w.name AS warehouse_name,
                   u.name AS created_by_name
            FROM inventory_transactions it
            JOIN product_variants pv ON it.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            JOIN warehouses w ON it.warehouse_id = w.id
            LEFT JOIN users u ON it.created_by = u.id
            WHERE it.ref_type = 'ADJUSTMENT'
            ORDER BY it.created_at DESC, it.id DESC
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
        console.error('listAdjustments error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// TRANSFERS
// =========================================
export const createTransfer = async (req, res) => {
    try {
        const { from_warehouse_id, to_warehouse_id, items, note } = req.body;

        if (!from_warehouse_id || !to_warehouse_id) {
            return res.status(400).json({ success: false, message: 'From and to warehouse are required' });
        }
        if (Number(from_warehouse_id) === Number(to_warehouse_id)) {
            return res.status(400).json({ success: false, message: 'Cannot transfer to the same warehouse' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Items are required' });
        }
        for (const item of items) {
            if (!item.variant_id || !item.quantity || item.quantity <= 0) {
                return res.status(400).json({ success: false, message: 'Invalid item data' });
            }
        }

        try {
            await ensureActiveWarehouse(pool, from_warehouse_id);
            await ensureActiveWarehouse(pool, to_warehouse_id);
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        const transferCode = genCode('CN');
        const transferNote = note ? `${transferCode} - ${note}` : transferCode;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            for (const item of items) {
                await transferStock(client, {
                    fromWarehouseId: from_warehouse_id,
                    toWarehouseId: to_warehouse_id,
                    variantId: item.variant_id,
                    quantity: item.quantity,
                    createdBy: req.user.userId,
                    note: transferNote,
                });
            }

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                message: 'Transfer created successfully',
                data: { transfer_code: transferNote }
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        if (error.message === 'INSUFFICIENT_STOCK') {
            return res.status(400).json({ success: false, message: 'Insufficient stock for transfer' });
        }
        console.error('createTransfer error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const listTransfers = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Math.max(Number(page), 1) - 1) * Number(limit);

        const countResult = await pool.query(`
            SELECT COUNT(DISTINCT note) as total FROM inventory_transactions WHERE ref_type = 'TRANSFER'
        `);

        const result = await pool.query(`
            SELECT t.note AS transfer_code, t.created_at, t.created_by,
                   u.name AS created_by_name,
                   COUNT(*) AS item_count,
                   SUM(ABS(t.qty_change)) AS total_qty,
                   MAX(CASE WHEN t.qty_change < 0 THEN w.name END) AS from_warehouse_name,
                   MAX(CASE WHEN t.qty_change > 0 THEN w.name END) AS to_warehouse_name
            FROM inventory_transactions t
            JOIN warehouses w ON t.warehouse_id = w.id
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.ref_type = 'TRANSFER'
            GROUP BY t.note, t.created_at, t.created_by, u.name
            ORDER BY t.created_at DESC
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
        console.error('listTransfers error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getTransferByCode = async (req, res) => {
    try {
        const { code } = req.params;

        const header = await pool.query(`
            SELECT t.note AS transfer_code, t.created_at, t.created_by,
                   u.name AS created_by_name,
                   COUNT(*) AS item_count,
                   MAX(CASE WHEN t.qty_change < 0 THEN w.name END) AS from_warehouse_name,
                   MAX(CASE WHEN t.qty_change > 0 THEN w.name END) AS to_warehouse_name
            FROM inventory_transactions t
            JOIN warehouses w ON t.warehouse_id = w.id
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.ref_type = 'TRANSFER' AND t.note = $1
            GROUP BY t.note, t.created_at, t.created_by, u.name
        `, [code]);

        if (header.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Transfer not found' });
        }

        const items = await pool.query(`
            SELECT it.id, it.qty_change, it.balance_after, it.ref_id, it.created_at,
                   it.variant_id, pv.sku, pv.color, pv.size,
                   p.id AS product_id, p.name AS product_name,
                   w.id AS warehouse_id, w.name AS warehouse_name
            FROM inventory_transactions it
            JOIN product_variants pv ON it.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            JOIN warehouses w ON it.warehouse_id = w.id
            WHERE it.ref_type = 'TRANSFER' AND it.note = $1
            ORDER BY it.ref_id, (CASE WHEN it.qty_change < 0 THEN 0 ELSE 1 END), it.id
        `, [code]);

        return res.status(200).json({
            success: true,
            data: { ...header.rows[0], items: items.rows }
        });
    } catch (error) {
        console.error('getTransferByCode error:', error);
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
