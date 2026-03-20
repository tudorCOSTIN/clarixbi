import { Throttle, SkipThrottle } from '@nestjs/throttler';

/**
 * Rate limit for auth endpoints: 10 requests per 60 seconds
 */
export const AuthThrottle = () => Throttle({ default: { limit: 10, ttl: 60000 } });

/**
 * Rate limit for sync endpoints: 10 requests per 60 seconds
 */
export const SyncThrottle = () => Throttle({ default: { limit: 10, ttl: 60000 } });

/**
 * Rate limit for demo endpoints: 3 requests per hour
 */
export const DemoThrottle = () => Throttle({ default: { limit: 3, ttl: 3600000 } });

export { SkipThrottle };
