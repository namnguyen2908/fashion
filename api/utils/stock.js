const ALLOWED_REF_TYPES = ['GOODS_RECEIPT', 'ADJUSTMENT', 'TRANSFER'];

/**
 * Cộng/trừ tồn kho cho một (warehouse, variant) và ghi sổ inventory_transactions.
 * Chạy trong transaction (client).
 * Dùng lock-then-update (không dùng ON CONFLICT DO UPDATE vì CHECK on_hand >= 0
 * bị evaluate trên nhánh INSERT speculative khi qtyChange âm).
 * Ném 'INSUFFICIENT_STOCK' nếu on_hand < 0.
 */
export async function applyStockChange(client, {
    warehouseId,
    variantId,
    qtyChange,
    refType,
    refId = null,
    unitCost = null,
    createdBy = null,
    note = null,
}) {
    if (!ALLOWED_REF_TYPES.includes(refType)) {
        throw new Error('Invalid refType');
    }
    if (!warehouseId || !variantId || !Number.isInteger(qtyChange) || qtyChange === 0) {
        throw new Error('Invalid stock change parameters');
    }

    await client.query(`
        INSERT INTO inventory_balances (warehouse_id, variant_id, on_hand)
        VALUES ($1, $2, 0)
        ON CONFLICT (warehouse_id, variant_id) DO NOTHING
    `, [warehouseId, variantId]);

    const lock = await client.query(
        `SELECT on_hand FROM inventory_balances WHERE warehouse_id = $1 AND variant_id = $2 FOR UPDATE`,
        [warehouseId, variantId]
    );

    const qtyBefore = Number(lock.rows[0].on_hand);
    const qtyAfter = qtyBefore + qtyChange;
    if (qtyAfter < 0) {
        throw new Error('INSUFFICIENT_STOCK');
    }

    await client.query(`
        UPDATE inventory_balances SET on_hand = $1, updated_at = NOW()
        WHERE warehouse_id = $2 AND variant_id = $3
    `, [qtyAfter, warehouseId, variantId]);

    const result = await client.query(`
        INSERT INTO inventory_transactions
            (warehouse_id, variant_id, qty_change, qty_before, qty_after, unit_cost, ref_type, ref_id, created_by, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
    `, [warehouseId, variantId, qtyChange, qtyBefore, qtyAfter, unitCost, refType, refId, createdBy, note]);

    return { qty_before: qtyBefore, qty_after: qtyAfter, transaction: result.rows[0] };
}

/**
 * Chuyển kho: trừ kho nguồn + cộng kho đích (2 transaction TRANSFER cùng ref_id).
 */
export async function transferStock(client, {
    fromWarehouseId,
    toWarehouseId,
    variantId,
    quantity,
    refId = null,
    createdBy = null,
    note = null,
}) {
    if (fromWarehouseId === toWarehouseId) {
        throw new Error('Không thể chuyển vào cùng một kho');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error('Số lượng chuyển kho không hợp lệ');
    }

    const out = await applyStockChange(client, {
        warehouseId: fromWarehouseId, variantId, qtyChange: -quantity,
        refType: 'TRANSFER', refId, unitCost: null, createdBy, note,
    });
    const inc = await applyStockChange(client, {
        warehouseId: toWarehouseId, variantId, qtyChange: quantity,
        refType: 'TRANSFER', refId, unitCost: null, createdBy, note,
    });

    return { out: out.transaction, inc: inc.transaction };
}

/** Tồn on_hand của một variant trong một kho (0 nếu chưa có balance). */
export async function getVariantOnHand(client, warehouseId, variantId) {
    const result = await client.query(
        `SELECT on_hand FROM inventory_balances WHERE warehouse_id = $1 AND variant_id = $2`,
        [warehouseId, variantId]
    );
    return result.rows.length > 0 ? Number(result.rows[0].on_hand) : 0;
}

/**
 * Cập nhật giá vốn weighted average cho variant sau khi nhập kho.
 * onHandOld = tồn hệ thống trước khi nhập lô này (giá trị lấy từ applyStockChange.qty_before).
 * Công thức: new_cost = (onHandOld × current + qty × unitCost) / (onHandOld + qty).
 */
export async function updateVariantCost(client, variantId, onHandOld, qty, unitCost) {
    const costRes = await client.query(
        `SELECT current_cost FROM inventory_costs WHERE variant_id = $1 FOR UPDATE`, [variantId]
    );
    const current = costRes.rows.length > 0 ? Number(costRes.rows[0].current_cost) : 0;

    const totalQty = onHandOld + qty;
    let newCost = unitCost || 0;
    if (totalQty > 0 && current > 0) {
        newCost = (onHandOld * current + qty * (unitCost || 0)) / totalQty;
    }
    newCost = Math.round(newCost * 100) / 100;

    await client.query(`
        INSERT INTO inventory_costs (variant_id, current_cost)
        VALUES ($1, $2)
        ON CONFLICT (variant_id)
        DO UPDATE SET current_cost = $2, updated_at = NOW()
    `, [variantId, newCost]);

    return newCost;
}

/**
 * Sinh mã chứng từ tuần tự theo năm: PREFIX-YYYY-NNNNNN (atomic).
 */
export async function nextDocCode(client, prefix) {
    const year = new Date().getFullYear();
    const result = await client.query(`
        INSERT INTO document_sequences (prefix, year, seq)
        VALUES ($1, $2, 1)
        ON CONFLICT (prefix, year)
        DO UPDATE SET seq = document_sequences.seq + 1
        RETURNING seq
    `, [prefix, year]);
    const seq = Number(result.rows[0].seq);
    return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}
