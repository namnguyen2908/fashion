BEGIN;

-- Tạo permissions mới cho warehouse (nếu chưa tồn tại)
INSERT INTO permissions (name, slug, description, "group") VALUES
    ('Xem kho hàng', 'warehouse:view', 'Xem thông tin tồn kho và phiếu nhập', 'warehouse'),
    ('Nhập kho', 'warehouse:create', 'Tạo phiếu nhập kho', 'warehouse')
ON CONFLICT (slug) DO NOTHING;

-- Gán quyền warehouse cho role admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.slug = 'admin' AND p.slug IN ('warehouse:view', 'warehouse:create')
ON CONFLICT DO NOTHING;

COMMIT;
