BEGIN;

-- Drop old tables if they exist (from previous AI-generated migration 001)
DROP TABLE IF EXISTS inbound_items CASCADE;
DROP TABLE IF EXISTS inbound_notes CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;

-- 1. inventory: số lượng tồn hiện tại của từng variant
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    variant_id INTEGER NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_variant ON inventory(variant_id);

-- 2. stock_receipts: phiếu nhập kho
CREATE TABLE stock_receipts (
    id SERIAL PRIMARY KEY,
    receipt_code VARCHAR(50) NOT NULL UNIQUE,
    receipt_date TIMESTAMPTZ DEFAULT NOW(),
    supplier VARCHAR(255),
    created_by INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_receipts_code ON stock_receipts(receipt_code);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_date ON stock_receipts(receipt_date DESC);

-- 3. stock_receipt_details: chi tiết phiếu nhập
CREATE TABLE stock_receipt_details (
    id SERIAL PRIMARY KEY,
    stock_receipt_id INTEGER NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srd_receipt ON stock_receipt_details(stock_receipt_id);
CREATE INDEX IF NOT EXISTS idx_srd_variant ON stock_receipt_details(variant_id);

COMMIT;
