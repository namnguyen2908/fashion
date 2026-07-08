import pool from '../config/db.js';
import client from '../config/redis.js';
import crypto from 'crypto';

const CACHE_TTL = 900; // 15 phút

// =========================================
// HÀM BỔ TRỢ: XÓA ĐỒNG BỘ CACHE
// Tránh lỗi dữ liệu cũ đè lên dữ liệu mới (Race Condition)
// =========================================
const invalidateCache = async (productId, variantId) => {
    // Xóa cache chi tiết và cache danh sách
    // Để Client tự động nạp lại khi có request (Lazy Loading) giúp hệ thống chạy mượt và chính xác 100%
    await Promise.all([
        client.del(`variant:${variantId}`),
        client.del(`variants:product:${productId}`)
    ]);
};

// =========================================
// CLIENT: LẤY DANH SÁCH BIẾN THỂ HOẠT ĐỘNG
// =========================================
export const getVariantsByProductId = async (req, res) => {
    try {
        const { productId } = req.params;
        const cacheKey = `variants:product:${productId}`;

        const cachedVariants = await client.get(cacheKey);
        if (cachedVariants) {
            return res.status(200).json({
                success: true,
                source: 'redis',
                data: JSON.parse(cachedVariants)
            });
        }

        const result = await pool.query(
            `
            SELECT id, product_id, color, size, sku, price, compare_price, is_active, created_at, updated_at
            FROM product_variants
            WHERE product_id = $1 AND is_active = true
            ORDER BY created_at DESC
            `,
            [productId]
        );

        await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(result.rows));

        return res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// CLIENT: LẤY CHI TIẾT BIẾN THỂ HOẠT ĐỘNG
// =========================================
export const getVariantById = async (req, res) => {
    try {
        const { id } = req.params;
        const cacheKey = `variant:${id}`;

        const cachedVariant = await client.get(cacheKey);
        if (cachedVariant === 'null') {
            return res.status(404).json({ success: false, message: 'Variant not found' });
        }
        if (cachedVariant) {
            return res.status(200).json({
                success: true,
                source: 'redis',
                data: JSON.parse(cachedVariant)
            });
        }

        const result = await pool.query(
            `
            SELECT pv.id, pv.product_id, pv.color, pv.size, pv.sku, pv.price, pv.compare_price, pv.is_active, pv.created_at, pv.updated_at,
                   p.name AS product_name
            FROM product_variants pv
            LEFT JOIN products p ON pv.product_id = p.id
            WHERE pv.id = $1 AND pv.is_active = true
            `,
            [id]
        );

        if (result.rows.length === 0) {
            // Chống Cache Penetration (Tấn công quét ID trống)
            await client.setEx(cacheKey, 60, 'null');
            return res.status(404).json({ success: false, message: 'Variant not found' });
        }

        const variant = result.rows[0];
        await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(variant));

        return res.status(200).json({ success: true, data: variant });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// ADMIN: LẤY CHI TIẾT BIẾN THỂ (GỒM CẢ BIẾN THỂ ẨN)
// =========================================
export const adminGetVariantById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT pv.id, pv.product_id, pv.color, pv.size, pv.sku, pv.price, pv.compare_price, pv.is_active, pv.created_at, pv.updated_at,
                   p.name AS product_name
            FROM product_variants pv
            LEFT JOIN products p ON pv.product_id = p.id
            WHERE pv.id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Variant not found' });
        }

        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// ADMIN: TẠO BIẾN THỂ MỚI
// =========================================
export const createVariant = async (req, res) => {
    try {
        const {
            product_id,
            color = '',
            size = '',
            price,
            compare_price = null,
            is_active = true
        } = req.body;

        if (!product_id || price === undefined) {
            return res.status(400).json({ success: false, message: 'Product and Price are required' });
        }
        if (Number(price) <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid price' });
        }

        // TỐI ƯU HIỆU NĂNG: Loại bỏ SELECT check trùng bằng code. Tận dụng tối đa Partial Unique Index từ DB.
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        const cleanColor = color.replace(/\s+/g, '-').toUpperCase();
        const cleanSize = size.replace(/\s+/g, '-').toUpperCase();
        const sku = `SKU-${product_id}-${cleanColor}-${cleanSize}-${random}`;

        const result = await pool.query(
            `
            INSERT INTO product_variants(product_id, color, size, sku, price, compare_price, is_active)
            VALUES($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, product_id, color, size, sku, price, compare_price, is_active, created_at, updated_at
            `,
            [product_id, color, size, sku, price, compare_price, is_active]
        );

        // Làm sạch Cache danh sách để Client cập nhật sản phẩm mới
        await client.del(`variants:product:${product_id}`);

        return res.status(201).json({
            success: true,
            message: 'Variant created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        if (error.code === '23503') return res.status(404).json({ success: false, message: 'Product not found' });
        if (error.code === '23505') return res.status(409).json({ success: false, message: 'Variant color/size already exists or SKU duplicate' });
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// ADMIN: CẬP NHẬT BIẾN THỂ (DYNAMIC UPDATE)
// =========================================
export const updateVariant = async (req, res) => {
    try {
        const { id } = req.params;
        const { color, size, price, compare_price, is_active } = req.body;

        if (color === undefined && size === undefined && price === undefined && 
            compare_price === undefined && is_active === undefined) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        if (price !== undefined && Number(price) <= 0) {
            return res.status(400).json({ success: false, message: 'Price must be greater than 0' });
        }

        // Lấy thông tin gốc để biết sản phẩm cha phục vụ xóa cache
        const variant = await pool.query(
            `SELECT id, product_id FROM product_variants WHERE id = $1`,
            [id]
        );
        if (variant.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Variant not found' });
        }
        const currentVariant = variant.rows[0];

        // Xây dựng câu lệnh cập nhật động
        const fields = [];
        const values = [];

        if (color !== undefined) { values.push(color); fields.push(`color = $${values.length}`); }
        if (size !== undefined) { values.push(size); fields.push(`size = $${values.length}`); }
        if (price !== undefined) { values.push(price); fields.push(`price = $${values.length}`); }
        if (compare_price !== undefined) { values.push(compare_price); fields.push(`compare_price = $${values.length}`); }
        if (is_active !== undefined) { values.push(is_active); fields.push(`is_active = $${values.length}`); }

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const query = `
            UPDATE product_variants
            SET ${fields.join(', ')}
            WHERE id = $${values.length}
            RETURNING id, product_id, color, size, sku, price, compare_price, is_active, created_at, updated_at
        `;

        const result = await pool.query(query, values);

        // KHẮC PHỤC LỖI LOGIC: Xử lý Cache chi tiết triệt để nếu bản ghi bị ẩn đi
        if (is_active === false) {
            // Đóng băng bộ nhớ đệm chi tiết thành 'null' để Client không đọc trúng dữ liệu cũ lọt lưới
            await client.setEx(`variant:${id}`, 60, 'null');
            await client.del(`variants:product:${currentVariant.product_id}`);
        } else {
            // Nếu vẫn hoạt động bình thường hoặc được bật lại, xóa đồng bộ cả 2 loại cache
            await invalidateCache(currentVariant.product_id, id);
        }

        return res.status(200).json({
            success: true,
            message: 'Variant updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        if (error.code === '23505') return res.status(409).json({ success: false, message: 'Variant color/size already exists' });
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// =========================================
// ADMIN: XÓA MỀM BIẾN THỂ
// =========================================
export const deleteVariant = async (req, res) => {
    try {
        const { id } = req.params;

        const variant = await pool.query(
            `SELECT id, product_id FROM product_variants WHERE id = $1 AND is_active = true`,
            [id]
        );
        if (variant.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Variant not found' });
        }
        const currentVariant = variant.rows[0];

        // Thực hiện xóa mềm
        await pool.query(
            `UPDATE product_variants SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [id]
        );

        // KHẮC PHỤC LỖI LOGIC: Ép cache chi tiết thành 'null' ngay lập tức, chặn đứng Client truy cập dữ liệu cũ
        await client.setEx(`variant:${id}`, 60, 'null');
        await client.del(`variants:product:${currentVariant.product_id}`);

        return res.status(200).json({
            success: true,
            message: 'Variant deleted successfully'
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};