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

// Set required env var before importing the service
process.env['REDIS_URL'] = 'redis://localhost:6379';

import { BruteForceService } from './brute-force.service';

describe('BruteForceService', () => {
  let service: BruteForceService;

  const TEST_IP = '192.168.1.100';
  const BRUTE_FORCE_KEY = `clarixbi:brute_force:${TEST_IP}`;
  const BLOCK_KEY = `clarixbi:brute_force_block:${TEST_IP}`;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BruteForceService();
  });

  it('recordFailedAttempt should call redis.incr with the correct key', async () => {
    mockRedis.incr.mockResolvedValue(1);

    await service.recordFailedAttempt(TEST_IP);

    expect(mockRedis.incr).toHaveBeenCalledWith(BRUTE_FORCE_KEY);
  });

  it('recordFailedAttempt on first attempt should set expire with TTL window', async () => {
    mockRedis.incr.mockResolvedValue(1);

    await service.recordFailedAttempt(TEST_IP);

    expect(mockRedis.expire).toHaveBeenCalledWith(BRUTE_FORCE_KEY, 15 * 60);
  });

  it('recordFailedAttempt at MAX_ATTEMPTS (10) should set the block key', async () => {
    mockRedis.incr.mockResolvedValue(10);

    await service.recordFailedAttempt(TEST_IP);

    expect(mockRedis.set).toHaveBeenCalledWith(BLOCK_KEY, '1', 'EX', 3600);
  });

  it('isBlocked should return true when block key exists', async () => {
    mockRedis.exists.mockResolvedValue(1);

    const result = await service.isBlocked(TEST_IP);

    expect(result).toBe(true);
    expect(mockRedis.exists).toHaveBeenCalledWith(BLOCK_KEY);
  });

  it('isBlocked should return false when block key does not exist', async () => {
    mockRedis.exists.mockResolvedValue(0);

    const result = await service.isBlocked(TEST_IP);

    expect(result).toBe(false);
    expect(mockRedis.exists).toHaveBeenCalledWith(BLOCK_KEY);
  });

  it('resetAttempts should call redis.del with both keys', async () => {
    mockRedis.del.mockResolvedValue(2);

    await service.resetAttempts(TEST_IP);

    expect(mockRedis.del).toHaveBeenCalledWith(BRUTE_FORCE_KEY, BLOCK_KEY);
  });

  it('recordFailedAttempt below MAX_ATTEMPTS should NOT set block key', async () => {
    mockRedis.incr.mockResolvedValue(5);

    await service.recordFailedAttempt(TEST_IP);

    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('block key should use correct TTL of 3600 seconds', async () => {
    mockRedis.incr.mockResolvedValue(10);

    await service.recordFailedAttempt(TEST_IP);

    expect(mockRedis.set).toHaveBeenCalledTimes(1);
    const setCall = mockRedis.set.mock.calls[0];
    expect(setCall[0]).toBe(BLOCK_KEY);
    expect(setCall[1]).toBe('1');
    expect(setCall[2]).toBe('EX');
    expect(setCall[3]).toBe(3600);
  });
});
