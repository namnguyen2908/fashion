BEGIN;

-- 1. warehouses: danh sách kho
CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    location TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO warehouses (name, code, location)
SELECT 'Kho chính', 'KHO-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE code = 'KHO-01');

-- 2. inventory_balances: tồn theo từng (warehouse, variant)
CREATE TABLE IF NOT EXISTS inventory_balances (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (warehouse_id, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_warehouse ON inventory_balances(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_variant ON inventory_balances(variant_id);

-- 3. inventory_transactions: sổ cái giao dịch tồn kho
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    qty_change INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    ref_type VARCHAR(20) NOT NULL CHECK (ref_type IN ('GOODS_RECEIPT', 'ADJUSTMENT', 'TRANSFER')),
    ref_id INTEGER,
    unit_cost DECIMAL(12,2),
    created_by INTEGER REFERENCES users(id),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_warehouse ON inventory_transactions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_variant ON inventory_transactions(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_ref ON inventory_transactions(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created ON inventory_transactions(created_at DESC);

-- 4. Rename phiếu nhập: stock_receipts -> goods_receipts, stock_receipt_details -> goods_receipt_items
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_receipts')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'goods_receipts') THEN
        ALTER TABLE stock_receipts RENAME TO goods_receipts;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_receipt_details')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'goods_receipt_items') THEN
        ALTER TABLE stock_receipt_details RENAME TO goods_receipt_items;
    END IF;
END $$;

ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES warehouses(id);
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';
UPDATE goods_receipts SET warehouse_id = (SELECT id FROM warehouses ORDER BY id LIMIT 1) WHERE warehouse_id IS NULL;
ALTER TABLE goods_receipts ALTER COLUMN warehouse_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goods_receipts_warehouse ON goods_receipts(warehouse_id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'goods_receipt_items' AND column_name = 'stock_receipt_id') THEN
        ALTER TABLE goods_receipt_items RENAME COLUMN stock_receipt_id TO goods_receipt_id;
    END IF;
END $$;

-- 5. Backfill dữ liệu cũ
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
        EXECUTE $q$
            INSERT INTO inventory_balances (warehouse_id, variant_id, stock_qty, updated_at)
            SELECT (SELECT id FROM warehouses ORDER BY id LIMIT 1), variant_id, stock_qty, updated_at
            FROM inventory inv
            ON CONFLICT (warehouse_id, variant_id) DO NOTHING;
        $q$;
    END IF;
END $$;

-- Tạo transaction GOODS_RECEIPT cho từng dòng phiếu nhập cũ (balance_after = tổng lũy tiến theo thời gian)
WITH ordered AS (
    SELECT gri.id AS item_id, gri.variant_id, gri.quantity,
           row_number() OVER (PARTITION BY gri.variant_id ORDER BY gr.created_at, gr.id, gri.id) AS rn
    FROM goods_receipt_items gri
    JOIN goods_receipts gr ON gri.goods_receipt_id = gr.id
)
INSERT INTO inventory_transactions (warehouse_id, variant_id, qty_change, balance_after, ref_type, ref_id, unit_cost, created_by, note, created_at)
SELECT gr.warehouse_id, o.variant_id, o.quantity,
       SUM(o.quantity) OVER (PARTITION BY o.variant_id ORDER BY o.rn) AS balance_after,
       'GOODS_RECEIPT', gri.id, gri.unit_cost, gr.created_by, gr.receipt_code, gr.created_at
FROM ordered o
JOIN goods_receipt_items gri ON gri.id = o.item_id
JOIN goods_receipts gr ON gri.goods_receipt_id = gr.id
WHERE NOT EXISTS (
    SELECT 1 FROM inventory_transactions it WHERE it.ref_type = 'GOODS_RECEIPT' AND it.ref_id = gri.id
);

-- Tồn đầu kỳ: variant có balance nhưng chưa được ghi nhận bởi giao dịch nào
WITH totals AS (
    SELECT ib.id AS balance_id, ib.warehouse_id, ib.variant_id,
           ib.stock_qty - COALESCE(SUM(it.qty_change) FILTER (WHERE it.warehouse_id = ib.warehouse_id), 0) AS remaining
    FROM inventory_balances ib
    LEFT JOIN inventory_transactions it ON it.variant_id = ib.variant_id
    GROUP BY ib.id, ib.warehouse_id, ib.variant_id, ib.stock_qty
)
INSERT INTO inventory_transactions (warehouse_id, variant_id, qty_change, balance_after, ref_type, created_by, note, created_at)
SELECT t.warehouse_id, t.variant_id, t.remaining, t.remaining, 'ADJUSTMENT', NULL, 'Tồn đầu kỳ', NOW()
FROM totals t
WHERE t.remaining <> 0;

-- 6. Xoá bảng tồn cũ
DROP TABLE IF EXISTS inventory;

-- 7. Permissions mới cho warehouse
INSERT INTO permissions (name, slug, description, "group") VALUES
    ('Điều chỉnh tồn kho', 'warehouse:adjust', 'Tạo phiếu điều chỉnh tồn kho', 'warehouse'),
    ('Chuyển kho', 'warehouse:transfer', 'Tạo phiếu chuyển kho giữa các kho', 'warehouse')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.slug = 'admin' AND p.slug IN ('warehouse:adjust', 'warehouse:transfer')
ON CONFLICT DO NOTHING;

COMMIT;
