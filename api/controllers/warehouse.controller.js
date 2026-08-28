import pool from '../config/db.js';
import { applyStockChange, transferStock, nextDocCode } from '../utils/stock.js';
import { generateSlug } from '../utils/slugify.js';

function priceSubquery(alias = 'pv') {
    return `COALESCE((SELECT price FROM variant_prices WHERE variant_id = ${alias}.id), 0) AS price`;
}

async function ensureActiveWarehouse(clientOrPool, warehouseId) {
    const result = await clientOrPool.query(
        `SELECT id FROM warehouses WHERE id = $1 AND is_active = true`, [warehouseId]
    );
    if (result.rows.length === 0) {
        throw new Error('Kho không tồn tại hoặc ngừng hoạt động');
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
                   COALESCE((SELECT SUM(ib.on_hand) FROM inventory_balances ib WHERE ib.warehouse_id = w.id), 0) AS total_stock
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
            return res.status(400).json({ success: false, message: 'Tên kho là bắt buộc' });
        }
        const warehouseCode = code || `KHO-${Date.now()}`;
        const baseSlug = generateSlug(name.trim()) || `kho-${Date.now()}`;
        const existing = await pool.query(`SELECT slug FROM warehouses WHERE slug LIKE $1`, [`${baseSlug}%`]);
        const slug = existing.rows.length > 0 ? `${baseSlug}-${existing.rows.length + 1}` : baseSlug;
        const result = await pool.query(`
            INSERT INTO warehouses (name, code, slug, location)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [name.trim(), warehouseCode, slug, location || null]);

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ success: false, message: 'Mã kho hoặc slug đã tồn tại' });
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
            return res.status(404).json({ success: false, message: 'Không tìm thấy kho' });
        }

        let slug = null;
        if (name) {
            const baseSlug = generateSlug(name.trim()) || `kho-${Date.now()}`;
            const conflict = await pool.query(`SELECT id FROM warehouses WHERE slug = $1 AND id != $2`, [baseSlug, id]);
            slug = conflict.rows.length > 0 ? `${baseSlug}-${Date.now()}` : baseSlug;
        }

        const result = await pool.query(`
            UPDATE warehouses SET
                name = COALESCE($1, name),
                code = COALESCE($2, code),
                slug = COALESCE($3, slug),
                location = COALESCE($4, location),
                is_active = COALESCE($5, is_active)
            WHERE id = $6
            RETURNING *
        `, [name || null, code || null, slug, location ?? null, is_active ?? null, id]);

        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ success: false, message: 'Mã kho hoặc slug đã tồn tại' });
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
            return res.status(404).json({ success: false, message: 'Không tìm thấy nhà cung cấp' });
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
            return res.status(400).json({ success: false, message: 'Tên nhà cung cấp là bắt buộc' });
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
            return res.status(400).json({ success: false, message: 'Mã nhà cung cấp đã tồn tại' });
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
            return res.status(404).json({ success: false, message: 'Không tìm thấy nhà cung cấp' });
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
            return res.status(400).json({ success: false, message: 'Mã nhà cung cấp đã tồn tại' });
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
            having = `HAVING COALESCE(SUM(ib.on_hand), 0) < $${paramIndex}`;
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
                   COALESCE(SUM(ib.on_hand), 0) AS on_hand,
                   COALESCE(SUM(ib.reserved), 0) AS reserved,
                   COALESCE(SUM(ib.on_hand), 0) - COALESCE(SUM(ib.reserved), 0) AS available,
                   COALESCE(SUM(ib.on_hand), 0) AS stock_qty,
                   MAX(ib.updated_at) AS stock_updated_at
            ${fromClause}
            GROUP BY pv.id, pv.sku, pv.color, pv.size, p.id, p.name, p.slug
            ${having}
            ORDER BY on_hand ASC, p.name ASC
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
            return res.status(404).json({ success: false, message: 'Không tìm thấy biến thể' });
        }

        if (warehouse_id) {
            const balance = await pool.query(
                `SELECT COALESCE(on_hand, 0) AS on_hand, COALESCE(reserved, 0) AS reserved, updated_at
                 FROM inventory_balances WHERE warehouse_id = $1 AND variant_id = $2`,
                [Number(warehouse_id), variantId]
            );
            const onHand = balance.rows.length > 0 ? Number(balance.rows[0].on_hand) : 0;
            const reserved = balance.rows.length > 0 ? Number(balance.rows[0].reserved) : 0;
            return res.status(200).json({
                success: true,
                data: {
                    ...variant.rows[0],
                    warehouse_id: Number(warehouse_id),
                    on_hand: onHand,
                    reserved,
                    available: onHand - reserved,
                    stock_qty: onHand,
                    updated_at: balance.rows.length > 0 ? balance.rows[0].updated_at : null
                }
            });
        }

        const balances = await pool.query(`
            SELECT ib.warehouse_id, w.name AS warehouse_name, ib.on_hand, ib.reserved, ib.updated_at
            FROM inventory_balances ib
            JOIN warehouses w ON ib.warehouse_id = w.id
            WHERE ib.variant_id = $1
            ORDER BY ib.on_hand DESC
        `, [variantId]);

        const onHand = balances.rows.reduce((s, b) => s + Number(b.on_hand), 0);
        const reserved = balances.rows.reduce((s, b) => s + Number(b.reserved), 0);

        return res.status(200).json({
            success: true,
            data: {
                ...variant.rows[0],
                on_hand: onHand,
                reserved,
                available: onHand - reserved,
                stock_qty: onHand,
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
                   COALESCE(SUM(ib.on_hand), 0) AS on_hand,
                   COALESCE(SUM(ib.on_hand), 0) AS stock_qty
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
// INVENTORY TRANSACTIONS (sổ cái)
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
            SELECT it.id, it.qty_change, it.qty_before, it.qty_after, it.ref_type, it.ref_id,
                   it.unit_cost, it.note, it.created_at,
                   it.qty_after AS balance_after,
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
// INVENTORY COSTS (giá vốn)
// =========================================
export const listCosts = async (req, res) => {
    try {
        const { search } = req.query;
        let where = 'WHERE 1 = 1';
        const params = [];
        let idx = 1;
        if (search) {
            where += ` AND (p.name ILIKE $${idx} OR pv.sku ILIKE $${idx})`;
            params.push(`%${search}%`);
            idx++;
        }

        const result = await pool.query(`
            SELECT ic.variant_id, ic.current_cost, ic.updated_at,
                   pv.sku, pv.color, pv.size,
                   p.id AS product_id, p.name AS product_name
            FROM inventory_costs ic
            JOIN product_variants pv ON ic.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            ${where}
            ORDER BY p.name, pv.color, pv.size
        `, params);

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('listCosts error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// STOCK ADJUSTMENTS
// =========================================
export const createAdjustment = async (req, res) => {
    try {
        const { warehouse_id, reason, items } = req.body;

        if (!warehouse_id) {
            return res.status(400).json({ success: false, message: 'Kho là bắt buộc' });
        }
        if (!reason || !reason.trim()) {
            return res.status(400).json({ success: false, message: 'Lý do điều chỉnh là bắt buộc' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cần ít nhất một sản phẩm' });
        }
        for (const item of items) {
            if (!item.variant_id || !item.quantity || Number(item.quantity) === 0) {
                return res.status(400).json({ success: false, message: 'Dữ liệu sản phẩm không hợp lệ' });
            }
        }

        try {
            await ensureActiveWarehouse(pool, warehouse_id);
        } catch (e) {
            return res.status(400).json({ success: false, message: e.message });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const code = await nextDocCode(client, 'DCNH');
            const adj = await client.query(`
                INSERT INTO stock_adjustments (adjustment_code, warehouse_id, reason, source, status, created_by)
                VALUES ($1, $2, $3, 'MANUAL', 'DRAFT', $4)
                RETURNING *
            `, [code, warehouse_id, reason.trim(), req.user.userId]);

            for (const item of items) {
                await client.query(`
                    INSERT INTO stock_adjustment_items (adjustment_id, variant_id, quantity, note)
                    VALUES ($1, $2, $3, $4)
                `, [adj.rows[0].id, item.variant_id, Number(item.quantity), item.note || null]);
            }

            await client.query('COMMIT');
            return res.status(201).json({ success: true, data: { ...adj.rows[0], items } });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('createAdjustment error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const listAdjustments = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Math.max(Number(page), 1) - 1) * Number(limit);

        const countResult = await pool.query(`SELECT COUNT(*) as total FROM stock_adjustments`);

        const result = await pool.query(`
            SELECT sa.id, sa.adjustment_code, sa.warehouse_id, sa.reason, sa.source, sa.status,
                   sa.created_at, sa.completed_at,
                   w.name AS warehouse_name,
                   u.name AS created_by_name,
                   (SELECT COUNT(*) FROM stock_adjustment_items sai WHERE sai.adjustment_id = sa.id)::int AS item_count
            FROM stock_adjustments sa
            JOIN warehouses w ON sa.warehouse_id = w.id
            LEFT JOIN users u ON sa.created_by = u.id
            ORDER BY sa.created_at DESC
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

export const getAdjustmentById = async (req, res) => {
    try {
        const { id } = req.params;

        const adj = await pool.query(`
            SELECT sa.*, w.name AS warehouse_name, u.name AS created_by_name
            FROM stock_adjustments sa
            JOIN warehouses w ON sa.warehouse_id = w.id
            LEFT JOIN users u ON sa.created_by = u.id
            WHERE sa.id = $1
        `, [id]);
        if (adj.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu điều chỉnh' });
        }

        const items = await pool.query(`
            SELECT sai.id, sai.variant_id, sai.quantity, sai.note,
                   pv.sku, pv.color, pv.size, p.name AS product_name, p.id AS product_id
            FROM stock_adjustment_items sai
            JOIN product_variants pv ON sai.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            WHERE sai.adjustment_id = $1
            ORDER BY p.name, pv.color, pv.size
        `, [id]);

        return res.status(200).json({ success: true, data: { ...adj.rows[0], items: items.rows } });
    } catch (error) {
        console.error('getAdjustmentById error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const updateAdjustment = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, items } = req.body;

        const existing = await pool.query(`SELECT id, status FROM stock_adjustments WHERE id = $1`, [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu điều chỉnh' });
        }
        if (existing.rows[0].status !== 'DRAFT') {
            return res.status(400).json({ success: false, message: 'Chỉ sửa được phiếu ở trạng thái DRAFT' });
        }
        if (reason != null && !String(reason).trim()) {
            return res.status(400).json({ success: false, message: 'Lý do điều chỉnh là bắt buộc' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            if (reason != null) {
                await client.query(`UPDATE stock_adjustments SET reason = $1 WHERE id = $2`, [String(reason).trim(), id]);
            }
            if (items && Array.isArray(items)) {
                await client.query(`DELETE FROM stock_adjustment_items WHERE adjustment_id = $1`, [id]);
                for (const item of items) {
                    if (!item.variant_id || !item.quantity || Number(item.quantity) === 0) {
                        throw new Error('Dữ liệu sản phẩm không hợp lệ');
                    }
                    await client.query(`
                        INSERT INTO stock_adjustment_items (adjustment_id, variant_id, quantity, note)
                        VALUES ($1, $2, $3, $4)
                    `, [id, item.variant_id, Number(item.quantity), item.note || null]);
                }
            }
            await client.query('COMMIT');
            return res.status(200).json({ success: true, message: 'Cập nhật thành công' });
        } catch (e) {
            await client.query('ROLLBACK');
            if (e.message === 'Dữ liệu sản phẩm không hợp lệ') {
                return res.status(400).json({ success: false, message: e.message });
            }
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('updateAdjustment error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const completeAdjustment = async (req, res) => {
    try {
        const { id } = req.params;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE stock_adjustments SET status = 'COMPLETED', completed_at = NOW()
                WHERE id = $1 AND status = 'DRAFT'
                RETURNING id, adjustment_code, warehouse_id
            `, [id]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                const current = await pool.query(`SELECT status FROM stock_adjustments WHERE id = $1`, [id]);
                if (current.rows.length > 0 && current.rows[0].status === 'COMPLETED') {
                    return res.status(200).json({ success: true, message: 'Phiếu điều chỉnh đã ghi sổ trước đó' });
                }
                return res.status(400).json({ success: false, message: 'Phiếu điều chỉnh không thể ghi sổ' });
            }

            const adj = result.rows[0];
            const items = await client.query(
                `SELECT id, variant_id, quantity FROM stock_adjustment_items WHERE adjustment_id = $1 ORDER BY id`, [id]
            );
            for (const item of items.rows) {
                await applyStockChange(client, {
                    warehouseId: adj.warehouse_id,
                    variantId: item.variant_id,
                    qtyChange: item.quantity,
                    refType: 'ADJUSTMENT',
                    refId: adj.id,
                    unitCost: null,
                    createdBy: req.user.userId,
                    note: adj.adjustment_code,
                });
            }
            await client.query('COMMIT');
            return res.status(200).json({ success: true, message: 'Đã ghi sổ phiếu điều chỉnh' });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        if (error.message === 'INSUFFICIENT_STOCK') {
            return res.status(400).json({ success: false, message: 'Tồn kho không đủ để giảm' });
        }
        console.error('completeAdjustment error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// STOCK COUNTS
// =========================================
export const createCount = async (req, res) => {
    try {
        const { warehouse_id, notes } = req.body;

        if (!warehouse_id) {
            return res.status(400).json({ success: false, message: 'Kho là bắt buộc' });
        }
        try {
            await ensureActiveWarehouse(pool, warehouse_id);
        } catch (e) {
            return res.status(400).json({ success: false, message: e.message });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const code = await nextDocCode(client, 'KK');
            const session = await client.query(`
                INSERT INTO stock_count_sessions (count_code, warehouse_id, status, notes, created_by)
                VALUES ($1, $2, 'DRAFT', $3, $4)
                RETURNING *
            `, [code, warehouse_id, notes || null, req.user.userId]);

            const snapshot = await client.query(`
                INSERT INTO stock_count_items (session_id, variant_id, system_qty)
                SELECT $1, variant_id, on_hand FROM inventory_balances WHERE warehouse_id = $2
                RETURNING id, variant_id, system_qty
            `, [session.rows[0].id, warehouse_id]);

            await client.query('COMMIT');
            return res.status(201).json({
                success: true,
                data: { ...session.rows[0], item_count: snapshot.rows.length }
            });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('createCount error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const listCounts = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Math.max(Number(page), 1) - 1) * Number(limit);

        const countResult = await pool.query(`SELECT COUNT(*) as total FROM stock_count_sessions`);

        const result = await pool.query(`
            SELECT scs.id, scs.count_code, scs.warehouse_id, scs.status, scs.adjustment_id,
                   scs.notes, scs.created_at, scs.completed_at,
                   w.name AS warehouse_name,
                   u.name AS created_by_name,
                   (SELECT COUNT(*) FROM stock_count_items sci WHERE sci.session_id = scs.id)::int AS item_count
            FROM stock_count_sessions scs
            JOIN warehouses w ON scs.warehouse_id = w.id
            LEFT JOIN users u ON scs.created_by = u.id
            ORDER BY scs.created_at DESC
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
        console.error('listCounts error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getCountById = async (req, res) => {
    try {
        const { id } = req.params;

        const session = await pool.query(`
            SELECT scs.*, w.name AS warehouse_name, u.name AS created_by_name
            FROM stock_count_sessions scs
            JOIN warehouses w ON scs.warehouse_id = w.id
            LEFT JOIN users u ON scs.created_by = u.id
            WHERE scs.id = $1
        `, [id]);
        if (session.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đợt kiểm kê' });
        }

        const items = await pool.query(`
            SELECT sci.id, sci.variant_id, sci.system_qty, sci.counted_qty, sci.difference,
                   pv.sku, pv.color, pv.size, p.name AS product_name, p.id AS product_id
            FROM stock_count_items sci
            JOIN product_variants pv ON sci.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            WHERE sci.session_id = $1
            ORDER BY p.name, pv.color, pv.size
        `, [id]);

        return res.status(200).json({ success: true, data: { ...session.rows[0], items: items.rows } });
    } catch (error) {
        console.error('getCountById error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const updateCountItem = async (req, res) => {
    try {
        const { id, itemId } = req.params;
        const { counted_qty } = req.body;

        if (counted_qty === undefined || counted_qty === null || counted_qty < 0) {
            return res.status(400).json({ success: false, message: 'Số đếm không hợp lệ' });
        }

        const item = await pool.query(
            `SELECT sci.id, sci.session_id, scs.status
             FROM stock_count_items sci
             JOIN stock_count_sessions scs ON sci.session_id = scs.id
             WHERE sci.session_id = $1 AND sci.id = $2`,
            [id, itemId]
        );
        if (item.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy dòng kiểm kê' });
        }
        if (!['DRAFT', 'IN_PROGRESS'].includes(item.rows[0].status)) {
            return res.status(400).json({ success: false, message: 'Đợt kiểm kê không còn chỉnh sửa được' });
        }

        await pool.query(`UPDATE stock_count_items SET counted_qty = $1 WHERE id = $2`, [Number(counted_qty), itemId]);
        if (item.rows[0].status === 'DRAFT') {
            await pool.query(`UPDATE stock_count_sessions SET status = 'IN_PROGRESS' WHERE id = $1`, [id]);
        }

        return res.status(200).json({ success: true, message: 'Đã cập nhật số đếm' });
    } catch (error) {
        console.error('updateCountItem error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const completeCount = async (req, res) => {
    try {
        const { id } = req.params;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE stock_count_sessions SET status = 'COMPLETED'
                WHERE id = $1 AND status IN ('DRAFT', 'IN_PROGRESS')
                RETURNING id, count_code, warehouse_id, created_by
            `, [id]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Đợt kiểm kê không thể hoàn tất' });
            }

            const session = result.rows[0];

            const items = await client.query(
                `SELECT id, variant_id, system_qty, counted_qty FROM stock_count_items WHERE session_id = $1 ORDER BY id`,
                [id]
            );

            const adjCode = await nextDocCode(client, 'DCNH');
            let adjId = null;

            for (const item of items.rows) {
                const onHandNow = await client.query(
                    `SELECT COALESCE(on_hand, 0) AS on_hand FROM inventory_balances
                     WHERE warehouse_id = $1 AND variant_id = $2`,
                    [session.warehouse_id, item.variant_id]
                );
                const current = Number(onHandNow.rows[0].on_hand);
                const counted = item.counted_qty != null ? Number(item.counted_qty) : current;
                const difference = counted - current;

                await client.query(
                    `UPDATE stock_count_items SET difference = $1 WHERE id = $2`,
                    [difference, item.id]
                );

                if (difference !== 0) {
                    if (!adjId) {
                        const adj = await client.query(`
                            INSERT INTO stock_adjustments
                                (adjustment_code, warehouse_id, reason, source, status, created_by, completed_at)
                            VALUES ($1, $2, $3, 'STOCK_COUNT', 'COMPLETED', $4, NOW())
                            RETURNING id
                        `, [adjCode, session.warehouse_id, `Kết quả kiểm kê ${session.count_code}`, session.created_by]);
                        adjId = adj.rows[0].id;
                    }
                    await client.query(`
                        INSERT INTO stock_adjustment_items (adjustment_id, variant_id, quantity, note)
                        VALUES ($1, $2, $3, $4)
                    `, [adjId, item.variant_id, difference, `Kiểm kê ${session.count_code}`]);
                }
            }

            if (adjId) {
                const adjItems = await client.query(
                    `SELECT variant_id, quantity FROM stock_adjustment_items WHERE adjustment_id = $1 ORDER BY id`,
                    [adjId]
                );
                for (const ai of adjItems.rows) {
                    await applyStockChange(client, {
                        warehouseId: session.warehouse_id,
                        variantId: ai.variant_id,
                        qtyChange: ai.quantity,
                        refType: 'ADJUSTMENT',
                        refId: adjId,
                        unitCost: null,
                        createdBy: session.created_by,
                        note: adjCode,
                    });
                }
                await client.query(`UPDATE stock_count_sessions SET adjustment_id = $1, completed_at = NOW() WHERE id = $2`, [adjId, id]);
            } else {
                await client.query(`UPDATE stock_count_sessions SET completed_at = NOW() WHERE id = $1`, [id]);
            }

            await client.query('COMMIT');
            return res.status(200).json({
                success: true,
                message: 'Đã hoàn tất kiểm kê' + (adjId ? ' và sinh phiếu điều chỉnh' : ' (không có chênh lệch)'),
                data: { adjustment_id: adjId }
            });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        if (error.message === 'INSUFFICIENT_STOCK') {
            return res.status(400).json({ success: false, message: 'Tồn kho không đủ để điều chỉnh' });
        }
        console.error('completeCount error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const cancelCount = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            UPDATE stock_count_sessions SET status = 'CANCELLED'
            WHERE id = $1 AND status IN ('DRAFT', 'IN_PROGRESS')
            RETURNING id
        `, [id]);
        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Đợt kiểm kê không thể hủy' });
        }
        return res.status(200).json({ success: true, message: 'Đã hủy đợt kiểm kê' });
    } catch (error) {
        console.error('cancelCount error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// TRANSFERS
// =========================================
export const createTransfer = async (req, res) => {
    try {
        const { from_warehouse_id, to_warehouse_id, notes, items } = req.body;

        if (!from_warehouse_id || !to_warehouse_id) {
            return res.status(400).json({ success: false, message: 'Kho nguồn và kho đích là bắt buộc' });
        }
        if (Number(from_warehouse_id) === Number(to_warehouse_id)) {
            return res.status(400).json({ success: false, message: 'Kho nguồn và kho đích phải khác nhau' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cần ít nhất một sản phẩm' });
        }
        for (const item of items) {
            if (!item.variant_id || !item.quantity || item.quantity <= 0) {
                return res.status(400).json({ success: false, message: 'Dữ liệu sản phẩm không hợp lệ' });
            }
        }

        try {
            await ensureActiveWarehouse(pool, from_warehouse_id);
            await ensureActiveWarehouse(pool, to_warehouse_id);
        } catch (e) {
            return res.status(400).json({ success: false, message: e.message });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const code = await nextDocCode(client, 'CN');
            const tr = await client.query(`
                INSERT INTO transfer_orders (transfer_code, from_warehouse_id, to_warehouse_id, status, notes, created_by)
                VALUES ($1, $2, $3, 'DRAFT', $4, $5)
                RETURNING *
            `, [code, from_warehouse_id, to_warehouse_id, notes || null, req.user.userId]);

            for (const item of items) {
                await client.query(`
                    INSERT INTO transfer_items (transfer_order_id, variant_id, quantity)
                    VALUES ($1, $2, $3)
                `, [tr.rows[0].id, item.variant_id, item.quantity]);
            }

            await client.query('COMMIT');
            return res.status(201).json({ success: true, data: tr.rows[0] });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('createTransfer error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const listTransfers = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Math.max(Number(page), 1) - 1) * Number(limit);

        const countResult = await pool.query(`SELECT COUNT(*) as total FROM transfer_orders`);

        const result = await pool.query(`
            SELECT tr.id, tr.transfer_code, tr.from_warehouse_id, tr.to_warehouse_id, tr.status,
                   tr.notes, tr.created_at, tr.completed_at,
                   wf.name AS from_warehouse_name,
                   wt.name AS to_warehouse_name,
                   u.name AS created_by_name,
                   (SELECT COUNT(*) FROM transfer_items ti WHERE ti.transfer_order_id = tr.id)::int AS item_count,
                   (SELECT COALESCE(SUM(ti.quantity), 0) FROM transfer_items ti WHERE ti.transfer_order_id = tr.id)::int AS total_qty
            FROM transfer_orders tr
            JOIN warehouses wf ON tr.from_warehouse_id = wf.id
            JOIN warehouses wt ON tr.to_warehouse_id = wt.id
            LEFT JOIN users u ON tr.created_by = u.id
            ORDER BY tr.created_at DESC
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

export const getTransferById = async (req, res) => {
    try {
        const { id } = req.params;

        const tr = await pool.query(`
            SELECT tr.*, wf.name AS from_warehouse_name, wt.name AS to_warehouse_name, u.name AS created_by_name
            FROM transfer_orders tr
            JOIN warehouses wf ON tr.from_warehouse_id = wf.id
            JOIN warehouses wt ON tr.to_warehouse_id = wt.id
            LEFT JOIN users u ON tr.created_by = u.id
            WHERE tr.id = $1
        `, [id]);
        if (tr.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu chuyển kho' });
        }

        const items = await pool.query(`
            SELECT ti.id, ti.variant_id, ti.quantity,
                   pv.sku, pv.color, pv.size, p.name AS product_name, p.id AS product_id
            FROM transfer_items ti
            JOIN product_variants pv ON ti.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            WHERE ti.transfer_order_id = $1
            ORDER BY p.name, pv.color, pv.size
        `, [id]);

        return res.status(200).json({ success: true, data: { ...tr.rows[0], items: items.rows } });
    } catch (error) {
        console.error('getTransferById error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const updateTransfer = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes, items } = req.body;

        const existing = await pool.query(`SELECT id, status FROM transfer_orders WHERE id = $1`, [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu chuyển kho' });
        }
        if (existing.rows[0].status !== 'DRAFT') {
            return res.status(400).json({ success: false, message: 'Chỉ sửa được phiếu ở trạng thái DRAFT' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            if (notes != null) {
                await client.query(`UPDATE transfer_orders SET notes = $1 WHERE id = $2`, [notes, id]);
            }
            if (items && Array.isArray(items)) {
                await client.query(`DELETE FROM transfer_items WHERE transfer_order_id = $1`, [id]);
                for (const item of items) {
                    if (!item.variant_id || !item.quantity || item.quantity <= 0) {
                        throw new Error('Dữ liệu sản phẩm không hợp lệ');
                    }
                    await client.query(`
                        INSERT INTO transfer_items (transfer_order_id, variant_id, quantity)
                        VALUES ($1, $2, $3)
                    `, [id, item.variant_id, item.quantity]);
                }
            }
            await client.query('COMMIT');
            return res.status(200).json({ success: true, message: 'Cập nhật thành công' });
        } catch (e) {
            await client.query('ROLLBACK');
            if (e.message === 'Dữ liệu sản phẩm không hợp lệ') {
                return res.status(400).json({ success: false, message: e.message });
            }
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('updateTransfer error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const completeTransfer = async (req, res) => {
    try {
        const { id } = req.params;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE transfer_orders SET status = 'COMPLETED', completed_at = NOW()
                WHERE id = $1 AND status = 'DRAFT'
                RETURNING id, transfer_code, from_warehouse_id, to_warehouse_id, created_by
            `, [id]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                const current = await pool.query(`SELECT status FROM transfer_orders WHERE id = $1`, [id]);
                if (current.rows.length > 0 && current.rows[0].status === 'COMPLETED') {
                    return res.status(200).json({ success: true, message: 'Phiếu chuyển kho đã ghi sổ trước đó' });
                }
                return res.status(400).json({ success: false, message: 'Phiếu chuyển kho không thể ghi sổ' });
            }

            const tr = result.rows[0];
            const items = await client.query(
                `SELECT variant_id, quantity FROM transfer_items WHERE transfer_order_id = $1 ORDER BY id`, [id]
            );
            for (const item of items.rows) {
                await transferStock(client, {
                    fromWarehouseId: tr.from_warehouse_id,
                    toWarehouseId: tr.to_warehouse_id,
                    variantId: item.variant_id,
                    quantity: item.quantity,
                    refId: tr.id,
                    createdBy: tr.created_by,
                    note: tr.transfer_code,
                });
            }
            await client.query('COMMIT');
            return res.status(200).json({ success: true, message: 'Đã ghi sổ phiếu chuyển kho' });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        if (error.message === 'INSUFFICIENT_STOCK') {
            return res.status(400).json({ success: false, message: 'Kho nguồn không đủ tồn để chuyển' });
        }
        console.error('completeTransfer error:', error);
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
                   p.name AS product_name, p.id AS product_id,
                   COALESCE((SELECT pi.image_url FROM product_images pi
                             WHERE pi.product_id = p.id
                             ORDER BY pi.is_thumbnail DESC, pi.sort_order ASC, pi.id ASC LIMIT 1), NULL) AS image_url
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
            return res.status(400).json({ success: false, message: 'variant_id là bắt buộc' });
        }

        const supplier = await pool.query(`SELECT id FROM suppliers WHERE id = $1 AND is_active = true`, [id]);
        if (supplier.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy nhà cung cấp' });
        }

        const existing = await pool.query(
            `SELECT sv.id, sv.cost_price FROM supplier_variants sv WHERE sv.supplier_id = $1 AND sv.variant_id = $2`,
            [id, variant_id]
        );

        let result;
        if (existing.rows.length > 0) {
            const newCost = cost_price != null ? Number(cost_price) : null;
            const oldCost = existing.rows[0].cost_price != null ? Number(existing.rows[0].cost_price) : null;
            result = await pool.query(`
                UPDATE supplier_variants SET
                    previous_cost_price = $1,
                    cost_price = COALESCE($2, cost_price),
                    updated_at = NOW()
                WHERE id = $3
                RETURNING *
            `, [oldCost, newCost, existing.rows[0].id]);
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

        const existing = await pool.query(
            `SELECT cost_price FROM supplier_variants WHERE supplier_id = $1 AND variant_id = $2`,
            [id, variantId]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy giá nhà cung cấp' });
        }

        const newCost = cost_price != null ? Number(cost_price) : null;
        const oldCost = existing.rows[0].cost_price != null ? Number(existing.rows[0].cost_price) : null;
        const result = await pool.query(`
            UPDATE supplier_variants SET
                previous_cost_price = $1,
                cost_price = $2,
                updated_at = NOW()
            WHERE supplier_id = $3 AND variant_id = $4
            RETURNING *
        `, [oldCost, newCost, id, variantId]);

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
            return res.status(404).json({ success: false, message: 'Không tìm thấy giá nhà cung cấp' });
        }
        return res.status(200).json({ success: true, message: 'Đã xóa' });
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
            return res.status(400).json({ success: false, message: 'Thiếu tham số ids' });
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

/**
 * Trả về (supplier + cost_price) cho từng variant trong danh sách ids.
 * Dùng cho bảng đặt hàng: mỗi dòng variant cần danh sách NCC có cung cấp
 * kèm giá để prefill dropdown + giá.
 */
export const getSupplierVariantsByVariantIds = async (req, res) => {
    try {
        const { ids } = req.query;
        if (!ids) {
            return res.status(400).json({ success: false, message: 'Thiếu tham số ids' });
        }
        const variantIds = ids.split(',').map(Number).filter(Boolean);
        if (variantIds.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        const result = await pool.query(`
            SELECT sv.variant_id, sv.cost_price,
                   s.id AS supplier_id, s.name AS supplier_name
            FROM supplier_variants sv
            JOIN suppliers s ON sv.supplier_id = s.id
            WHERE sv.variant_id = ANY($1) AND s.is_active = true
            ORDER BY s.name, sv.cost_price ASC NULLS LAST
        `, [variantIds]);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('getSupplierVariantsByVariantIds error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
