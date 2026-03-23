import Redis from 'ioredis';

const redisUrl = process.env['REDIS_URL']!;

/**
 * Redis instance for caching (TTL default: 5 minutes)
 */
export const cacheRedis = new Redis(redisUrl, {
  keyPrefix: 'clarixbi:cache:',
  retryStrategy(times) {
    return Math.min(times * 100, 3000);
  },
});

/**
 * Redis instance for BullMQ (requires maxRetriesPerRequest: null)
 */
export const bullRedis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 100, 3000);
  },
});

export const CACHE_TTL_DEFAULT = 300; // 5 minutes in seconds
