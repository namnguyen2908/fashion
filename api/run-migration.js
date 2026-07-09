import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('Running migration: Add payment fields to orders...');

    // Add payment_status column
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'payment_status'
        ) THEN
          ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'PENDING';
        END IF;
      END $$;
    `);
    console.log('✓ Added payment_status column');

    // Add payment_code column
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'payment_code'
        ) THEN
          ALTER TABLE orders ADD COLUMN payment_code VARCHAR(100);
        END IF;
      END $$;
    `);
    console.log('✓ Added payment_code column');

    // Add payment_content column
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'payment_content'
        ) THEN
          ALTER TABLE orders ADD COLUMN payment_content VARCHAR(255);
        END IF;
      END $$;
    `);
    console.log('✓ Added payment_content column');

    // Add paid_at column
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'paid_at'
        ) THEN
          ALTER TABLE orders ADD COLUMN paid_at TIMESTAMP(6);
        END IF;
      END $$;
    `);
    console.log('✓ Added paid_at column');

    // Add transaction_id column
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'transaction_id'
        ) THEN
          ALTER TABLE orders ADD COLUMN transaction_id VARCHAR(100);
        END IF;
      END $$;
    `);
    console.log('✓ Added transaction_id column');

    // Rename total_price to total_amount if needed
    try {
      await pool.query(`ALTER TABLE orders RENAME COLUMN total_price TO total_amount`);
      console.log('✓ Renamed total_price to total_amount');
    } catch (e) {
      if (e.message.includes('total_price')) {
        console.log('✓ total_amount column already exists');
      } else {
        throw e;
      }
    }

    // Add index for payment_code
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_payment_code ON orders(payment_code);
    `);
    console.log('✓ Added payment_code index');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();