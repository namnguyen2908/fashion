-- =============================================
-- Migration: Tách stock khỏi variant + ảnh theo màu
-- =============================================

BEGIN;

-- 1. Tạo bảng inventory (tồn kho hiện tại)
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    variant_id INTEGER NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_variant ON inventory(variant_id);

-- 2. Tạo bảng inbound_notes (phiếu nhập kho)
CREATE TABLE IF NOT EXISTS inbound_notes (
    id SERIAL PRIMARY KEY,
    note_code VARCHAR(50) NOT NULL UNIQUE,
    note_date TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_notes_date ON inbound_notes(note_date DESC);

-- 3. Tạo bảng inbound_items (chi tiết phiếu nhập)
CREATE TABLE IF NOT EXISTS inbound_items (
    id SERIAL PRIMARY KEY,
    inbound_note_id INTEGER NOT NULL REFERENCES inbound_notes(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_items_note ON inbound_items(inbound_note_id);
CREATE INDEX IF NOT EXISTS idx_inbound_items_variant ON inbound_items(variant_id);

-- 4. Migrate stock_qty từ variant sang inventory (nếu cột còn tồn tại)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_variants' AND column_name = 'stock_qty') THEN
        INSERT INTO inventory (variant_id, stock_qty)
        SELECT id, stock_qty FROM product_variants WHERE stock_qty > 0;
    END IF;
END $$;

-- 5. Xoá cột stock_qty khỏi product_variants
ALTER TABLE product_variants DROP COLUMN IF EXISTS stock_qty;

-- 6. Thêm cột color vào product_images thay cho variant_id
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS color VARCHAR(50);

-- 7. Migrate dữ liệu: lấy color từ variant và gán vào product_images (nếu cột còn tồn tại)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_images' AND column_name = 'variant_id') THEN
        UPDATE product_images pi
        SET color = pv.color
        FROM product_variants pv
        WHERE pi.variant_id = pv.id;
    END IF;
END $$;

-- 8. Xoá variant_id khỏi product_images
ALTER TABLE product_images DROP COLUMN IF EXISTS variant_id;

-- 9. Index cho color
CREATE INDEX IF NOT EXISTS idx_product_images_color ON product_images(color);

-- 10. Xoá index cũ
DROP INDEX IF EXISTS idx_product_images_variant;

COMMIT;
