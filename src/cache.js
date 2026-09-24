import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '60', 10);

const client = createClient({
    url: redisUrl
});

client.on('error', (err) => console.log('Redis Client Error', err));

/**
 * Initializes and connects the Redis client.
 * 
 * @returns {Promise<void>}
 */
export const connectRedis = async () => {
    try {
        await client.connect();
        console.log('Connected to Redis at', redisUrl);
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
    }
};

/**
 * Express middleware to get or set cache for API responses.
 * Caches the response body for `CACHE_TTL` seconds.
 * 
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @param {Function} next - The next middleware function.
 */
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

/**
 * Invalidates (deletes) all cache keys matching a specific table name prefix.
 * 
 * @param {string} tableName - The name of the table to invalidate.
 * @returns {Promise<void>}
 */
export const invalidateCache = async (tableName) => {
    if (!client.isReady) {
        return;
    }
    
    try {
        const keysPattern = `cache:/api/${tableName}*`;
        let deletedCount = 0;
        
        for await (const key of client.scanIterator({ MATCH: keysPattern, COUNT: 100 })) {
            await client.del(key);
            deletedCount++;
        }
        
        if (deletedCount > 0) {
            console.log(`Invalidated ${deletedCount} cache keys for table: ${tableName}`);
        }
    } catch (err) {
        console.error('Redis INVALIDATE error:', err);
    }
};
