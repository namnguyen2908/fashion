import pool from '../config/db.js';

// =========================================
// CREATE ORDER (CHECKOUT)
// =========================================
export const createOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      shipping_full_name,
      shipping_phone,
      shipping_address,
      payment_method,
      items,
      discount_code
    } = req.body;

    // Validate required fields
    if (!shipping_full_name || !shipping_phone || !shipping_address) {
      return res.status(400).json({
        success: false,
        message: 'Shipping info is required'
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order items are required'
      });
    }

    // Calculate total and validate items
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const { variant_id, quantity } = item;

      if (!variant_id || !quantity || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid item data'
        });
      }

      // Get variant info
      const variantResult = await pool.query(
        `SELECT pv.id, pv.list_price, pv.product_id, p.name as product_name
         FROM product_variants pv
         JOIN products p ON pv.product_id = p.id
         WHERE pv.id = $1 AND pv.is_active = true`,
        [variant_id]
      );

      if (variantResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Product variant ${variant_id} not found or inactive`
        });
      }

      const variant = variantResult.rows[0];
      const itemTotal = Number(variant.list_price) * quantity;
      totalAmount += itemTotal;

      orderItems.push({
        variant_id,
        quantity,
        price: variant.list_price,
        product_name: variant.product_name
      });
    }

    // Apply discount if provided
    let discountAmount = 0;
    let appliedDiscountId = null;

    if (discount_code) {
      const discountResult = await pool.query(
        `SELECT ud.id, ud.discount_type, ud.discount_value, ud.min_order_amount
         FROM user_discounts ud
         WHERE ud.code = $1 AND ud.user_id = $2 AND ud.is_used = false`,
        [discount_code.toUpperCase(), userId]
      );

      if (discountResult.rows.length > 0) {
        const d = discountResult.rows[0];

        if (!d.expires_at || new Date(d.expires_at) > new Date()) {
          if (totalAmount >= Number(d.min_order_amount)) {
            if (d.discount_type === 'percentage') {
              discountAmount = Math.round(totalAmount * Number(d.discount_value) / 100);
            } else {
              discountAmount = Number(d.discount_value);
            }
            if (discountAmount > totalAmount) discountAmount = totalAmount;
            appliedDiscountId = d.id;
          }
        }
      }
    }

    totalAmount -= discountAmount;

    // Create order transaction
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Insert order
      const orderResult = await client.query(
        `INSERT INTO orders
         (user_id, total_amount, payment_method, shipping_full_name, shipping_phone, shipping_address, status, discount_amount)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
         RETURNING *`,
        [userId, totalAmount, payment_method || 'BANK_TRANSFER', shipping_full_name, shipping_phone, shipping_address, discountAmount]
      );

      const order = orderResult.rows[0];

      // Insert order items
      for (const item of orderItems) {
        await client.query(
          `INSERT INTO order_items (order_id, variant_id, quantity, price)
           VALUES ($1, $2, $3, $4)`,
          [order.id, item.variant_id, item.quantity, item.price]
        );
      }

      // Mark discount as used
      if (appliedDiscountId) {
        await client.query(
          `UPDATE user_discounts SET is_used = true, used_at = NOW(), order_id = $1 WHERE id = $2`,
          [order.id, appliedDiscountId]
        );
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          id: order.id,
          total_amount: totalAmount,
          discount_amount: discountAmount,
          status: order.status,
          payment_status: order.payment_status,
          created_at: order.created_at
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// =========================================
// GET MY ORDERS
// =========================================
export const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const result = await pool.query(
      `      SELECT id, total_amount, discount_amount, status, payment_status, payment_code,
              shipping_full_name, shipping_phone, shipping_address,
              created_at, paid_at
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM orders WHERE user_id = $1`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
      total: Number(countResult.rows[0].total),
      page: Number(page),
      limit: Number(limit)
    });

  } catch (error) {
    console.error('Get my orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// =========================================
// GET ORDER DETAIL
// =========================================
export const getOrderDetail = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { orderId } = req.params;

    const orderResult = await pool.query(
      `      SELECT id, user_id, total_amount, discount_amount, status, payment_status, payment_code,
              payment_content, paid_at, transaction_id,
              shipping_full_name, shipping_phone, shipping_address,
              created_at, bank_id, bank_name, account_number
       FROM orders
       WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')`,
      [orderId, userId, req.user.role]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Get order items
    const itemsResult = await pool.query(
      `SELECT oi.id, oi.variant_id, oi.quantity, oi.price,
              pv.color, pv.size, pv.sku, p.name as product_name,
              pi.image_url
       FROM order_items oi
       JOIN product_variants pv ON oi.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.color = pv.color
       WHERE oi.order_id = $1`,
      [orderId]
    );

    order.items = itemsResult.rows;

    return res.status(200).json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Get order detail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// =========================================
// CANCEL ORDER
// =========================================
export const cancelOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { orderId } = req.params;

    const orderResult = await pool.query(
      `SELECT id, user_id, status, payment_status FROM orders WHERE id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    if (String(order.user_id) !== String(userId) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (order.payment_status === 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a paid order'
      });
    }

    if (order.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Order already cancelled'
      });
    }

    await pool.query(
      `UPDATE orders SET status = 'CANCELLED' WHERE id = $1`,
      [orderId]
    );

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};