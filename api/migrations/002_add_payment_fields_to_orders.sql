-- Add payment-related fields to orders table

-- Add new columns if they don't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_code VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_content VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP(6);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);

-- Rename total_price to total_amount if needed (skip if already total_amount)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'total_price') THEN
        ALTER TABLE orders RENAME COLUMN total_price TO total_amount;
    END IF;
END $$;

-- Add index for payment_code
CREATE INDEX IF NOT EXISTS idx_orders_payment_code ON orders(payment_code);

-- Add check constraint for payment_status if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'orders_payment_status_check'
    ) THEN
        ALTER TABLE orders ADD CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED'));
    END IF;
END $$;