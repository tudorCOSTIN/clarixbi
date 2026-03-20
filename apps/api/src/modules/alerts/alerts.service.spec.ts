import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AlertsService } from './alerts.service';
import { Alert, ConditionOperator, CheckFrequency } from './entities/alert.entity';
import { AlertTrigger } from './entities/alert-trigger.entity';
import { Subscription } from '../billing/entities/subscription.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { SqlValidatorService } from '../ai/sql-validator.service';
import { HttpException } from '@nestjs/common';

describe('AlertsService', () => {
  let service: AlertsService;
  const mockAlertRepo = {
    create: jest.fn((data) => ({ id: 'alert-1', ...data })),
    save: jest.fn((data) => data),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
  };
  const mockTriggerRepo = {
    create: jest.fn((data) => ({ id: 'trigger-1', ...data })),
    save: jest.fn((data) => data),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };
  const mockSubscriptionRepo = {
    findOne: jest.fn(),
  };
  const mockNotificationRepo = {
    create: jest.fn((data) => ({ id: 'notif-1', ...data })),
    save: jest.fn((data) => data),
  };
  const mockTeamMemberRepo = {
    find: jest.fn(),
  };
  const mockClickhouse = {
    query: jest.fn(),
  };
  const mockGateway = {
    emitAlertTriggered: jest.fn(),
  };
  const mockSqlValidator = {
    validate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: getRepositoryToken(Alert), useValue: mockAlertRepo },
        { provide: getRepositoryToken(AlertTrigger), useValue: mockTriggerRepo },
        { provide: getRepositoryToken(Subscription), useValue: mockSubscriptionRepo },
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepo },
        { provide: getRepositoryToken(TeamMember), useValue: mockTeamMemberRepo },
        { provide: ClickHouseService, useValue: mockClickhouse },
        { provide: NotificationsGateway, useValue: mockGateway },
        { provide: SqlValidatorService, useValue: mockSqlValidator },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create alert when under limit', async () => {
      mockAlertRepo.count.mockResolvedValue(2); // 2 active, limit is 3
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'starter', limits: { max_alerts: 3 } },
      });
      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        sanitizedSql: "SELECT SUM(total) FROM invoices WHERE org_id = 'org-1'",
        errors: [],
      });

      const result = await service.create('org-1', 'user-1', {
        name: 'High Revenue',
        dataSourceId: 'ds-1',
        metricQuery: 'SELECT SUM(total) FROM invoices',
        conditionOperator: ConditionOperator.GT,
        thresholdValue: 10000,
        checkFrequency: CheckFrequency.HOURLY,
      });

      expect(result.name).toBe('High Revenue');
      expect(result.is_active).toBe(true);
    });

    it('should block 4th alert on Starter plan (402)', async () => {
      mockAlertRepo.count.mockResolvedValue(3); // Already at limit
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'starter', limits: { max_alerts: 3 } },
      });

      await expect(
        service.create('org-1', 'user-1', {
          name: 'Too Many',
          dataSourceId: 'ds-1',
          metricQuery: 'SELECT 1',
          conditionOperator: ConditionOperator.GT,
          thresholdValue: 100,
          checkFrequency: CheckFrequency.DAILY,
        }),
      ).rejects.toThrow(HttpException);
    });

    it('should allow unlimited alerts for Enterprise', async () => {
      mockAlertRepo.count.mockResolvedValue(50);
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'enterprise', limits: { max_alerts: -1 } },
      });
      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        sanitizedSql: 'SELECT 1',
        errors: [],
      });

      const result = await service.create('org-1', 'user-1', {
        name: 'Another Alert',
        dataSourceId: 'ds-1',
        metricQuery: 'SELECT 1',
        conditionOperator: ConditionOperator.GT,
        thresholdValue: 100,
        checkFrequency: CheckFrequency.DAILY,
      });

      expect(result.name).toBe('Another Alert');
    });
  });

  describe('test (dry-run)', () => {
    it('should return wouldTrigger=true when value > threshold', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        org_id: 'org-1',
        metric_query: "SELECT SUM(total) FROM invoices WHERE org_id = 'org-1'",
        condition_operator: ConditionOperator.GT,
        threshold_value: 10000,
      });
      mockClickhouse.query.mockResolvedValue([{ sum: 12500 }]);

      const result = await service.test('org-1', 'alert-1');
      expect(result.wouldTrigger).toBe(true);
      expect(result.currentValue).toBe(12500);
      expect(result.threshold).toBe(10000);
    });

    it('should return wouldTrigger=false when value <= threshold', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        org_id: 'org-1',
        metric_query: 'SELECT SUM(total) FROM invoices',
        condition_operator: ConditionOperator.GT,
        threshold_value: 10000,
      });
      mockClickhouse.query.mockResolvedValue([{ sum: 8000 }]);

      const result = await service.test('org-1', 'alert-1');
      expect(result.wouldTrigger).toBe(false);
      expect(result.currentValue).toBe(8000);
    });
  });

  describe('checkAlerts', () => {
    it('should trigger alert when condition met', async () => {
      mockAlertRepo.find.mockResolvedValue([
        {
          id: 'alert-1',
          org_id: 'org-1',
          name: 'Test Alert',
          metric_query: "SELECT SUM(total) FROM invoices WHERE org_id = 'org-1'",
          condition_operator: ConditionOperator.GT,
          threshold_value: 10000,
          check_frequency: CheckFrequency.REALTIME,
          is_active: true,
        },
      ]);
      mockClickhouse.query.mockResolvedValue([{ sum: 15000 }]);
      mockTeamMemberRepo.find.mockResolvedValue([{ user_id: 'user-1', org_id: 'org-1' }]);
      mockTriggerRepo.findOne.mockResolvedValue(null);

      await service.checkAlerts();

      expect(mockTriggerRepo.save).toHaveBeenCalled();
      expect(mockNotificationRepo.save).toHaveBeenCalled();
      expect(mockGateway.emitAlertTriggered).toHaveBeenCalledWith('org-1', {
        alertId: 'alert-1',
        value: 15000,
        threshold: 10000,
      });
    });

    it('should not trigger when condition not met', async () => {
      mockAlertRepo.find.mockResolvedValue([
        {
          id: 'alert-1',
          org_id: 'org-1',
          metric_query: 'SELECT SUM(total) FROM invoices',
          condition_operator: ConditionOperator.GT,
          threshold_value: 10000,
          check_frequency: CheckFrequency.REALTIME,
          is_active: true,
        },
      ]);
      mockClickhouse.query.mockResolvedValue([{ sum: 5000 }]);
      mockTriggerRepo.findOne.mockResolvedValue(null);

      await service.checkAlerts();

      expect(mockTriggerRepo.save).not.toHaveBeenCalled();
    });

    it('should test all condition operators correctly', async () => {
      const testCases = [
        { operator: ConditionOperator.GT, value: 15000, threshold: 10000, expected: true },
        { operator: ConditionOperator.GT, value: 5000, threshold: 10000, expected: false },
        { operator: ConditionOperator.LT, value: 5000, threshold: 10000, expected: true },
        { operator: ConditionOperator.LT, value: 15000, threshold: 10000, expected: false },
        { operator: ConditionOperator.EQ, value: 10000, threshold: 10000, expected: true },
        { operator: ConditionOperator.EQ, value: 9999, threshold: 10000, expected: false },
        { operator: ConditionOperator.GTE, value: 10000, threshold: 10000, expected: true },
        { operator: ConditionOperator.LTE, value: 10000, threshold: 10000, expected: true },
      ];

      for (const tc of testCases) {
        mockAlertRepo.findOne.mockResolvedValue({
          id: 'alert-1',
          org_id: 'org-1',
          metric_query: 'SELECT 1',
          condition_operator: tc.operator,
          threshold_value: tc.threshold,
        });
        mockClickhouse.query.mockResolvedValue([{ value: tc.value }]);

        const result = await service.test('org-1', 'alert-1');
        expect(result.wouldTrigger).toBe(tc.expected);
      }
    });
  });

  describe('toggle', () => {
    it('should pause active alert', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        is_active: true,
        org_id: 'org-1',
      });

      const result = await service.toggle('org-1', 'alert-1', false);
      expect(result.is_active).toBe(false);
    });
  });
});
