import { createClient } from 'redis';

const client = createClient({
    ...(process.env.REDIS_USERNAME && { username: process.env.REDIS_USERNAME }),
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    }
});

client.on('error', (err) => console.log('Redis Client Error', err));

let isConnected = false;

try {
    await client.connect();
    isConnected = true;
    console.log('Redis connected');
} catch (err) {
    console.log('Redis connection failed (non-critical):', err.message);
}

export { client as default, isConnected };