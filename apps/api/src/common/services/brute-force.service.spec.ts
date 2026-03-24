const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
  set: jest.fn(),
  exists: jest.fn(),
  del: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

process.env['REDIS_URL'] = 'redis://localhost:6379';

import { BruteForceService } from './brute-force.service';

describe('BruteForceService', () => {
  let service: BruteForceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BruteForceService();
  });

  describe('recordFailedAttempt', () => {
    it('should set expire on first attempt', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await service.recordFailedAttempt('192.168.1.1');

      expect(mockRedis.incr).toHaveBeenCalledWith('clarixbi:brute_force:192.168.1.1');
      expect(mockRedis.expire).toHaveBeenCalledWith('clarixbi:brute_force:192.168.1.1', 15 * 60);
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should not set expire on subsequent attempts', async () => {
      mockRedis.incr.mockResolvedValue(5);

      await service.recordFailedAttempt('192.168.1.1');

      expect(mockRedis.incr).toHaveBeenCalledWith('clarixbi:brute_force:192.168.1.1');
      expect(mockRedis.expire).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should block IP on 10th failed attempt', async () => {
      mockRedis.incr.mockResolvedValue(10);
      mockRedis.set.mockResolvedValue('OK');

      await service.recordFailedAttempt('10.0.0.1');

      expect(mockRedis.incr).toHaveBeenCalledWith('clarixbi:brute_force:10.0.0.1');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'clarixbi:brute_force_block:10.0.0.1',
        '1',
        'EX',
        60 * 60,
      );
    });
  });

  describe('isBlocked', () => {
    it('should return true when IP is blocked', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.isBlocked('192.168.1.1');

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('clarixbi:brute_force_block:192.168.1.1');
    });

    it('should return false when IP is not blocked', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await service.isBlocked('192.168.1.1');

      expect(result).toBe(false);
      expect(mockRedis.exists).toHaveBeenCalledWith('clarixbi:brute_force_block:192.168.1.1');
    });
  });

  describe('resetAttempts', () => {
    it('should delete both attempt and block keys', async () => {
      mockRedis.del.mockResolvedValue(2);

      await service.resetAttempts('192.168.1.1');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'clarixbi:brute_force:192.168.1.1',
        'clarixbi:brute_force_block:192.168.1.1',
      );
    });
  });
});
