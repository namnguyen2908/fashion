import client from '../config/redis.js';

// =========================
// GET CACHE
// =========================
export const getCache = async (key) => {
    try {
        const data = await client.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error('Cache GET error:', err);
        return null;
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
    }
};

// =========================
// DELETE CACHE
// =========================
export const deleteCache = async (key) => {
    try {
        return await client.del(key);
    } catch (err) {
        console.error('Cache DELETE error:', err);
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
    }
};