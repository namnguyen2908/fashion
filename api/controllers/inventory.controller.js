import pool from '../config/db.js';

// =========================================
// GET STOCK FOR A VARIANT
// =========================================
export const getVariantStock = async (req, res) => {
    try {
        const { variantId } = req.params;

        const result = await pool.query(
            `SELECT variant_id, stock_qty, updated_at FROM inventory WHERE variant_id = $1`,
            [variantId]
        );

        if (result.rows.length === 0) {
            return res.status(200).json({
                success: true,
                data: { variant_id: Number(variantId), stock_qty: 0 }
            });
        }

        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// GET STOCK FOR ALL VARIANTS OF A PRODUCT
// =========================================
export const getProductStock = async (req, res) => {
    try {
        const { productId } = req.params;

        const result = await pool.query(
            `
            SELECT pv.id AS variant_id, pv.sku, pv.color, pv.size,
                   COALESCE(inv.stock_qty, 0) AS stock_qty
            FROM product_variants pv
            LEFT JOIN inventory inv ON pv.id = inv.variant_id
            WHERE pv.product_id = $1 AND pv.is_active = true
            ORDER BY pv.color, pv.size
            `,
            [productId]
        );

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// CREATE INBOUND NOTE (NHẬP KHO)
// =========================================
export const createInboundNote = async (req, res) => {
    try {
        const { notes, items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Items are required' });
        }

        for (const item of items) {
            if (!item.variant_id || !item.quantity || item.quantity <= 0) {
                return res.status(400).json({ success: false, message: 'Invalid item data' });
            }
        }

        const noteCode = `NK-${Date.now()}`;

        const noteResult = await pool.query(
            `INSERT INTO inbound_notes (note_code, created_by, notes)
             VALUES ($1, $2, $3)
             RETURNING id, note_code, note_date, created_by, status, notes, created_at`,
            [noteCode, req.user.userId, notes || null]
        );

        const noteId = noteResult.rows[0].id;

        for (const item of items) {
            await pool.query(
                `INSERT INTO inbound_items (inbound_note_id, variant_id, quantity) VALUES ($1, $2, $3)`,
                [noteId, item.variant_id, item.quantity]
            );

            await pool.query(
                `
                INSERT INTO inventory (variant_id, stock_qty)
                VALUES ($1, $2)
                ON CONFLICT (variant_id)
                DO UPDATE SET stock_qty = inventory.stock_qty + $2, updated_at = NOW()
                `,
                [item.variant_id, item.quantity]
            );
        }

        return res.status(201).json({
            success: true,
            message: 'Inbound note created successfully',
            data: noteResult.rows[0]
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// LIST INBOUND NOTES
// =========================================
export const listInboundNotes = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Math.max(Number(page), 1) - 1) * Number(limit);

        const result = await pool.query(
            `
            SELECT n.id, n.note_code, n.note_date, n.status, n.notes, n.created_at,
                   u.name AS created_by_name
            FROM inbound_notes n
            LEFT JOIN users u ON n.created_by = u.id
            ORDER BY n.created_at DESC
            LIMIT $1 OFFSET $2
            `,
            [limit, offset]
        );

        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// GET INBOUND NOTE DETAIL
// =========================================
export const getInboundNoteById = async (req, res) => {
    try {
        const { id } = req.params;

        const note = await pool.query(
            `SELECT * FROM inbound_notes WHERE id = $1`,
            [id]
        );

        if (note.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Inbound note not found' });
        }

        const items = await pool.query(
            `
            SELECT ni.id, ni.variant_id, ni.quantity, ni.created_at,
                   pv.sku, pv.color, pv.size,
                   p.name AS product_name
            FROM inbound_items ni
            JOIN product_variants pv ON ni.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            WHERE ni.inbound_note_id = $1
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            data: { ...note.rows[0], items: items.rows }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
