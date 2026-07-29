import pool from '../config/db.js';

function generateSlug(name) {
    return name
        .toLowerCase()
        .replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a')
        .replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e')
        .replace(/ì|í|ị|ỉ|ĩ/g, 'i')
        .replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o')
        .replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u')
        .replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'sale';
}

export const listSales = async (req, res) => {
    try {
        const { active } = req.query;
        let where = '';
        if (active === 'true') where = 'WHERE s.is_active = true';

        const result = await pool.query(`
            SELECT s.*,
                   (SELECT COUNT(*) FROM sale_variants sv WHERE sv.sale_id = s.id) AS variant_count
            FROM sales s ${where}
            ORDER BY s.created_at DESC
        `);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('listSales error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getSaleById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`SELECT * FROM sales WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Sale not found' });

        const variants = await pool.query(`
            SELECT sv.id, sv.variant_id, sv.sale_price, sv.created_at,
                   pv.sku, pv.color, pv.size, pv.is_active,
                   p.name AS product_name, p.id AS product_id,
                   COALESCE((SELECT price FROM variant_prices WHERE variant_id = pv.id), 0) AS price
            FROM sale_variants sv
            JOIN product_variants pv ON sv.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            WHERE sv.sale_id = $1
            ORDER BY p.name, pv.color, pv.size
        `, [id]);

        return res.status(200).json({
            success: true,
            data: { ...result.rows[0], items: variants.rows }
        });
    } catch (error) {
        console.error('getSaleById error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const createSale = async (req, res) => {
    try {
        const { name, description, starts_at, expires_at, items } = req.body;

        if (!name || !starts_at || !expires_at) {
            return res.status(400).json({ success: false, message: 'Name, starts_at, expires_at are required' });
        }

        let slug = generateSlug(name);
        const existing = await pool.query(`SELECT id FROM sales WHERE slug = $1`, [slug]);
        if (existing.rows.length > 0) {
            slug = slug + '-' + Date.now();
        }

        const result = await pool.query(`
            INSERT INTO sales (name, slug, description, starts_at, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [name, slug, description || null, starts_at, expires_at]);

        const saleId = result.rows[0].id;

        if (items && Array.isArray(items) && items.length > 0) {
            for (const item of items) {
                if (item.variant_id && item.sale_price) {
                    await pool.query(`
                        INSERT INTO sale_variants (sale_id, variant_id, sale_price)
                        VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
                    `, [saleId, item.variant_id, item.sale_price]);
                }
            }
        }

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('createSale error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const updateSale = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, starts_at, expires_at, is_active } = req.body;

        const existing = await pool.query(`SELECT id FROM sales WHERE id = $1`, [id]);
        if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Sale not found' });

        const fields = [];
        const values = [];

        if (name !== undefined) { values.push(name); fields.push(`name = $${values.length}`); }
        if (description !== undefined) { values.push(description); fields.push(`description = $${values.length}`); }
        if (starts_at !== undefined) { values.push(starts_at); fields.push(`starts_at = $${values.length}`); }
        if (expires_at !== undefined) { values.push(expires_at); fields.push(`expires_at = $${values.length}`); }
        if (is_active !== undefined) { values.push(is_active); fields.push(`is_active = $${values.length}`); }

        if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });

        values.push(id);
        const result = await pool.query(`
            UPDATE sales SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *
        `, values);

        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('updateSale error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const deleteSale = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`DELETE FROM sales WHERE id = $1 RETURNING id`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Sale not found' });
        return res.status(200).json({ success: true, message: 'Sale deleted' });
    } catch (error) {
        console.error('deleteSale error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const addSaleVariants = async (req, res) => {
    try {
        const { id } = req.params;
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Items are required' });
        }

        const sale = await pool.query(`SELECT id FROM sales WHERE id = $1`, [id]);
        if (sale.rows.length === 0) return res.status(404).json({ success: false, message: 'Sale not found' });

        for (const item of items) {
            if (!item.variant_id || !item.sale_price) continue;
            await pool.query(`
                INSERT INTO sale_variants (sale_id, variant_id, sale_price)
                VALUES ($1, $2, $3)
                ON CONFLICT (sale_id, variant_id) DO UPDATE SET sale_price = $3
            `, [id, item.variant_id, item.sale_price]);
        }

        return res.status(200).json({ success: true, message: 'Variants added to sale' });
    } catch (error) {
        console.error('addSaleVariants error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const removeSaleVariant = async (req, res) => {
    try {
        const { id, variantId } = req.params;
        const result = await pool.query(
            `DELETE FROM sale_variants WHERE sale_id = $1 AND variant_id = $2 RETURNING id`,
            [id, variantId]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Variant not in sale' });
        return res.status(200).json({ success: true, message: 'Removed from sale' });
    } catch (error) {
        console.error('removeSaleVariant error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getActiveSaleVariants = async (req, res) => {
    try {
        const ids = req.query.ids ? req.query.ids.split(',').map(Number).filter(Boolean) : [];

        let where = '';
        const params = [];
        if (ids.length > 0) {
            where = `AND sv.variant_id = ANY($1)`;
            params.push(ids);
        }

        const result = await pool.query(`
            SELECT sv.variant_id, sv.sale_price, s.id AS sale_id, s.name AS sale_name,
                   s.slug AS sale_slug
            FROM sale_variants sv
            JOIN sales s ON sv.sale_id = s.id
            WHERE s.is_active = true AND NOW() BETWEEN s.starts_at AND s.expires_at ${where}
            ORDER BY sv.sale_price ASC
        `, params);

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('getActiveSaleVariants error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
