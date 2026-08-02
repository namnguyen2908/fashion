BEGIN;

-- =========================================================
-- 018: Procurement + Warehouse module (PO, GR lifecycle,
--      Adjustment, Stock Count, Transfer, Inventory Costs)
-- =========================================================

-- 1. document_sequences: cấp mã chứng từ tuần tự
CREATE TABLE IF NOT EXISTS document_sequences (
    id SERIAL PRIMARY KEY,
    prefix VARCHAR(10) NOT NULL,
    year INT NOT NULL,
    seq INT NOT NULL DEFAULT 0,
    UNIQUE (prefix, year)
);

-- 2. purchase_orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id SERIAL PRIMARY KEY,
    po_code VARCHAR(50) NOT NULL UNIQUE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    expected_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_warehouse ON purchase_orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

-- 3. purchase_order_items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id SERIAL PRIMARY KEY,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    received_qty INTEGER NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (po_id, variant_id),
    CONSTRAINT po_items_received_check CHECK (received_qty <= quantity)
);
CREATE INDEX IF NOT EXISTS idx_poi_po ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_poi_variant ON purchase_order_items(variant_id);

-- 4. inventory_costs: giá vốn hiện hành (weighted average) theo variant
CREATE TABLE IF NOT EXISTS inventory_costs (
    id SERIAL PRIMARY KEY,
    variant_id INTEGER NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
    current_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_costs_variant ON inventory_costs(variant_id);

-- 5. stock_adjustments
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id SERIAL PRIMARY KEY,
    adjustment_code VARCHAR(50) NOT NULL UNIQUE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    reason VARCHAR(255) NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sa_warehouse ON stock_adjustments(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sa_status ON stock_adjustments(status);

-- 6. stock_adjustment_items
CREATE TABLE IF NOT EXISTS stock_adjustment_items (
    id SERIAL PRIMARY KEY,
    adjustment_id INTEGER NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id),
    quantity INTEGER NOT NULL CHECK (quantity <> 0),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sai_adjustment ON stock_adjustment_items(adjustment_id);
CREATE INDEX IF NOT EXISTS idx_sai_variant ON stock_adjustment_items(variant_id);

-- 7. stock_count_sessions
CREATE TABLE IF NOT EXISTS stock_count_sessions (
    id SERIAL PRIMARY KEY,
    count_code VARCHAR(50) NOT NULL UNIQUE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    adjustment_id INTEGER REFERENCES stock_adjustments(id),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_scs_warehouse ON stock_count_sessions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_scs_status ON stock_count_sessions(status);

-- 8. stock_count_items
CREATE TABLE IF NOT EXISTS stock_count_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES stock_count_sessions(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id),
    system_qty INTEGER NOT NULL DEFAULT 0,
    counted_qty INTEGER,
    difference INTEGER DEFAULT 0,
    UNIQUE (session_id, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_sci_session ON stock_count_items(session_id);
CREATE INDEX IF NOT EXISTS idx_sci_variant ON stock_count_items(variant_id);

-- 9. transfer_orders
CREATE TABLE IF NOT EXISTS transfer_orders (
    id SERIAL PRIMARY KEY,
    transfer_code VARCHAR(50) NOT NULL UNIQUE,
    from_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    to_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT transfer_diff_warehouse CHECK (from_warehouse_id <> to_warehouse_id)
);
CREATE INDEX IF NOT EXISTS idx_to_from_wh ON transfer_orders(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_to_to_wh ON transfer_orders(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_to_status ON transfer_orders(status);

-- 10. transfer_items
CREATE TABLE IF NOT EXISTS transfer_items (
    id SERIAL PRIMARY KEY,
    transfer_order_id INTEGER NOT NULL REFERENCES transfer_orders(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (transfer_order_id, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_ti_transfer ON transfer_items(transfer_order_id);
CREATE INDEX IF NOT EXISTS idx_ti_variant ON transfer_items(variant_id);

-- 11. goods_receipts: thêm po_id (KHÔNG bắt buộc), giữ receipt_date, đổi ngữ nghĩa status
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS po_id INTEGER REFERENCES purchase_orders(id);
ALTER TABLE goods_receipts ALTER COLUMN status SET DEFAULT 'DRAFT';
UPDATE goods_receipts SET status = 'COMPLETED' WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_goods_receipts_po ON goods_receipts(po_id);

-- Bỏ cột legacy `supplier` (đã có supplier_id)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'goods_receipts' AND column_name = 'supplier') THEN
        ALTER TABLE goods_receipts DROP COLUMN supplier;
    END IF;
END $$;

-- 12. goods_receipt_items: thêm po_item_id (KHÔNG bắt buộc)
ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS po_item_id INTEGER REFERENCES purchase_order_items(id);
CREATE INDEX IF NOT EXISTS idx_gri_po_item ON goods_receipt_items(po_item_id);

-- 13. inventory_balances: stock_qty -> on_hand, thêm reserved
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'inventory_balances' AND column_name = 'stock_qty') THEN
        ALTER TABLE inventory_balances RENAME COLUMN stock_qty TO on_hand;
    END IF;
END $$;
ALTER TABLE inventory_balances ADD COLUMN IF NOT EXISTS reserved INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_balances_on_hand_check') THEN
        ALTER TABLE inventory_balances ADD CONSTRAINT inventory_balances_on_hand_check CHECK (on_hand >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_balances_reserved_check') THEN
        ALTER TABLE inventory_balances ADD CONSTRAINT inventory_balances_reserved_check CHECK (reserved >= 0);
    END IF;
END $$;

-- 14. inventory_transactions: balance_after -> qty_after, thêm qty_before
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'inventory_transactions' AND column_name = 'balance_after') THEN
        ALTER TABLE inventory_transactions RENAME COLUMN balance_after TO qty_after;
    END IF;
END $$;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS qty_before INTEGER NOT NULL DEFAULT 0;
UPDATE inventory_transactions SET qty_before = qty_after - qty_change WHERE qty_before = 0;

-- 15. Permissions cho đơn đặt hàng
INSERT INTO permissions (name, slug, description, "group") VALUES
    ('Xem đơn đặt hàng', 'purchase:view', 'Xem danh sách và chi tiết đơn đặt hàng', 'purchase'),
    ('Tạo/ sửa đơn đặt hàng', 'purchase:create', 'Tạo, sửa, xác nhận, hủy đơn đặt hàng', 'purchase')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.slug = 'admin' AND p.slug IN ('purchase:view', 'purchase:create')
ON CONFLICT DO NOTHING;

-- 16. Backfill inventory_costs (weighted average từ GR cũ COMPLETED; fallback supplier_variants)
INSERT INTO inventory_costs (variant_id, current_cost)
SELECT gri.variant_id,
       (SUM(gri.quantity * COALESCE(gri.unit_cost, 0)) / NULLIF(SUM(gri.quantity), 0))::DECIMAL(12, 2)
FROM goods_receipt_items gri
JOIN goods_receipts gr ON gri.goods_receipt_id = gr.id
WHERE gr.status = 'COMPLETED'
GROUP BY gri.variant_id
ON CONFLICT (variant_id) DO NOTHING;

INSERT INTO inventory_costs (variant_id, current_cost)
SELECT sv.variant_id, sv.cost_price
FROM supplier_variants sv
WHERE NOT EXISTS (SELECT 1 FROM inventory_costs ic WHERE ic.variant_id = sv.variant_id)
  AND sv.cost_price IS NOT NULL
ON CONFLICT (variant_id) DO NOTHING;

-- 17. Seed document_sequences cho năm hiện tại
INSERT INTO document_sequences (prefix, year, seq)
SELECT p.prefix, EXTRACT(YEAR FROM NOW())::int, 0
FROM (VALUES ('PO'), ('PN'), ('DCNH'), ('KK'), ('CN')) AS p(prefix)
ON CONFLICT (prefix, year) DO NOTHING;

COMMIT;
