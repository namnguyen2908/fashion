import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sql = fs.readFileSync(join(__dirname, '001_inventory_and_color_images.sql'), 'utf8');

try {
    await pool.query(sql);
    console.log('Migration ran successfully');
} catch (error) {
    console.error('Migration failed:', error);
} finally {
    await pool.end();
}
