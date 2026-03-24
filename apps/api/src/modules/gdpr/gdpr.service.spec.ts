jest.mock('../sync/queues.config', () => ({
  gdprHardDeleteQueue: { add: jest.fn() },
  gdprExportQueue: { add: jest.fn() },
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(false),
  };
});

jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    execSync: jest.fn(),
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource as TypeOrmDataSource } from 'typeorm';
import { GdprService } from './gdpr.service';
import { GdprRequest, GdprRequestType, GdprRequestStatus } from './entities/gdpr-request.entity';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { AuditLog } from '../admin/entities/audit-log.entity';
import { Subscription } from '../billing/entities/subscription.entity';
import { DataSource } from '../data-sources/entities/data-source.entity';
import { Dashboard } from '../dashboards/entities/dashboard.entity';
import { DashboardShare } from '../dashboards/entities/dashboard-share.entity';
import { Widget } from '../widgets/entities/widget.entity';
import { AIConversation } from '../ai/entities/ai-conversation.entity';
import { AIMessage } from '../ai/entities/ai-message.entity';
import { Report } from '../reports/entities/report.entity';
import { ReportSchedule } from '../reports/entities/report-schedule.entity';
import { Alert } from '../alerts/entities/alert.entity';
import { AlertTrigger } from '../alerts/entities/alert-trigger.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { SyncJob } from '../sync/entities/sync-job.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { gdprHardDeleteQueue, gdprExportQueue } from '../sync/queues.config';

const createMockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'mock-id', ...entity })),
  count: jest.fn().mockResolvedValue(0),
  update: jest.fn().mockResolvedValue(undefined),
  createQueryBuilder: jest.fn().mockReturnValue({
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  }),
});

