-- =============================================
-- Migration: Rename compare_price → list_price, add old_price
-- =============================================

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_variants' AND column_name = 'compare_price') THEN
        ALTER TABLE product_variants RENAME COLUMN compare_price TO list_price;
    END IF;
END $$;

ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS old_price DECIMAL(12, 2);

COMMIT;
