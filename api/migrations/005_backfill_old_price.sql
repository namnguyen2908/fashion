-- =============================================
-- Migration: Set old_price = price for existing variants
-- =============================================

BEGIN;

UPDATE product_variants SET old_price = price WHERE old_price IS NULL;

COMMIT;
