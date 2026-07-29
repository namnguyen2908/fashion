BEGIN;

DELETE FROM variant_prices WHERE price_type = 'cost_price';

ALTER TABLE variant_prices DROP CONSTRAINT IF EXISTS variant_prices_variant_id_price_type_key;
ALTER TABLE variant_prices DROP CONSTRAINT IF EXISTS variant_prices_price_type_check;
DROP INDEX IF EXISTS idx_vp_variant;

ALTER TABLE variant_prices DROP COLUMN price_type;

ALTER TABLE variant_prices ADD UNIQUE (variant_id);
CREATE INDEX IF NOT EXISTS idx_vp_variant ON variant_prices(variant_id);

COMMIT;
