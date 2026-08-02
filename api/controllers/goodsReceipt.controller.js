import pool from '../config/db.js';
import { applyStockChange, updateVariantCost, nextDocCode } from '../utils/stock.js';

function priceSubquery(alias = 'pv') {
    return `COALESCE((SELECT price FROM variant_prices WHERE variant_id = ${alias}.id), 0) AS price`;
}

async function ensureActiveWarehouse(client, warehouseId) {
    const r = await client.query(`SELECT id FROM warehouses WHERE id = $1 AND is_active = true`, [warehouseId]);
    if (r.rows.length === 0) throw new Error('Kho không tồn tại hoặc ngừng hoạt động');
}

/** Cập nhật lại trạng thái PO dựa trên received_qty của các dòng. */
async function recomputePOStatus(client, poId) {
    if (!poId) return;
    const r = await client.query(`
        SELECT
            COUNT(*)::int AS total_items,
            COUNT(*) FILTER (WHERE received_qty >= quantity)::int AS received_items
        FROM purchase_order_items WHERE po_id = $1
    `, [poId]);
    const { total_items, received_items } = r.rows[0];
    if (total_items > 0 && received_items === total_items) {
        await client.query(
            `UPDATE purchase_orders SET status = 'RECEIVED', updated_at = NOW() WHERE id = $1`, [poId]
        );
    } else if (total_items > 0) {
        await client.query(
            `UPDATE purchase_orders SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1`, [poId]
        );
    }
}

/** Ghi sổ một GR đã ở trạng thái COMPLETED (dùng cho complete + direct create). Chạy trong transaction. */
async function postGoodsReceipt(client, grId, grCode, createdBy) {
    const gr = await client.query(
        `SELECT warehouse_id, po_id FROM goods_receipts WHERE id = $1`, [grId]
    );
    const warehouseId = gr.rows[0].warehouse_id;

    const items = await client.query(
        `SELECT id, po_item_id, variant_id, quantity, unit_cost FROM goods_receipt_items WHERE goods_receipt_id = $1 ORDER BY id`,
        [grId]
    );

    for (const item of items.rows) {
        const unitCost = item.unit_cost != null ? Number(item.unit_cost) : 0;
        const { qty_before } = await applyStockChange(client, {
            warehouseId, variantId: item.variant_id, qtyChange: item.quantity,
            refType: 'GOODS_RECEIPT', refId: grId, unitCost, createdBy, note: grCode,
        });
        await updateVariantCost(client, item.variant_id, qty_before, item.quantity, unitCost);

        if (item.po_item_id) {
            try {
                await client.query(`
                    UPDATE purchase_order_items SET received_qty = received_qty + $1 WHERE id = $2
                `, [item.quantity, item.po_item_id]);
            } catch (e) {
                if (e.code === '23514') {
                    throw new Error('Số lượng nhận vượt quá số lượng đặt trong đơn (PO)');
                }
                throw e;
            }
        }
    }

    if (gr.rows[0].po_id) {
        await recomputePOStatus(client, gr.rows[0].po_id);
    }
}

