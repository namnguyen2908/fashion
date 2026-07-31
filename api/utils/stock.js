const ALLOWED_REF_TYPES = ['GOODS_RECEIPT', 'ADJUSTMENT', 'TRANSFER'];

/**
 * Cộng/trừ tồn kho cho một (warehouse, variant) và ghi sổ cái inventory_transactions.
 * Phải chạy trong transaction (client). Ném lỗi 'INSUFFICIENT_STOCK' nếu tồn âm.
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

    const upsert = await client.query(`
        INSERT INTO inventory_balances (warehouse_id, variant_id, stock_qty)
        VALUES ($1, $2, $3)
        ON CONFLICT (warehouse_id, variant_id)
        DO UPDATE SET stock_qty = inventory_balances.stock_qty + $3, updated_at = NOW()
        RETURNING stock_qty
    `, [warehouseId, variantId, qtyChange]);

    const balanceAfter = Number(upsert.rows[0].stock_qty);
    if (balanceAfter < 0) {
        throw new Error('INSUFFICIENT_STOCK');
    }

    const result = await client.query(`
        INSERT INTO inventory_transactions
            (warehouse_id, variant_id, qty_change, balance_after, ref_type, ref_id, unit_cost, created_by, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    `, [warehouseId, variantId, qtyChange, balanceAfter, refType, refId, unitCost, createdBy, note]);

    return { balance_after: balanceAfter, transaction: result.rows[0] };
}

/**
 * Chuyển kho giữa 2 kho: trừ kho nguồn + cộng kho đích, ghi 2 transaction TRANSFER
 * (gom nhóm bằng ref_id = id của transaction xuất).
 */
export async function transferStock(client, {
    fromWarehouseId,
    toWarehouseId,
    variantId,
    quantity,
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
        warehouseId: fromWarehouseId,
        variantId,
        qtyChange: -quantity,
        refType: 'TRANSFER',
        refId: null,
        unitCost: null,
        createdBy,
        note,
    });

    const groupId = out.transaction.id;
    await client.query('UPDATE inventory_transactions SET ref_id = $1 WHERE id = $1', [groupId]);

    const inc = await applyStockChange(client, {
        warehouseId: toWarehouseId,
        variantId,
        qtyChange: quantity,
        refType: 'TRANSFER',
        refId: groupId,
        unitCost: null,
        createdBy,
        note,
    });

    return { group_id: groupId, out: out.transaction, inc: inc.transaction };
}

/** Lấy tồn hiện tại của một variant trong một kho (trả 0 nếu chưa có balance). */
export async function getVariantBalance(client, warehouseId, variantId) {
    const result = await client.query(`
        SELECT stock_qty FROM inventory_balances WHERE warehouse_id = $1 AND variant_id = $2
    `, [warehouseId, variantId]);
    return result.rows.length > 0 ? Number(result.rows[0].stock_qty) : 0;
}
