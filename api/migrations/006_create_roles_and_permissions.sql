-- =============================================================
-- 006: Create roles, permissions, and role_permissions tables
-- =============================================================

-- 1. Roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    "group" VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Role-Permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_group ON permissions("group");

-- =============================================================
-- 5. Seed roles
-- =============================================================
INSERT INTO roles (name, slug, description, is_system) VALUES
    ('Admin', 'admin', 'Full system access', TRUE),
    ('Customer', 'customer', 'Regular customer', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================
-- 6. Seed permissions
-- =============================================================
INSERT INTO permissions (name, slug, description, "group") VALUES

    ('Xem sản phẩm', 'product:view', 'Xem danh sách và chi tiết sản phẩm', 'product'),
    ('Thêm sản phẩm', 'product:create', 'Thêm sản phẩm mới', 'product'),
    ('Sửa sản phẩm', 'product:update', 'Cập nhật thông tin sản phẩm', 'product'),
    ('Xóa sản phẩm', 'product:delete', 'Xóa sản phẩm', 'product'),

    ('Xem danh mục', 'category:create', 'Thêm danh mục mới', 'category'),
    ('Sửa danh mục', 'category:update', 'Cập nhật danh mục', 'category'),
    ('Xóa danh mục', 'category:delete', 'Xóa danh mục', 'category'),

    ('Xem người dùng', 'user:view', 'Xem danh sách người dùng', 'user'),

    ('Xem vai trò', 'role:view', 'Xem danh sách và chi tiết vai trò', 'role'),
    ('Thêm vai trò', 'role:create', 'Tạo vai trò mới', 'role'),
    ('Sửa vai trò', 'role:update', 'Cập nhật vai trò', 'role'),
    ('Xóa vai trò', 'role:delete', 'Xóa vai trò', 'role'),
    ('Phân quyền', 'role:assign', 'Gán quyền cho vai trò', 'role'),

    ('Xem tồn kho', 'inventory:view', 'Xem thông tin tồn kho', 'inventory'),
    ('Nhập kho', 'inventory:create', 'Tạo phiếu nhập kho', 'inventory')

ON CONFLICT (slug) DO NOTHING;

-- =============================================================
-- 7. Seed role_permissions (admin gets all permissions)
-- =============================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

-- =============================================================
-- 8. Add FK constraint on users.role -> roles.slug (AFTER seed)
-- =============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_users_role'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT fk_users_role
        FOREIGN KEY (role) REFERENCES roles(slug);
    END IF;
END $$;

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'customer';
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
