BEGIN;

-- 1. variant_prices: tách giá khỏi product_variants
CREATE TABLE IF NOT EXISTS variant_prices (
    id SERIAL PRIMARY KEY,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    price_type VARCHAR(20) NOT NULL CHECK (price_type IN ('cost_price', 'list_price')),
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (variant_id, price_type)
);

CREATE INDEX IF NOT EXISTS idx_vp_variant ON variant_prices(variant_id);

-- Migrate cost_price
INSERT INTO variant_prices (variant_id, price_type, price)
SELECT id, 'cost_price', cost_price FROM product_variants
ON CONFLICT DO NOTHING;

-- Migrate list_price
INSERT INTO variant_prices (variant_id, price_type, price)
SELECT id, 'list_price', COALESCE(list_price, cost_price) FROM product_variants
ON CONFLICT DO NOTHING;

-- 2. sales: bảng sự kiện sale
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    starts_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_active ON sales(is_active);
CREATE INDEX IF NOT EXISTS idx_sales_dates ON sales(starts_at, expires_at);

-- 3. sale_variants: variant tham gia sale
CREATE TABLE IF NOT EXISTS sale_variants (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    sale_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (sale_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_sv_sale ON sale_variants(sale_id);
CREATE INDEX IF NOT EXISTS idx_sv_variant ON sale_variants(variant_id);

-- 4. Xoá cột giá cũ khỏi product_variants
ALTER TABLE product_variants DROP COLUMN IF EXISTS cost_price;
ALTER TABLE product_variants DROP COLUMN IF EXISTS list_price;
ALTER TABLE product_variants DROP COLUMN IF EXISTS old_price;

-- 5. Permissions cho sales
INSERT INTO permissions (name, slug, description, "group") VALUES
    ('Xem sale', 'sale:view', 'Xem danh sách và chi tiết chương trình sale', 'sale'),
    ('Tạo/ sửa sale', 'sale:create', 'Tạo, sửa, xoá chương trình sale', 'sale')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.slug = 'admin' AND p.slug IN ('sale:view', 'sale:create')
ON CONFLICT DO NOTHING;

COMMIT;
