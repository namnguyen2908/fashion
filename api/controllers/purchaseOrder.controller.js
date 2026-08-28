import pool from '../config/db.js';
import { nextDocCode } from '../utils/stock.js';

function priceSubquery(alias = 'pv') {
    return `COALESCE((SELECT price FROM variant_prices WHERE variant_id = ${alias}.id), 0) AS price`;
}

async function ensureActiveSupplier(client, supplierId) {
    const r = await client.query(`SELECT id FROM suppliers WHERE id = $1 AND is_active = true`, [supplierId]);
    if (r.rows.length === 0) throw new Error('Nhà cung cấp không tồn tại hoặc ngừng hoạt động');
}

async function ensureActiveWarehouse(client, warehouseId) {
    const r = await client.query(`SELECT id FROM warehouses WHERE id = $1 AND is_active = true`, [warehouseId]);
    if (r.rows.length === 0) throw new Error('Kho không tồn tại hoặc ngừng hoạt động');
}

async function validateItems(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error('Cần ít nhất một sản phẩm trong đơn');
    }
    for (const item of items) {
        if (!item.variant_id || !item.quantity || item.quantity <= 0) {
            throw new Error('Dữ liệu sản phẩm không hợp lệ');
        }
    }
}

async function supplierDefaultCost(client, supplierId, variantId) {
    const r = await client.query(
        `SELECT cost_price FROM supplier_variants WHERE supplier_id = $1 AND variant_id = $2`,
        [supplierId, variantId]
    );
    return r.rows.length > 0 ? Number(r.rows[0].cost_price) : 0;
}

