import client from '../config/redis.js';

export const CACHE_NOT_FOUND = { __notFound: true };

export const getCache = async (key) => {
    try {
        const data = await client.get(key);
        if (data === null) return null;
        const parsed = JSON.parse(data);
        if (parsed?.__notFound === true) return null;
        return parsed;
    } catch (err) {
        return null;
    }
};

export const getCacheEntry = async (key) => {
    try {
        const data = await client.get(key);
        if (data === null) return { hit: false, notFound: false, value: null };
        const parsed = JSON.parse(data);
        if (parsed?.__notFound === true) return { hit: true, notFound: true, value: null };
        return { hit: true, notFound: false, value: parsed };
    } catch (err) {
        return { hit: false, notFound: false, value: null };
    }
};

export const getCacheVersion = async (key, defaultVal = 1) => {
    try {
        const data = await client.get(key);
        if (data === null) return defaultVal;
        const num = Number(data);
        return Number.isNaN(num) ? defaultVal : num;
    } catch (err) {
        return defaultVal;
    }
};

export const setCache = async (key, value, ttl = 300) => {
    try {
        return await client.setEx(key, ttl, JSON.stringify(value));
    } catch (err) {
        return null;
    }
};

export const setNotFoundCache = async (key, ttl = 60) => {
    return setCache(key, CACHE_NOT_FOUND, ttl);
};

export const deleteCache = async (key) => {
    try {
        return await client.del(key);
    } catch (err) {
        return 0;
    }
};

export const incrCache = async (key) => {
    try {
        return await client.incr(key);
    } catch (err) {
        return null;
    }
};

/** Xoá toàn bộ cache liên quan đến sản phẩm + variants */
export const invalidateProductRelatedCaches = async (productId, variantIds = []) => {
    const keys = [
        `v2:product:${productId}`,
        `v2:variants:product:${productId}`,
        `v2:product:images:${productId}`,
        ...variantIds.map((vid) => `v2:variant:${vid}`),
    ];

    await Promise.all(keys.map((key) => deleteCache(key)));
    await incrCache('products:version');
};
