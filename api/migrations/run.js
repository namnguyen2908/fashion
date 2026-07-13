import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrations = [
    '001_inventory_and_color_images.sql',
    '002_add_payment_fields_to_orders.sql',
    '003_add_bank_info_to_orders.sql',
    '004_rename_compare_price_add_old_price.sql',
    '005_backfill_old_price.sql',
    '006_create_roles_and_permissions.sql',
];

try {
    for (const file of migrations) {
        const sql = fs.readFileSync(join(__dirname, file), 'utf8');
        await pool.query(sql);
        console.log(`Migration ${file} ran successfully`);
    }
    console.log('All migrations completed');
} catch (error) {
    console.error('Migration failed:', error);
} finally {
    await pool.end();
}
