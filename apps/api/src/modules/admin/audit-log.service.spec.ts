import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditLogService', () => {
  let service: AuditLogService;
  const mockAuditLogRepo = {
    create: jest.fn((data) => ({ id: 'log-1', created_at: new Date(), ...data })),
    save: jest.fn((data) => Promise.resolve(data)),
    findAndCount: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepo },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    jest.clearAllMocks();
  });

  // ===== log =====

  describe('log', () => {
    it('should create an audit log record (fire-and-forget)', () => {
      service.log({
        userId: 'user-1',
        orgId: 'org-1',
        action: 'login',
        entityType: 'user',
        entityId: 'user-1',
        details: { method: 'password' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(mockAuditLogRepo.create).toHaveBeenCalledWith({
        user_id: 'user-1',
        org_id: 'org-1',
        action: 'login',
        entity_type: 'user',
        entity_id: 'user-1',
        details: { method: 'password' },
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
      });
      expect(mockAuditLogRepo.save).toHaveBeenCalled();
    });

    it('should handle null/undefined optional fields with null defaults', () => {
      service.log({ action: 'system_startup' });

      expect(mockAuditLogRepo.create).toHaveBeenCalledWith({
        user_id: null,
        org_id: null,
        action: 'system_startup',
        entity_type: null,
        entity_id: null,
        details: null,
        ip_address: null,
        user_agent: null,
      });
    });

    it('should swallow errors from save (fire-and-forget)', async () => {
      mockAuditLogRepo.save.mockRejectedValueOnce(new Error('DB write failed'));

      // Should not throw
      expect(() => {
        service.log({ action: 'test_action' });
      }).not.toThrow();

      // Wait for the promise to settle
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it('should be a synchronous (void) method', () => {
      const result = service.log({ action: 'test' });
      expect(result).toBeUndefined();
    });
  });

  // ===== findByUser =====

  describe('findByUser', () => {
    it('should return paginated results for a user', async () => {
      const logs = [
        { id: 'log-1', action: 'login', user_id: 'user-1' },
        { id: 'log-2', action: 'view_dashboard', user_id: 'user-1' },
      ];
      mockAuditLogRepo.findAndCount.mockResolvedValue([logs, 2]);

      const result = await service.findByUser('user-1', 1, 50);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(mockAuditLogRepo.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 'user-1' },
        order: { created_at: 'DESC' },
        skip: 0,
        take: 50,
      });
    });

    it('should return empty results when user has no logs', async () => {
      mockAuditLogRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByUser('user-no-logs');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });

    it('should handle page 2 with custom limit', async () => {
      mockAuditLogRepo.findAndCount.mockResolvedValue([[], 100]);

      const result = await service.findByUser('user-1', 3, 25);

      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
      expect(mockAuditLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 50, take: 25 }),
      );
    });

    it('should use default pagination (page=1, limit=50)', async () => {
      mockAuditLogRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByUser('user-1');

      expect(mockAuditLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });
  });

  // ===== cleanupOld =====

  describe('cleanupOld', () => {
    it('should delete records older than 2 years and return count', async () => {
      mockAuditLogRepo.delete.mockResolvedValue({ affected: 150 });

      const deleted = await service.cleanupOld();

      expect(deleted).toBe(150);
      expect(mockAuditLogRepo.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          created_at: expect.anything(),
        }),
      );
    });

    it('should return 0 when no old records exist', async () => {
      mockAuditLogRepo.delete.mockResolvedValue({ affected: 0 });

      const deleted = await service.cleanupOld();

      expect(deleted).toBe(0);
    });

    it('should handle null affected count gracefully', async () => {
      mockAuditLogRepo.delete.mockResolvedValue({ affected: null });

      const deleted = await service.cleanupOld();

      expect(deleted).toBe(0);
    });

    it('should use correct cutoff date (2 years ago)', async () => {
      mockAuditLogRepo.delete.mockResolvedValue({ affected: 0 });

      await service.cleanupOld();

      const deleteCall = mockAuditLogRepo.delete.mock.calls[0][0];
      // The LessThan value should be approximately 2 years ago
      const cutoff = deleteCall.created_at._value;
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      // Allow 5 seconds tolerance
      expect(Math.abs(cutoff.getTime() - twoYearsAgo.getTime())).toBeLessThan(5000);
    });
  });
});
