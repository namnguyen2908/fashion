BEGIN;

-- 1. Thêm cột slug cho bảng warehouses
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- 2. Backfill slug cho kho hiện có từ name (xử lý dấu tiếng Việt)
UPDATE warehouses
SET slug = regexp_replace(
        regexp_replace(
            translate(lower(name),
                'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ',
                'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'),
            '[^a-z0-9]+', '-', 'g'),
        '^-+|-+$', '', 'g')
WHERE slug IS NULL OR slug = '';

-- 3. Fallback nếu tên không sinh được slug (vd tên toàn ký tự đặc biệt)
UPDATE warehouses
SET slug = 'kho-' || id
WHERE slug IS NULL OR slug = '';

-- 4. Unique index (partial để nhiều NULL vẫn hợp lệ trước backfill)
CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouses_slug ON warehouses(slug) WHERE slug IS NOT NULL;

COMMIT;
