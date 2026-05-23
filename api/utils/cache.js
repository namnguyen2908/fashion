import client from '../config/redis.js';

/** Sentinel lưu trong Redis để đánh dấu “không tồn tại” (negative cache) */
export const CACHE_NOT_FOUND = { __notFound: true };

// =========================
// GET CACHE (đơn giản — hit có value)
// =========================
export const getCache = async (key) => {
    try {
        const data = await client.get(key);
        if (data === null) return null;

        const parsed = JSON.parse(data);
        if (parsed?.__notFound === true) return null;

        return parsed;
    } catch (err) {
        console.error('Cache GET error:', err);
        return null;
    }
};

// =========================
// GET CACHE ENTRY — phân biệt miss / hit / not_found
// =========================
export const getCacheEntry = async (key) => {
    try {
        const data = await client.get(key);
        if (data === null) {
            return { hit: false, notFound: false, value: null };
        }

        const parsed = JSON.parse(data);

        if (parsed?.__notFound === true) {
            return { hit: true, notFound: true, value: null };
        }

        return { hit: true, notFound: false, value: parsed };
    } catch (err) {
        console.error('Cache GET entry error:', err);
        return { hit: false, notFound: false, value: null };
    }
};

// =========================
// VERSION KEY (INCR — giá trị string số, không phải JSON object)
// =========================
export const getCacheVersion = async (key, defaultVal = 1) => {
    try {
        const data = await client.get(key);
        if (data === null) return defaultVal;

        const num = Number(data);
        return Number.isNaN(num) ? defaultVal : num;
    } catch (err) {
        console.error('Cache VERSION GET error:', err);
        return defaultVal;
    }
};

// =========================
// SET CACHE
// =========================
export const setCache = async (key, value, ttl = 300) => {
    try {
        return await client.setEx(
            key,
            ttl,
            JSON.stringify(value)
        );
    } catch (err) {
        console.error('Cache SET error:', err);
        return null;
    }
};

// =========================
// NEGATIVE CACHE — sản phẩm / bản ghi không tồn tại
// =========================
export const setNotFoundCache = async (key, ttl = 60) => {
    return setCache(key, CACHE_NOT_FOUND, ttl);
};

// =========================
// DELETE CACHE
// =========================
export const deleteCache = async (key) => {
    try {
        return await client.del(key);
    } catch (err) {
        console.error('Cache DELETE error:', err);
        return 0;
    }
};

// =========================
// INCREMENT CACHE VERSION
// =========================
export const incrCache = async (key) => {
    try {
        return await client.incr(key);
    } catch (err) {
        console.error('Cache INCR error:', err);
        return null;
    }
};

// =========================
// XÓA TOÀN BỘ CACHE LIÊN QUAN MỘT PRODUCT
// =========================
export const invalidateProductRelatedCaches = async (productId, variantIds = []) => {
    const keys = [
        `product:${productId}`,
        `variants:product:${productId}`,
        `product:images:${productId}`,
        ...variantIds.map((vid) => `variant:${vid}`),
    ];

    await Promise.all(keys.map((key) => deleteCache(key)));
};
