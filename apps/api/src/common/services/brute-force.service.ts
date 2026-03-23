import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

const BRUTE_FORCE_PREFIX = 'clarixbi:brute_force:';
const BLOCK_PREFIX = 'clarixbi:brute_force_block:';
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const BLOCK_DURATION_SECONDS = 60 * 60; // 1 hour

@Injectable()
export class BruteForceService {
  private readonly logger = new Logger(BruteForceService.name);
  private readonly redis: Redis;

  constructor() {
    const redisUrl = process.env['REDIS_URL']!;
    this.redis = new Redis(redisUrl, {
      retryStrategy(times) {
        return Math.min(times * 100, 3000);
      },
    });
  }

  /**
   * Record a failed login attempt for an IP.
   * If max attempts reached, block the IP for 1 hour.
   */
  async recordFailedAttempt(ip: string): Promise<void> {
    const key = `${BRUTE_FORCE_PREFIX}${ip}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, ATTEMPT_WINDOW_SECONDS);
    }

    if (count >= MAX_ATTEMPTS) {
      const blockKey = `${BLOCK_PREFIX}${ip}`;
      await this.redis.set(blockKey, '1', 'EX', BLOCK_DURATION_SECONDS);
      this.logger.warn(`IP ${ip} blocked due to ${count} failed login attempts`);
    }
  }

  /**
   * Check if an IP is currently blocked.
   */
  async isBlocked(ip: string): Promise<boolean> {
    const blockKey = `${BLOCK_PREFIX}${ip}`;
    const blocked = await this.redis.exists(blockKey);
    return blocked === 1;
  }

  /**
   * Reset failed attempt counters for an IP (called on successful login).
   */
  async resetAttempts(ip: string): Promise<void> {
    const key = `${BRUTE_FORCE_PREFIX}${ip}`;
    const blockKey = `${BLOCK_PREFIX}${ip}`;
    await this.redis.del(key, blockKey);
  }
}