// =========================================
// PURCHASE ORDERS
// =========================================
export const createPO = async (req, res) => {
    try {
        const { supplier_id, warehouse_id, expected_date, notes, items } = req.body;

        if (!supplier_id || !warehouse_id) {
            return res.status(400).json({ success: false, message: 'Nhà cung cấp và kho là bắt buộc' });
        }
        try {
            await validateItems(items);
        } catch (e) {
            return res.status(400).json({ success: false, message: e.message });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            try {
                await ensureActiveSupplier(client, supplier_id);
                await ensureActiveWarehouse(client, warehouse_id);
            } catch (e) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: e.message });
            }

            const poCode = await nextDocCode(client, 'PO');
            const poResult = await client.query(`
                INSERT INTO purchase_orders (po_code, supplier_id, warehouse_id, expected_date, notes, created_by)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [poCode, supplier_id, warehouse_id, expected_date || null, notes || null, req.user.userId]);

            const poId = poResult.rows[0].id;

            for (const item of items) {
                const unitPrice = item.unit_price != null && Number(item.unit_price) > 0
                    ? Number(item.unit_price)
                    : await supplierDefaultCost(client, supplier_id, item.variant_id);
                await client.query(`
                    INSERT INTO purchase_order_items (po_id, variant_id, quantity, unit_price)
                    VALUES ($1, $2, $3, $4)
                `, [poId, item.variant_id, item.quantity, unitPrice]);
            }

            await client.query('COMMIT');
            return res.status(201).json({ success: true, data: poResult.rows[0] });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        if (error.code === '23505') {
            const message = error.constraint === 'purchase_order_items_po_id_variant_id_key'
                ? 'Sản phẩm bị trùng lặp trong đơn đặt hàng'
                : 'Mã đơn đặt hàng bị trùng';
            return res.status(400).json({ success: false, message });
        }
        if (error.code === '23503') {
            return res.status(400).json({ success: false, message: 'Sản phẩm hoặc nhà cung cấp không hợp lệ' });
        }
        console.error('createPO error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const listPOs = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        const offset = (Math.max(Number(page), 1) - 1) * Number(limit);

        let where = 'WHERE 1 = 1';
        const params = [];
        let idx = 1;

        if (status) {
            where += ` AND po.status = $${idx}`;
            params.push(status);
            idx++;
        }
        if (search) {
            where += ` AND (po.po_code ILIKE $${idx} OR s.name ILIKE $${idx})`;
            params.push(`%${search}%`);
            idx++;
        }

        const countResult = await pool.query(`
            SELECT COUNT(*) as total
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            ${where}
        `, params);

        const result = await pool.query(`
            SELECT po.id, po.po_code, po.supplier_id, po.warehouse_id, po.status,
                   po.expected_date, po.notes, po.created_at,
                   s.name AS supplier_name,
                   w.name AS warehouse_name,
                   u.name AS created_by_name,
                   (SELECT COUNT(*) FROM purchase_order_items oi WHERE oi.po_id = po.id)::int AS item_count,
                   (SELECT COALESCE(SUM(oi.quantity), 0) FROM purchase_order_items oi WHERE oi.po_id = po.id)::int AS total_qty,
                   (SELECT COALESCE(SUM(oi.received_qty), 0) FROM purchase_order_items oi WHERE oi.po_id = po.id)::int AS received_qty
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            JOIN warehouses w ON po.warehouse_id = w.id
            LEFT JOIN users u ON po.created_by = u.id
            ${where}
            ORDER BY po.created_at DESC
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
        console.error('listPOs error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getPOById = async (req, res) => {
    try {
        const { id } = req.params;

        const po = await pool.query(`
            SELECT po.*, s.name AS supplier_name, s.code AS supplier_code,
                   w.name AS warehouse_name, u.name AS created_by_name
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            JOIN warehouses w ON po.warehouse_id = w.id
            LEFT JOIN users u ON po.created_by = u.id
            WHERE po.id = $1
        `, [id]);

        if (po.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt hàng' });
        }

        const items = await pool.query(`
            SELECT oi.id, oi.variant_id, oi.quantity, oi.unit_price, oi.received_qty,
                   (oi.quantity - oi.received_qty) AS remaining,
                   pv.sku, pv.color, pv.size, ${priceSubquery()},
                   p.id AS product_id, p.name AS product_name
            FROM purchase_order_items oi
            JOIN product_variants pv ON oi.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            WHERE oi.po_id = $1
            ORDER BY p.name, pv.color, pv.size
        `, [id]);

        return res.status(200).json({ success: true, data: { ...po.rows[0], items: items.rows } });
    } catch (error) {
        console.error('getPOById error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const updatePO = async (req, res) => {
    try {
        const { id } = req.params;
        const { supplier_id, warehouse_id, expected_date, notes, items } = req.body;

        const existing = await pool.query(
            `SELECT id, status FROM purchase_orders WHERE id = $1`, [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt hàng' });
        }
        if (existing.rows[0].status !== 'DRAFT') {
            return res.status(400).json({ success: false, message: 'Chỉ sửa được đơn ở trạng thái DRAFT' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(`
                UPDATE purchase_orders SET
                    supplier_id = COALESCE($1, supplier_id),
                    warehouse_id = COALESCE($2, warehouse_id),
                    expected_date = COALESCE($3, expected_date),
                    notes = COALESCE($4, notes),
                    updated_at = NOW()
                WHERE id = $5
            `, [supplier_id || null, warehouse_id || null, expected_date ?? null, notes ?? null, id]);

            if (items && Array.isArray(items)) {
                await client.query(`DELETE FROM purchase_order_items WHERE po_id = $1`, [id]);
                const cur = await client.query(`SELECT supplier_id FROM purchase_orders WHERE id = $1`, [id]);
                const effSupplierId = supplier_id || cur.rows[0]?.supplier_id;
                for (const item of items) {
                    if (!item.variant_id || !item.quantity || item.quantity <= 0) {
                        throw new Error('Dữ liệu sản phẩm không hợp lệ');
                    }
                    const unitPrice = item.unit_price != null && Number(item.unit_price) > 0
                        ? Number(item.unit_price)
                        : await supplierDefaultCost(client, effSupplierId, item.variant_id);
                    await client.query(`
                        INSERT INTO purchase_order_items (po_id, variant_id, quantity, unit_price)
                        VALUES ($1, $2, $3, $4)
                    `, [id, item.variant_id, item.quantity, unitPrice]);
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
        console.error('updatePO error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const confirmPO = async (req, res) => {
    try {
        const { id } = req.params;

        const itemCount = await pool.query(
            `SELECT COUNT(*)::int AS c FROM purchase_order_items WHERE po_id = $1`, [id]
        );
        if (itemCount.rows[0].c === 0) {
            return res.status(400).json({ success: false, message: 'Đơn chưa có sản phẩm nào' });
        }

        const result = await pool.query(`
            UPDATE purchase_orders SET status = 'CONFIRMED', updated_at = NOW()
            WHERE id = $1 AND status = 'DRAFT'
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Đơn không ở trạng thái DRAFT' });
        }
        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('confirmPO error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const cancelPO = async (req, res) => {
    try {
        const { id } = req.params;

        const grCount = await pool.query(
            `SELECT COUNT(*)::int AS c FROM goods_receipts WHERE po_id = $1`, [id]
        );
        if (grCount.rows[0].c > 0) {
            return res.status(400).json({ success: false, message: 'Không thể hủy đơn đã có phiếu nhập' });
        }

        const result = await pool.query(`
            UPDATE purchase_orders SET status = 'CANCELLED', updated_at = NOW()
            WHERE id = $1 AND status IN ('DRAFT', 'CONFIRMED')
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Đơn không thể hủy' });
        }
        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('cancelPO error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Tạo nhiều đơn đặt hàng cùng lúc, mỗi đơn ứng với một nhà cung cấp.
 * Body: { warehouse_id, expected_date, notes, groups: [{ supplier_id, items: [{ variant_id, quantity, unit_price }] }] }
 * Tất cả trong 1 transaction.
 */
export const createPOGroup = async (req, res) => {
    try {
        const { warehouse_id, expected_date, notes, groups } = req.body;

        if (!warehouse_id) {
            return res.status(400).json({ success: false, message: 'Kho nhận là bắt buộc' });
        }
        if (!groups || !Array.isArray(groups) || groups.length === 0) {
            return res.status(400).json({ success: false, message: 'Cần ít nhất một nhóm sản phẩm' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            try {
                await ensureActiveWarehouse(client, warehouse_id);
            } catch (e) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: e.message });
            }

            const created = [];
            for (const group of groups) {
                const { supplier_id, items } = group;
                if (!supplier_id) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: 'Một nhóm sản phẩm đang thiếu nhà cung cấp' });
                }
                try {
                    await validateItems(items);
                } catch (e) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: e.message });
                }
                try {
                    await ensureActiveSupplier(client, supplier_id);
                } catch (e) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: e.message });
                }

                const poCode = await nextDocCode(client, 'PO');
                const poResult = await client.query(`
                    INSERT INTO purchase_orders (po_code, supplier_id, warehouse_id, expected_date, notes, created_by)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id, po_code, supplier_id
                `, [poCode, supplier_id, warehouse_id, expected_date || null, notes || null, req.user.userId]);
                const poId = poResult.rows[0].id;

                for (const item of items) {
                    const unitPrice = item.unit_price != null && Number(item.unit_price) > 0
                        ? Number(item.unit_price)
                        : await supplierDefaultCost(client, supplier_id, item.variant_id);
                    await client.query(`
                        INSERT INTO purchase_order_items (po_id, variant_id, quantity, unit_price)
                        VALUES ($1, $2, $3, $4)
                    `, [poId, item.variant_id, item.quantity, unitPrice]);
                }
                created.push(poResult.rows[0]);
            }

            await client.query('COMMIT');
            return res.status(201).json({
                success: true,
                message: `Đã tạo ${created.length} đơn đặt hàng`,
                data: created,
            });
        } catch (e) {
            await client.query('ROLLBACK');
            if (e.code === '23505') {
                return res.status(400).json({ success: false, message: 'Sản phẩm bị trùng lặp trong một đơn' });
            }
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ success: false, message: 'Sản phẩm hoặc nhà cung cấp không hợp lệ' });
        }
        console.error('createPOGroup error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
