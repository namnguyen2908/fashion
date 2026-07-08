import pool from '../config/db.js';

// =========================================
// GET USER CART
// =========================================
export const getCart = async (req, res) => {
    try {
        const userId = req.user.userId ?? req.user.id;

        const cartResult = await pool.query(
            `SELECT id FROM carts WHERE user_id = $1`,
            [userId]
        );

        if (cartResult.rows.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    items: [],
                    totalItems: 0,
                    totalAmount: 0
                }
            });
        }

        const cartId = cartResult.rows[0].id;

        const itemsResult = await pool.query(
            `
            SELECT
                ci.id as cart_item_id,
                ci.quantity,
                pv.id as variant_id,
                pv.price,
                pv.sku,
                pv.size,
                pv.color,
                p.name as product_name,
                p.slug as product_slug,
                (SELECT image_url FROM product_images WHERE product_id = p.id AND (color = pv.color OR is_thumbnail = true) ORDER BY (color = pv.color) DESC NULLS LAST, is_thumbnail DESC LIMIT 1) as images
            FROM cart_items ci
            JOIN product_variants pv ON ci.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            WHERE ci.cart_id = $1
            `,
            [cartId]
        );

        const items = itemsResult.rows;
        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
        const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        return res.status(200).json({
            success: true,
            data: {
                cartId,
                items,
                totalItems,
                totalAmount
            }
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// =========================================
// ADD ITEM TO CART
// =========================================
export const addItem = async (req, res) => {
    try {
        const userId = req.user.userId ?? req.user.id;
        const { variant_id, quantity = 1 } = req.body;

        console.log(`[addItem] userId=${userId}, variant_id=${variant_id}, quantity=${quantity}`);

        if (!variant_id) {
            return res.status(400).json({
                success: false,
                message: 'Variant ID is required'
            });
        }

        // 1. Find or create cart
        let cartResult = await pool.query(
            `SELECT id FROM carts WHERE user_id = $1`,
            [userId]
        );

        let cartId;
        if (cartResult.rows.length === 0) {
            const newCart = await pool.query(
                `INSERT INTO carts (user_id) VALUES ($1) RETURNING id`,
                [userId]
            );
            cartId = newCart.rows[0].id;
        } else {
            cartId = cartResult.rows[0].id;
        }

        // 2. Add or update item
        const itemCheck = await pool.query(
            `SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND variant_id = $2`,
            [cartId, variant_id]
        );

        if (itemCheck.rows.length > 0) {
            const itemId = itemCheck.rows[0].id;
            const newQuantity = itemCheck.rows[0].quantity + quantity;

            await pool.query(
                `UPDATE cart_items SET quantity = $1 WHERE id = $2`,
                [newQuantity, itemId]
            );
        } else {
            await pool.query(
                `INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ($1, $2, $3)`,
                [cartId, variant_id, quantity]
            );
        }

        return res.status(200).json({
            success: true,
            message: 'Item added to cart successfully'
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// =========================================
// UPDATE ITEM QUANTITY
// =========================================
export const updateItem = async (req, res) => {
    try {
        const userId = req.user.userId ?? req.user.id;
        const { id } = req.params; // cart_item_id
        const { quantity } = req.body;

        if (quantity === undefined || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid quantity is required'
            });
        }

        // Verify item belongs to user's cart
        const itemResult = await pool.query(
            `
            SELECT ci.id
            FROM cart_items ci
            JOIN carts c ON ci.cart_id = c.id
            WHERE ci.id = $1 AND c.user_id = $2
            `,
            [id, userId]
        );

        if (itemResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cart item not found'
            });
        }

        await pool.query(
            `UPDATE cart_items SET quantity = $1 WHERE id = $2`,
            [quantity, id]
        );

        return res.status(200).json({
            success: true,
            message: 'Cart item updated successfully'
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// =========================================
// REMOVE ITEM FROM CART
// =========================================
export const removeItem = async (req, res) => {
    try {
        const userId = req.user.userId ?? req.user.id;
        const { id } = req.params; // cart_item_id

        // Verify item belongs to user's cart
        const itemResult = await pool.query(
            `
            SELECT ci.id
            FROM cart_items ci
            JOIN carts c ON ci.cart_id = c.id
            WHERE ci.id = $1 AND c.user_id = $2
            `,
            [id, userId]
        );

        if (itemResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cart item not found'
            });
        }

        await pool.query(
            `DELETE FROM cart_items WHERE id = $1`,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: 'Item removed from cart successfully'
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// =========================================
// CLEAR CART
// =========================================
export const clearCart = async (req, res) => {
    try {
        const userId = req.user.userId ?? req.user.id;

        const cartResult = await pool.query(
            `SELECT id FROM carts WHERE user_id = $1`,
            [userId]
        );

        if (cartResult.rows.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Cart already empty'
            });
        }

        const cartId = cartResult.rows[0].id;

        await pool.query(
            `DELETE FROM cart_items WHERE cart_id = $1`,
            [cartId]
        );

        return res.status(200).json({
            success: true,
            message: 'Cart cleared successfully'
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