// =========================================
// GOODS RECEIPTS
// =========================================
export const createGoodsReceipt = async (req, res) => {
    try {
        const { po_id, supplier_id, warehouse_id, receipt_date, notes, items } = req.body;

        if (!warehouse_id) {
            return res.status(400).json({ success: false, message: 'Kho nhận là bắt buộc' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cần ít nhất một sản phẩm' });
        }
        for (const item of items) {
            if (!item.variant_id || !item.quantity || item.quantity <= 0) {
                return res.status(400).json({ success: false, message: 'Dữ liệu sản phẩm không hợp lệ' });
            }
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

            let grSupplierId = supplier_id || null;
            let grWarehouseId = warehouse_id;
            let poItemMap = null;

            if (po_id) {
                const po = await client.query(
                    `SELECT id, supplier_id, warehouse_id, status FROM purchase_orders WHERE id = $1`, [po_id]
                );
                if (po.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: 'Không tìm thấy đơn đặt hàng' });
                }
                if (po.rows[0].status !== 'CONFIRMED') {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: 'Đơn đặt hàng chưa ở trạng thái CONFIRMED' });
                }
                if (Number(po.rows[0].warehouse_id) !== Number(warehouse_id)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: 'Kho nhận phải trùng kho của đơn đặt hàng' });
                }
                grSupplierId = po.rows[0].supplier_id;
                grWarehouseId = po.rows[0].warehouse_id;

                const poi = await client.query(
                    `SELECT id, variant_id, quantity, received_qty FROM purchase_order_items WHERE po_id = $1`, [po_id]
                );
                poItemMap = {};
                poi.rows.forEach((r) => { poItemMap[String(r.variant_id)] = r; });
            }

            const grCode = await nextDocCode(client, 'PN');
            const grResult = await client.query(`
                INSERT INTO goods_receipts (receipt_code, po_id, supplier_id, warehouse_id, receipt_date, notes, created_by, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT')
                RETURNING id, receipt_code
            `, [grCode, po_id || null, grSupplierId, grWarehouseId, receipt_date || null, notes || null, req.user.userId]);

            const grId = grResult.rows[0].id;

            for (const item of items) {
                let poItemId = item.po_item_id || null;
                let unitCost = item.unit_cost != null ? Number(item.unit_cost) : 0;

                if (poItemMap) {
                    const poi = poItemMap[String(item.variant_id)];
                    if (!poi) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({
                            success: false,
                            message: 'Sản phẩm không nằm trong đơn đặt hàng',
                        });
                    }
                    poItemId = poi.id;
                    const remaining = Number(poi.quantity) - Number(poi.received_qty);
                    if (item.quantity > remaining) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({
                            success: false,
                            message: `Số lượng nhận vượt quá số còn thiếu (còn ${remaining})`,
                        });
                    }
                    if (unitCost === 0) {
                        const pr = await client.query(
                            `SELECT unit_price FROM purchase_order_items WHERE id = $1`, [poi.id]
                        );
                        unitCost = pr.rows.length > 0 ? Number(pr.rows[0].unit_price) : 0;
                    }
                }

                await client.query(`
                    INSERT INTO goods_receipt_items (goods_receipt_id, po_item_id, variant_id, quantity, unit_cost)
                    VALUES ($1, $2, $3, $4, $5)
                `, [grId, poItemId, item.variant_id, item.quantity, unitCost]);
            }

            await client.query('COMMIT');
            return res.status(201).json({ success: true, data: { id: grId, receipt_code: grCode, status: 'DRAFT' } });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('createGoodsReceipt error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const listGoodsReceipts = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Math.max(Number(page), 1) - 1) * Number(limit);

        const countResult = await pool.query(`SELECT COUNT(*) as total FROM goods_receipts`);

        const result = await pool.query(`
            SELECT gr.id, gr.receipt_code, gr.receipt_date, gr.supplier_id, gr.warehouse_id,
                   gr.po_id, gr.status, gr.notes, gr.created_at,
                   po.po_code,
                   u.name AS created_by_name,
                   s.name AS supplier_name,
                   w.name AS warehouse_name
            FROM goods_receipts gr
            LEFT JOIN purchase_orders po ON gr.po_id = po.id
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
        console.error('listGoodsReceipts error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getGoodsReceiptById = async (req, res) => {
    try {
        const { id } = req.params;

        const receipt = await pool.query(`
            SELECT gr.*, po.po_code, u.name AS created_by_name,
                   s.name AS supplier_name, s.code AS supplier_code,
                   w.name AS warehouse_name
            FROM goods_receipts gr
            LEFT JOIN purchase_orders po ON gr.po_id = po.id
            LEFT JOIN users u ON gr.created_by = u.id
            LEFT JOIN suppliers s ON gr.supplier_id = s.id
            LEFT JOIN warehouses w ON gr.warehouse_id = w.id
            WHERE gr.id = $1
        `, [id]);

        if (receipt.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập' });
        }

        const details = await pool.query(`
            SELECT gri.id, gri.variant_id, gri.quantity, gri.unit_cost, gri.po_item_id, gri.created_at,
                   pv.sku, pv.color, pv.size, ${priceSubquery()},
                   p.name AS product_name, p.id AS product_id
            FROM goods_receipt_items gri
            JOIN product_variants pv ON gri.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            WHERE gri.goods_receipt_id = $1
            ORDER BY p.name, pv.color, pv.size
        `, [id]);

        return res.status(200).json({ success: true, data: { ...receipt.rows[0], items: details.rows } });
    } catch (error) {
        console.error('getGoodsReceiptById error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const updateGoodsReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const { receipt_date, notes, items } = req.body;

        const existing = await pool.query(
            `SELECT id, status, po_id, warehouse_id FROM goods_receipts WHERE id = $1`, [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập' });
        }
        if (existing.rows[0].status !== 'DRAFT') {
            return res.status(400).json({ success: false, message: 'Chỉ sửa được phiếu nhập ở trạng thái DRAFT' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(`
                UPDATE goods_receipts SET
                    receipt_date = COALESCE($1, receipt_date),
                    notes = COALESCE($2, notes)
                WHERE id = $3
            `, [receipt_date ?? null, notes ?? null, id]);

            if (items && Array.isArray(items)) {
                await client.query(`DELETE FROM goods_receipt_items WHERE goods_receipt_id = $1`, [id]);
                const { po_id, warehouse_id } = existing.rows[0];

                let poItemMap = null;
                if (po_id) {
                    const poi = await client.query(
                        `SELECT id, variant_id, quantity, received_qty FROM purchase_order_items WHERE po_id = $1`, [po_id]
                    );
                    poItemMap = {};
                    poi.rows.forEach((r) => { poItemMap[String(r.variant_id)] = r; });
                }

                for (const item of items) {
                    if (!item.variant_id || !item.quantity || item.quantity <= 0) {
                        throw new Error('Dữ liệu sản phẩm không hợp lệ');
                    }
                    let poItemId = item.po_item_id || null;
                    let unitCost = item.unit_cost != null ? Number(item.unit_cost) : 0;
                    if (poItemMap) {
                        const poi = poItemMap[String(item.variant_id)];
                        if (!poi) throw new Error('Sản phẩm không nằm trong đơn đặt hàng');
                        poItemId = poi.id;
                        const remaining = Number(poi.quantity) - Number(poi.received_qty);
                        if (item.quantity > remaining) {
                            throw new Error(`Số lượng nhận vượt quá số còn thiếu (còn ${remaining})`);
                        }
                        if (unitCost === 0) {
                            const pr = await client.query(
                                `SELECT unit_price FROM purchase_order_items WHERE id = $1`, [poi.id]
                            );
                            unitCost = pr.rows.length > 0 ? Number(pr.rows[0].unit_price) : 0;
                        }
                    }
                    await client.query(`
                        INSERT INTO goods_receipt_items (goods_receipt_id, po_item_id, variant_id, quantity, unit_cost)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [id, poItemId, item.variant_id, item.quantity, unitCost]);
                }
            }

            await client.query('COMMIT');
            return res.status(200).json({ success: true, message: 'Cập nhật thành công' });
        } catch (e) {
            await client.query('ROLLBACK');
            if (['Dữ liệu sản phẩm không hợp lệ', 'Sản phẩm không nằm trong đơn đặt hàng'].includes(e.message)
                || e.message.startsWith('Số lượng nhận')) {
                return res.status(400).json({ success: false, message: e.message });
            }
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('updateGoodsReceipt error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const completeGoodsReceipt = async (req, res) => {
    try {
        const { id } = req.params;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE goods_receipts SET status = 'COMPLETED'
                WHERE id = $1 AND status = 'DRAFT'
                RETURNING id, receipt_code, po_id, created_by
            `, [id]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                const current = await pool.query(`SELECT status FROM goods_receipts WHERE id = $1`, [id]);
                if (current.rows.length > 0 && current.rows[0].status === 'COMPLETED') {
                    return res.status(200).json({ success: true, message: 'Phiếu nhập đã được ghi sổ trước đó' });
                }
                return res.status(400).json({ success: false, message: 'Phiếu nhập không thể ghi sổ (trạng thái không hợp lệ)' });
            }

            const gr = result.rows[0];
            await postGoodsReceipt(client, gr.id, gr.receipt_code, gr.created_by);
            await client.query('COMMIT');
            return res.status(200).json({ success: true, message: 'Đã ghi sổ phiếu nhập' });
        } catch (e) {
            await client.query('ROLLBACK');
            if (e.message.startsWith('Số lượng nhận vượt')) {
                return res.status(400).json({ success: false, message: e.message });
            }
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        if (error.message === 'INSUFFICIENT_STOCK') {
            return res.status(400).json({ success: false, message: 'Tồn kho không đủ' });
        }
        console.error('completeGoodsReceipt error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const cancelGoodsReceipt = async (req, res) => {
    try {
        const { id } = req.params;

            const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const pre = await client.query(`SELECT status FROM goods_receipts WHERE id = $1`, [id]);
            if (pre.rows.length === 0 || !['DRAFT', 'COMPLETED'].includes(pre.rows[0].status)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Phiếu nhập không thể hủy (trạng thái không hợp lệ)' });
            }
            const wasDraft = pre.rows[0].status === 'DRAFT';

            const result = await client.query(`
                UPDATE goods_receipts SET status = 'CANCELLED'
                WHERE id = $1 AND status IN ('DRAFT', 'COMPLETED')
                RETURNING id, receipt_code, po_id, created_by
            `, [id]);

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Phiếu nhập không thể hủy (trạng thái không hợp lệ)' });
            }

            const gr = result.rows[0];

            // DRAFT: chưa ghi sổ -> chỉ cần đổi trạng thái
            if (wasDraft) {
                await client.query('COMMIT');
                return res.status(200).json({ success: true, message: 'Đã hủy phiếu nhập' });
            }

            const items = await client.query(
                `SELECT id, po_item_id, variant_id, quantity FROM goods_receipt_items WHERE goods_receipt_id = $1 ORDER BY id`,
                [id]
            );

            const grHeader = await client.query(`SELECT warehouse_id FROM goods_receipts WHERE id = $1`, [id]);
            const warehouseId = grHeader.rows[0].warehouse_id;

            // Kiểm tra: không được có giao dịch kho sau GR của mọi variant
            for (const item of items.rows) {
                const tx = await client.query(`
                    SELECT MAX(id) AS max_id FROM inventory_transactions
                    WHERE ref_type = 'GOODS_RECEIPT' AND ref_id = $1 AND variant_id = $2
                `, [id, item.variant_id]);
                const grTxId = Number(tx.rows[0].max_id || 0);
                const later = await client.query(`
                    SELECT 1 FROM inventory_transactions
                    WHERE variant_id = $1 AND id > $2 LIMIT 1
                `, [item.variant_id, grTxId]);
                if (later.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        success: false,
                        message: 'Không thể hủy phiếu nhập: đã có giao dịch kho khác sau phiếu này. Hãy dùng phiếu điều chỉnh.'
                    });
                }
            }

            for (const item of items.rows) {
                await applyStockChange(client, {
                    warehouseId, variantId: item.variant_id, qtyChange: -item.quantity,
                    refType: 'ADJUSTMENT', refId: id, unitCost: null,
                    createdBy: req.user.userId, note: `${gr.receipt_code} (hủy)`,
                });
                if (item.po_item_id) {
                    await client.query(
                        `UPDATE purchase_order_items SET received_qty = received_qty - $1 WHERE id = $2`,
                        [item.quantity, item.po_item_id]
                    );
                }
            }

            await recomputePOStatus(client, gr.po_id);
            await client.query('COMMIT');
            return res.status(200).json({ success: true, message: 'Đã hủy phiếu nhập và đảo ngược tồn kho' });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('cancelGoodsReceipt error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/** Legacy: tạo + ghi sổ ngay (giữ tương thích cho phiếu nhập không qua PO). */
export const directCreateReceipt = async (req, res) => {
    try {
        const { warehouse_id, supplier_id, notes, items } = req.body;

        if (!warehouse_id) {
            return res.status(400).json({ success: false, message: 'Kho nhận là bắt buộc' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cần ít nhất một sản phẩm' });
        }
        for (const item of items) {
            if (!item.variant_id || !item.quantity || item.quantity <= 0) {
                return res.status(400).json({ success: false, message: 'Dữ liệu sản phẩm không hợp lệ' });
            }
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

            const grCode = await nextDocCode(client, 'PN');
            const grResult = await client.query(`
                INSERT INTO goods_receipts (receipt_code, po_id, supplier_id, warehouse_id, notes, created_by, status)
                VALUES ($1, NULL, $2, $3, $4, $5, 'DRAFT')
                RETURNING id, receipt_code
            `, [grCode, supplier_id || null, warehouse_id, notes || null, req.user.userId]);
            const grId = grResult.rows[0].id;

            for (const item of items) {
                await client.query(`
                    INSERT INTO goods_receipt_items (goods_receipt_id, po_item_id, variant_id, quantity, unit_cost)
                    VALUES ($1, NULL, $2, $3, $4)
                `, [grId, item.variant_id, item.quantity, item.unit_cost != null ? Number(item.unit_cost) : 0]);
            }

            await postGoodsReceipt(client, grId, grCode, req.user.userId);
            await client.query(`UPDATE goods_receipts SET status = 'COMPLETED' WHERE id = $1`, [grId]);
            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                message: 'Đã nhập kho thành công',
                data: { id: grId, receipt_code: grCode, status: 'COMPLETED' }
            });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('directCreateReceipt error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