describe('GdprService', () => {
  let service: GdprService;

  const mockUserRepo = createMockRepo();
  const mockOrgRepo = createMockRepo();
  const mockTeamMemberRepo = createMockRepo();
  const mockGdprRequestRepo = createMockRepo();
  const mockAuditLogRepo = createMockRepo();
  const mockSubscriptionRepo = createMockRepo();
  const mockDataSourceRepo = createMockRepo();
  const mockDashboardRepo = createMockRepo();
  const mockDashboardShareRepo = createMockRepo();
  const mockWidgetRepo = createMockRepo();
  const mockAiConversationRepo = createMockRepo();
  const mockAiMessageRepo = createMockRepo();
  const mockReportRepo = createMockRepo();
  const mockReportScheduleRepo = createMockRepo();
  const mockAlertRepo = createMockRepo();
  const mockAlertTriggerRepo = createMockRepo();
  const mockNotificationRepo = createMockRepo();
  const mockSyncJobRepo = createMockRepo();

  const mockClickHouseService = {
    query: jest.fn().mockResolvedValue([]),
  };

  const mockManager = {
    find: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn().mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    }),
  };

  const mockDataSourceTypeOrm = {
    transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Organization), useValue: mockOrgRepo },
        { provide: getRepositoryToken(TeamMember), useValue: mockTeamMemberRepo },
        { provide: getRepositoryToken(GdprRequest), useValue: mockGdprRequestRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepo },
        { provide: getRepositoryToken(Subscription), useValue: mockSubscriptionRepo },
        { provide: getRepositoryToken(DataSource), useValue: mockDataSourceRepo },
        { provide: getRepositoryToken(Dashboard), useValue: mockDashboardRepo },
        { provide: getRepositoryToken(DashboardShare), useValue: mockDashboardShareRepo },
        { provide: getRepositoryToken(Widget), useValue: mockWidgetRepo },
        { provide: getRepositoryToken(AIConversation), useValue: mockAiConversationRepo },
        { provide: getRepositoryToken(AIMessage), useValue: mockAiMessageRepo },
        { provide: getRepositoryToken(Report), useValue: mockReportRepo },
        { provide: getRepositoryToken(ReportSchedule), useValue: mockReportScheduleRepo },
        { provide: getRepositoryToken(Alert), useValue: mockAlertRepo },
        { provide: getRepositoryToken(AlertTrigger), useValue: mockAlertTriggerRepo },
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepo },
        { provide: getRepositoryToken(SyncJob), useValue: mockSyncJobRepo },
        { provide: ClickHouseService, useValue: mockClickHouseService },
        { provide: TypeOrmDataSource, useValue: mockDataSourceTypeOrm },
      ],
    }).compile();

    service = module.get<GdprService>(GdprService);
    jest.clearAllMocks();
  });

  describe('requestDeletion', () => {
    const userId = 'user-123';

    it('should create a deletion request and queue hard-delete job', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue(null);
      mockGdprRequestRepo.create.mockReturnValue({
        user_id: userId,
        type: GdprRequestType.DELETION,
        status: GdprRequestStatus.PENDING,
      });
      mockGdprRequestRepo.save.mockResolvedValue({
        id: 'req-1',
        user_id: userId,
        type: GdprRequestType.DELETION,
        status: GdprRequestStatus.PENDING,
        scheduled_at: expect.any(Date),
      });
      mockTeamMemberRepo.find.mockResolvedValue([]);
      mockAuditLogRepo.create.mockReturnValue({});
      mockAuditLogRepo.save.mockResolvedValue({});

      const result = await service.requestDeletion(userId);

      expect(result.id).toBe('req-1');
      expect(result.status).toBe(GdprRequestStatus.PENDING);
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ is_active: false }),
      );
      expect(gdprHardDeleteQueue.add).toHaveBeenCalledWith(
        'hard-delete',
        { userId, requestId: 'req-1' },
        expect.objectContaining({ jobId: 'gdpr-delete-req-1' }),
      );
    });

    it('should throw BadRequestException if pending request exists', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue({
        id: 'existing-req',
        status: GdprRequestStatus.PENDING,
      });

      await expect(service.requestDeletion(userId)).rejects.toThrow(BadRequestException);
      expect(mockGdprRequestRepo.save).not.toHaveBeenCalled();
    });

    it('should deactivate subscriptions for owned orgs', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue(null);
      mockGdprRequestRepo.create.mockReturnValue({});
      mockGdprRequestRepo.save.mockResolvedValue({ id: 'req-2' });
      mockTeamMemberRepo.find.mockResolvedValue([
        { user_id: userId, org_id: 'org-1', role: 'owner' },
        { user_id: userId, org_id: 'org-2', role: 'owner' },
      ]);
      mockAuditLogRepo.create.mockReturnValue({});
      mockAuditLogRepo.save.mockResolvedValue({});

      await service.requestDeletion(userId);

      expect(mockSubscriptionRepo.update).toHaveBeenCalledTimes(2);
      expect(mockSubscriptionRepo.update).toHaveBeenCalledWith(
        { org_id: 'org-1' },
        expect.objectContaining({ status: 'canceled' }),
      );
    });
  });

  describe('executeHardDelete', () => {
    const userId = 'user-456';
    const requestId = 'req-456';

    it('should delete ClickHouse data and run PostgreSQL transaction', async () => {
      mockTeamMemberRepo.find.mockResolvedValue([
        { user_id: userId, org_id: 'org-sole', role: 'owner' },
      ]);
      mockTeamMemberRepo.count.mockResolvedValue(1);
      mockAuditLogRepo.create.mockReturnValue({});
      mockAuditLogRepo.save.mockResolvedValue({});

      await service.executeHardDelete(userId, requestId);

      // Should query ClickHouse for each table (7 tables)
      expect(mockClickHouseService.query).toHaveBeenCalledTimes(7);
      // Should run transaction
      expect(mockDataSourceTypeOrm.transaction).toHaveBeenCalledTimes(1);
      // Should create audit log
      expect(mockAuditLogRepo.save).toHaveBeenCalled();
    });

    it('should skip ClickHouse deletion when no sole-owner orgs', async () => {
      mockTeamMemberRepo.find.mockResolvedValue([]);
      mockAuditLogRepo.create.mockReturnValue({});
      mockAuditLogRepo.save.mockResolvedValue({});

      await service.executeHardDelete(userId, requestId);

      expect(mockClickHouseService.query).not.toHaveBeenCalled();
      expect(mockDataSourceTypeOrm.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('requestExport', () => {
    const userId = 'user-789';

    it('should create export request and queue export job', async () => {
      mockGdprRequestRepo.create.mockReturnValue({
        user_id: userId,
        type: GdprRequestType.EXPORT,
        status: GdprRequestStatus.PROCESSING,
      });
      mockGdprRequestRepo.save.mockResolvedValue({
        id: 'exp-1',
        user_id: userId,
        type: GdprRequestType.EXPORT,
        status: GdprRequestStatus.PROCESSING,
      });
      mockAuditLogRepo.create.mockReturnValue({});
      mockAuditLogRepo.save.mockResolvedValue({});

      const result = await service.requestExport(userId);

      expect(result.id).toBe('exp-1');
      expect(result.status).toBe(GdprRequestStatus.PROCESSING);
      expect(gdprExportQueue.add).toHaveBeenCalledWith(
        'export',
        { userId, requestId: 'exp-1' },
        { jobId: 'gdpr-export-exp-1' },
      );
      expect(mockAuditLogRepo.save).toHaveBeenCalled();
    });
  });

  describe('generateExport', () => {
    const userId = 'user-gen';
    const requestId = 'req-gen';

    it('should collect data from all repos and write JSON files', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { writeFileSync, mkdirSync } = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { execSync } = require('child_process');

      mockUserRepo.findOne.mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        name: 'Test',
      });
      mockTeamMemberRepo.find.mockResolvedValue([]);
      mockAiConversationRepo.find.mockResolvedValue([]);
      mockNotificationRepo.find.mockResolvedValue([]);
      mockAuditLogRepo.find.mockResolvedValue([]);

      await service.generateExport(userId, requestId);

      expect(mkdirSync).toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalled();
      expect(execSync).toHaveBeenCalled();
      expect(mockGdprRequestRepo.update).toHaveBeenCalledWith(
        requestId,
        expect.objectContaining({
          status: GdprRequestStatus.COMPLETED,
        }),
      );
    });
  });

  describe('getExportStatus', () => {
    const userId = 'user-status';
    const requestId = 'req-status';

    it('should return the export request', async () => {
      const request = {
        id: requestId,
        user_id: userId,
        type: GdprRequestType.EXPORT,
        status: GdprRequestStatus.PROCESSING,
        download_expires_at: null,
      };
      mockGdprRequestRepo.findOne.mockResolvedValue(request);

      const result = await service.getExportStatus(userId, requestId);

      expect(result.id).toBe(requestId);
      expect(result.status).toBe(GdprRequestStatus.PROCESSING);
    });

    it('should throw NotFoundException when request not found', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue(null);

      await expect(service.getExportStatus(userId, requestId)).rejects.toThrow(NotFoundException);
    });

    it('should mark as expired if download_expires_at has passed', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const request = {
        id: requestId,
        user_id: userId,
        type: GdprRequestType.EXPORT,
        status: GdprRequestStatus.COMPLETED,
        download_expires_at: pastDate,
      };
      mockGdprRequestRepo.findOne.mockResolvedValue(request);

      const result = await service.getExportStatus(userId, requestId);

      expect(result.status).toBe(GdprRequestStatus.EXPIRED);
      expect(mockGdprRequestRepo.update).toHaveBeenCalledWith(requestId, {
        status: GdprRequestStatus.EXPIRED,
      });
    });
  });

  describe('getExportDownload', () => {
    const userId = 'user-dl';
    const requestId = 'req-dl';

    it('should return download_url when export is completed', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      mockGdprRequestRepo.findOne.mockResolvedValue({
        id: requestId,
        user_id: userId,
        type: GdprRequestType.EXPORT,
        status: GdprRequestStatus.COMPLETED,
        download_url: '/path/to/export.zip',
        download_expires_at: futureDate,
      });

      const result = await service.getExportDownload(userId, requestId);

      expect(result).toBe('/path/to/export.zip');
    });

    it('should throw BadRequestException if export is not completed', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue({
        id: requestId,
        user_id: userId,
        type: GdprRequestType.EXPORT,
        status: GdprRequestStatus.PROCESSING,
        download_expires_at: null,
      });

      await expect(service.getExportDownload(userId, requestId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDeletionStatus', () => {
    const userId = 'user-del-status';

    it('should return the latest deletion request', async () => {
      const request = {
        id: 'del-1',
        user_id: userId,
        type: GdprRequestType.DELETION,
        status: GdprRequestStatus.PENDING,
      };
      mockGdprRequestRepo.findOne.mockResolvedValue(request);

      const result = await service.getDeletionStatus(userId);

      expect(result).toEqual(request);
      expect(mockGdprRequestRepo.findOne).toHaveBeenCalledWith({
        where: { user_id: userId, type: GdprRequestType.DELETION },
        order: { created_at: 'DESC' },
      });
    });

    it('should return null when no deletion request exists', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue(null);

      const result = await service.getDeletionStatus(userId);

      expect(result).toBeNull();
    });
  });
});
