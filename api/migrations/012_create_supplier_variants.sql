BEGIN;

CREATE TABLE IF NOT EXISTS supplier_variants (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    cost_price DECIMAL(12,2),
    previous_cost_price DECIMAL(12,2),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (supplier_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_sv_supplier ON supplier_variants(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sv_variant ON supplier_variants(variant_id);

COMMIT;
