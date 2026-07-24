-- =============================================================
-- 007: Create discount_rules and user_discounts tables
-- =============================================================

-- 1. discount_rules table
CREATE TABLE IF NOT EXISTS discount_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('total_spent', 'order_count', 'product_purchase', 'category_purchase')),
    trigger_value JSONB NOT NULL,
    reward_type VARCHAR(20) NOT NULL CHECK (reward_type IN ('percentage', 'fixed')),
    reward_value DECIMAL(12, 2) NOT NULL,
    min_order_amount DECIMAL(12, 2) DEFAULT 0,
    max_usage_per_user INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. user_discounts table
CREATE TABLE IF NOT EXISTS user_discounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discount_rule_id INTEGER NOT NULL REFERENCES discount_rules(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL,
    discount_value DECIMAL(12, 2) NOT NULL,
    min_order_amount DECIMAL(12, 2) DEFAULT 0,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- 3. Add discount_amount column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12, 2) DEFAULT 0;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_user_discounts_user ON user_discounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_discounts_code ON user_discounts(code);
CREATE INDEX IF NOT EXISTS idx_user_discounts_used ON user_discounts(is_used);
CREATE INDEX IF NOT EXISTS idx_discount_rules_active ON discount_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_discount_rules_trigger ON discount_rules(trigger_type);
