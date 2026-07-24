import pool from '../config/db.js';
import crypto from 'crypto';

function generateDiscountCode() {
  return 'DS-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

// =========================================
// ADMIN: CRUD DISCOUNT RULES
// =========================================
export const createRule = async (req, res) => {
  try {
    const { name, description, trigger_type, trigger_value, reward_type, reward_value, min_order_amount, max_usage_per_user, expires_at } = req.body;

    const result = await pool.query(
      `INSERT INTO discount_rules (name, description, trigger_type, trigger_value, reward_type, reward_value, min_order_amount, max_usage_per_user, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, description, trigger_type, JSON.stringify(trigger_value), reward_type, reward_value, min_order_amount || 0, max_usage_per_user || 1, expires_at || null]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Create discount rule error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getRules = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM discount_rules ORDER BY created_at DESC');
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get discount rules error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, trigger_type, trigger_value, reward_type, reward_value, min_order_amount, max_usage_per_user, is_active, expires_at } = req.body;

    const result = await pool.query(
      `UPDATE discount_rules SET name = $1, description = $2, trigger_type = $3, trigger_value = $4, reward_type = $5, reward_value = $6, min_order_amount = $7, max_usage_per_user = $8, is_active = $9, expires_at = $10 WHERE id = $11 RETURNING *`,
      [name, description, trigger_type, JSON.stringify(trigger_value), reward_type, reward_value, min_order_amount, max_usage_per_user, is_active, expires_at, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update discount rule error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteRule = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM discount_rules WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    return res.status(200).json({ success: true, message: 'Rule deleted' });
  } catch (error) {
    console.error('Delete discount rule error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =========================================
// USER: MY DISCOUNTS
// =========================================
export const getMyDiscounts = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT ud.id, ud.code, ud.discount_type, ud.discount_value, ud.min_order_amount, ud.is_used, ud.assigned_at, ud.expires_at,
              dr.name as rule_name, dr.description as rule_description
       FROM user_discounts ud
       JOIN discount_rules dr ON ud.discount_rule_id = dr.id
       WHERE ud.user_id = $1 AND (ud.expires_at IS NULL OR ud.expires_at > NOW())
       ORDER BY ud.assigned_at DESC`,
      [userId]
    );

    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get my discounts error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =========================================
// VALIDATE DISCOUNT CODE (CHECKOUT)
// =========================================
export const validateDiscount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { code, order_total } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Discount code is required' });
    }

    const result = await pool.query(
      `SELECT ud.id, ud.code, ud.discount_type, ud.discount_value, ud.min_order_amount, ud.expires_at
       FROM user_discounts ud
       WHERE ud.code = $1 AND ud.user_id = $2 AND ud.is_used = false`,
      [code.toUpperCase(), userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá không hợp lệ hoặc đã được sử dụng' });
    }

    const discount = result.rows[0];

    if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết hạn' });
    }

    if (order_total && Number(discount.min_order_amount) > 0 && Number(order_total) < Number(discount.min_order_amount)) {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng tối thiểu ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(discount.min_order_amount))}`
      });
    }

    let discountAmount = 0;
    if (discount.discount_type === 'percentage') {
      discountAmount = Math.round(Number(order_total) * Number(discount.discount_value) / 100);
    } else {
      discountAmount = Number(discount.discount_value);
    }

    if (discountAmount > Number(order_total)) {
      discountAmount = Number(order_total);
    }

    return res.status(200).json({
      success: true,
      data: {
        id: discount.id,
        code: discount.code,
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        min_order_amount: discount.min_order_amount,
        discount_amount: discountAmount
      }
    });
  } catch (error) {
    console.error('Validate discount error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =========================================
// CHECK & ASSIGN DISCOUNT RULES (on PAID)
// =========================================
export const checkAndAssignRules = async (orderId, userId) => {
  try {
    const rulesResult = await pool.query(
      `SELECT * FROM discount_rules
       WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())
       AND (starts_at IS NULL OR starts_at <= NOW())`
    );

    for (const rule of rulesResult.rows) {
      let qualifies = false;

      const usageCount = await pool.query(
        `SELECT COUNT(*) as cnt FROM user_discounts WHERE user_id = $1 AND discount_rule_id = $2`,
        [userId, rule.id]
      );
      if (Number(usageCount.rows[0].cnt) >= rule.max_usage_per_user) continue;

      switch (rule.trigger_type) {
        case 'total_spent': {
          const { min_total = 0 } = rule.trigger_value || {};
          const spent = await pool.query(
            `SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE user_id = $1 AND payment_status = 'PAID'`,
            [userId]
          );
          if (Number(spent.rows[0].total) >= Number(min_total)) qualifies = true;
          break;
        }
        case 'order_count': {
          const { min_orders = 0 } = rule.trigger_value || {};
          const count = await pool.query(
            `SELECT COUNT(*) as cnt FROM orders WHERE user_id = $1 AND payment_status = 'PAID'`,
            [userId]
          );
          if (Number(count.rows[0].cnt) >= Number(min_orders)) qualifies = true;
          break;
        }
        case 'product_purchase': {
          const { product_ids = [] } = rule.trigger_value || {};
          const purchased = await pool.query(
            `SELECT DISTINCT pv.product_id FROM order_items oi
             JOIN product_variants pv ON oi.variant_id = pv.id
             JOIN orders o ON oi.order_id = o.id
             WHERE o.user_id = $1 AND o.payment_status = 'PAID' AND o.id != $2
             AND pv.product_id = ANY($3::int[])`,
            [userId, orderId, product_ids]
          );
          if (purchased.rows.length > 0) qualifies = true;
          break;
        }
        case 'category_purchase': {
          const { category_ids = [] } = rule.trigger_value || {};
          const purchased = await pool.query(
            `SELECT DISTINCT p.category_id FROM order_items oi
             JOIN product_variants pv ON oi.variant_id = pv.id
             JOIN products p ON pv.product_id = p.id
             JOIN orders o ON oi.order_id = o.id
             WHERE o.user_id = $1 AND o.payment_status = 'PAID' AND o.id != $2
             AND p.category_id = ANY($3::int[])`,
            [userId, orderId, category_ids]
          );
          if (purchased.rows.length > 0) qualifies = true;
          break;
        }
      }

      if (qualifies) {
        const code = generateDiscountCode();
        const expiresAt = rule.expires_at || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        await pool.query(
          `INSERT INTO user_discounts (user_id, discount_rule_id, code, discount_type, discount_value, min_order_amount, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (code) DO NOTHING`,
          [userId, rule.id, code, rule.reward_type, rule.reward_value, rule.min_order_amount, expiresAt]
        );
      }
    }
  } catch (error) {
    console.error('Check and assign discount rules error:', error);
  }
};
