import pool from './config/db.js';

const tables = [
    'role_permissions', 'permissions', 'roles',
    'inbound_items', 'inbound_notes', 'inventory',
    'cart_items', 'carts', 'order_items', 'orders',
    'product_images', 'product_reviews', 'product_variants', 'products',
    'categories', 'user_addresses', 'users',
];

try {
    await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_role');
    console.log('Dropped FK constraint');

    for (const table of tables) {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`Dropped table ${table}`);
    }

    console.log('All tables dropped. Now run: node migrations/run.js');
} catch (error) {
    console.error('Reset failed:', error);
} finally {
    await pool.end();
}
