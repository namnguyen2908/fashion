-- Add bank info fields to orders table for QR code persistence
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bank_id VARCHAR(20) DEFAULT '970422';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bank_name VARCHAR(50) DEFAULT 'MBBank';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);
