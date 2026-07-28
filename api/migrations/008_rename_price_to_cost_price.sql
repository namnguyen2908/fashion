-- =============================================
-- Migration: Rename price → cost_price, set list_price as selling price
-- =============================================

BEGIN;

ALTER TABLE product_variants RENAME COLUMN price TO cost_price;

UPDATE product_variants SET list_price = cost_price WHERE list_price IS NULL;

COMMIT;
