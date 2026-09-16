import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '60', 10);

const client = createClient({
    url: redisUrl
});

client.on('error', (err) => console.log('Redis Client Error', err));

export const connectRedis = async () => {
    try {
        await client.connect();
        console.log('Connected to Redis at', redisUrl);
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
    }
};

export const cacheGet = async (req, res, next) => {
    // Generate a cache key from the request URL
    const key = `cache:${req.originalUrl}`;
    
    try {
        if (!client.isReady) {
            return next();
        }
        
        const cachedData = await client.get(key);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }
        
        // Intercept res.json to cache the response
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // Save to cache with TTL
                client.set(key, JSON.stringify(body), { EX: CACHE_TTL }).catch(err => {
                    console.error('Redis SET error:', err);
                });
            }
            originalJson(body);
        };
        
        next();
    } catch (err) {
        console.error('Redis GET error:', err);
        next();
    }
};

export const invalidateCache = async (tableName) => {
    if (!client.isReady) {
        return;
    }
    
    try {
        const keysPattern = `cache:/api/${tableName}*`;
        const keys = await client.keys(keysPattern);
        
        if (keys.length > 0) {
            await client.del(keys);
            console.log(`Invalidated ${keys.length} cache keys for table: ${tableName}`);
        }
    } catch (err) {
        console.error('Redis INVALIDATE error:', err);
    }
};
