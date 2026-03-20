import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { Alert, ConditionOperator, CheckFrequency } from './entities/alert.entity';
import { AlertTrigger } from './entities/alert-trigger.entity';
import { Subscription } from '../billing/entities/subscription.entity';
import { Notification, NotificationType } from '../notifications/entities/notification.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { SqlValidatorService } from '../ai/sql-validator.service';

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

  // ===== create =====

  describe('create', () => {
    it('should create alert when under limit', async () => {
      mockAlertRepo.count.mockResolvedValue(2);
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
      expect(result.metric_query).toBe("SELECT SUM(total) FROM invoices WHERE org_id = 'org-1'");
    });

    it('should block alert creation when plan limit exceeded (402)', async () => {
      mockAlertRepo.count.mockResolvedValue(3);
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'starter', limits: { max_alerts: 3 } },
      });

      try {
        await service.create('org-1', 'user-1', {
          name: 'Too Many',
          dataSourceId: 'ds-1',
          metricQuery: 'SELECT 1',
          conditionOperator: ConditionOperator.GT,
          thresholdValue: 100,
          checkFrequency: CheckFrequency.DAILY,
        });
        fail('Expected HttpException');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.error).toBe('ALERT_LIMIT_REACHED');
        expect(response.activeCount).toBe(3);
        expect(response.limit).toBe(3);
      }
    });

    it('should allow unlimited alerts for Enterprise (max_alerts = -1)', async () => {
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

    it('should reject alert with invalid SQL', async () => {
      mockAlertRepo.count.mockResolvedValue(0);
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { name: 'pro', limits: { max_alerts: 20 } },
      });
      mockSqlValidator.validate.mockResolvedValue({
        isValid: false,
        sanitizedSql: '',
        errors: ['DELETE is not allowed'],
      });

      try {
        await service.create('org-1', 'user-1', {
          name: 'Bad Query',
          dataSourceId: 'ds-1',
          metricQuery: 'DELETE FROM invoices',
          conditionOperator: ConditionOperator.GT,
          thresholdValue: 100,
          checkFrequency: CheckFrequency.DAILY,
        });
        fail('Expected HttpException');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.error).toBe('INVALID_QUERY');
      }
    });

    it('should use default max_alerts=3 when subscription fetch fails', async () => {
      mockAlertRepo.count.mockResolvedValue(3);
      mockSubscriptionRepo.findOne.mockRejectedValue(new Error('DB error'));

      await expect(
        service.create('org-1', 'user-1', {
          name: 'Alert',
          dataSourceId: 'ds-1',
          metricQuery: 'SELECT 1',
          conditionOperator: ConditionOperator.GT,
          thresholdValue: 100,
          checkFrequency: CheckFrequency.DAILY,
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  // ===== list =====

  describe('list', () => {
    it('should return paginated alerts', async () => {
      const alerts = [
        { id: 'a1', name: 'Alert 1' },
        { id: 'a2', name: 'Alert 2' },
      ];
      mockAlertRepo.findAndCount.mockResolvedValue([alerts, 2]);

      const result = await service.list('org-1', 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockAlertRepo.findAndCount).toHaveBeenCalledWith({
        where: { org_id: 'org-1' },
        order: { created_at: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should handle page 2 with custom limit', async () => {
      mockAlertRepo.findAndCount.mockResolvedValue([[], 15]);

      const result = await service.list('org-1', 2, 5);

      expect(result.total).toBe(15);
      expect(mockAlertRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });
  });

  // ===== findOne =====

  describe('findOne', () => {
    it('should return alert when found', async () => {
      const alert = { id: 'alert-1', org_id: 'org-1', name: 'Test' };
      mockAlertRepo.findOne.mockResolvedValue(alert);

      const result = await service.findOne('org-1', 'alert-1');

      expect(result.name).toBe('Test');
    });

    it('should throw NotFoundException when alert not found', async () => {
      mockAlertRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('org-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ===== update =====

  describe('update', () => {
    it('should update alert name without re-validating SQL', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        org_id: 'org-1',
        name: 'Old Name',
        metric_query: 'SELECT 1',
      });

      const result = await service.update('org-1', 'alert-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(mockSqlValidator.validate).not.toHaveBeenCalled();
    });

    it('should re-validate SQL when metricQuery is changed', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        org_id: 'org-1',
        name: 'Test',
        metric_query: 'SELECT 1',
      });
      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        sanitizedSql: "SELECT SUM(total) FROM invoices WHERE org_id = 'org-1'",
        errors: [],
      });

      const result = await service.update('org-1', 'alert-1', {
        metricQuery: 'SELECT SUM(total) FROM invoices',
      });

      expect(mockSqlValidator.validate).toHaveBeenCalledWith(
        'SELECT SUM(total) FROM invoices',
        'org-1',
      );
      expect(result.metric_query).toBe("SELECT SUM(total) FROM invoices WHERE org_id = 'org-1'");
    });

    it('should reject update with invalid SQL', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        org_id: 'org-1',
        name: 'Test',
      });
      mockSqlValidator.validate.mockResolvedValue({
        isValid: false,
        sanitizedSql: '',
        errors: ['Function exec is not allowed'],
      });

      await expect(
        service.update('org-1', 'alert-1', { metricQuery: "SELECT exec('cmd') FROM invoices" }),
      ).rejects.toThrow(HttpException);
    });

    it('should update conditionOperator and thresholdValue', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        org_id: 'org-1',
        condition_operator: ConditionOperator.GT,
        threshold_value: 100,
      });

      const result = await service.update('org-1', 'alert-1', {
        conditionOperator: ConditionOperator.LTE,
        thresholdValue: 500,
      });

      expect(result.condition_operator).toBe(ConditionOperator.LTE);
      expect(result.threshold_value).toBe(500);
    });

    it('should update checkFrequency', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        org_id: 'org-1',
        check_frequency: CheckFrequency.DAILY,
      });

      const result = await service.update('org-1', 'alert-1', {
        checkFrequency: CheckFrequency.HOURLY,
      });

      expect(result.check_frequency).toBe(CheckFrequency.HOURLY);
    });
  });

  // ===== remove =====

  describe('remove', () => {
    it('should remove existing alert', async () => {
      const alert = { id: 'alert-1', org_id: 'org-1' };
      mockAlertRepo.findOne.mockResolvedValue(alert);

      await service.remove('org-1', 'alert-1');

      expect(mockAlertRepo.remove).toHaveBeenCalledWith(alert);
    });

    it('should throw NotFoundException when alert not found', async () => {
      mockAlertRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('org-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ===== toggle =====

  describe('toggle', () => {
    it('should pause active alert (set is_active=false)', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        is_active: true,
        org_id: 'org-1',
      });

      const result = await service.toggle('org-1', 'alert-1', false);
      expect(result.is_active).toBe(false);
    });

    it('should re-enable paused alert (set is_active=true)', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        is_active: false,
        org_id: 'org-1',
      });
      mockAlertRepo.count.mockResolvedValue(1);
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { limits: { max_alerts: 10 } },
      });

      const result = await service.toggle('org-1', 'alert-1', true);
      expect(result.is_active).toBe(true);
    });

    it('should check alert limit when re-enabling and block if limit reached', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        is_active: false,
        org_id: 'org-1',
      });
      mockAlertRepo.count.mockResolvedValue(3);
      mockSubscriptionRepo.findOne.mockResolvedValue({
        plan: { limits: { max_alerts: 3 } },
      });

      await expect(service.toggle('org-1', 'alert-1', true)).rejects.toThrow(HttpException);
    });

    it('should not check limit when pausing (setting is_active=false)', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        is_active: true,
        org_id: 'org-1',
      });

      await service.toggle('org-1', 'alert-1', false);

      expect(mockAlertRepo.count).not.toHaveBeenCalled();
    });
  });

  // ===== test (dry-run) =====

  describe('test (dry-run)', () => {
    it('should return wouldTrigger=true when value > threshold (GT)', async () => {
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

    it('should return wouldTrigger=false when value <= threshold (GT)', async () => {
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

    it('should return 0 when query returns empty result', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        org_id: 'org-1',
        metric_query: 'SELECT SUM(total) FROM invoices',
        condition_operator: ConditionOperator.GT,
        threshold_value: 0,
      });
      mockClickhouse.query.mockResolvedValue([]);

      const result = await service.test('org-1', 'alert-1');
      expect(result.currentValue).toBe(0);
      expect(result.wouldTrigger).toBe(false);
    });
  });

  // ===== checkAlerts =====

  describe('checkAlerts', () => {
    it('should trigger alert when condition met (REALTIME)', async () => {
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
        { operator: ConditionOperator.GTE, value: 9999, threshold: 10000, expected: false },
        { operator: ConditionOperator.LTE, value: 10000, threshold: 10000, expected: true },
        { operator: ConditionOperator.LTE, value: 10001, threshold: 10000, expected: false },
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

    it('should evaluate CHANGE_PCT based on abs(currentValue) > threshold', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'alert-1',
        org_id: 'org-1',
        metric_query: 'SELECT 1',
        condition_operator: ConditionOperator.CHANGE_PCT,
        threshold_value: 10,
      });

      // Value 15 => abs(15) > 10 => true
      mockClickhouse.query.mockResolvedValue([{ value: 15 }]);
      let result = await service.test('org-1', 'alert-1');
      expect(result.wouldTrigger).toBe(true);

      // Value -15 => abs(-15) > 10 => true
      mockClickhouse.query.mockResolvedValue([{ value: -15 }]);
      result = await service.test('org-1', 'alert-1');
      expect(result.wouldTrigger).toBe(true);

      // Value 5 => abs(5) > 10 => false
      mockClickhouse.query.mockResolvedValue([{ value: 5 }]);
      result = await service.test('org-1', 'alert-1');
      expect(result.wouldTrigger).toBe(false);
    });

    it('should skip hourly alert if checked less than 55 minutes ago', async () => {
      const recentTrigger = {
        triggered_at: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      };

      mockAlertRepo.find.mockResolvedValue([
        {
          id: 'alert-1',
          org_id: 'org-1',
          metric_query: 'SELECT 1',
          condition_operator: ConditionOperator.GT,
          threshold_value: 0,
          check_frequency: CheckFrequency.HOURLY,
          is_active: true,
        },
      ]);
      mockTriggerRepo.findOne.mockResolvedValue(recentTrigger);

      await service.checkAlerts();

      // Should skip executing the metric query
      expect(mockClickhouse.query).not.toHaveBeenCalled();
      expect(mockTriggerRepo.save).not.toHaveBeenCalled();
    });

    it('should check hourly alert if more than 55 minutes have passed', async () => {
      const oldTrigger = {
        triggered_at: new Date(Date.now() - 60 * 60 * 1000), // 60 min ago
      };

      mockAlertRepo.find.mockResolvedValue([
        {
          id: 'alert-1',
          org_id: 'org-1',
          name: 'Hourly Alert',
          metric_query: 'SELECT 1',
          condition_operator: ConditionOperator.GT,
          threshold_value: 0,
          check_frequency: CheckFrequency.HOURLY,
          is_active: true,
        },
      ]);
      mockTriggerRepo.findOne.mockResolvedValue(oldTrigger);
      mockClickhouse.query.mockResolvedValue([{ value: 10 }]);
      mockTeamMemberRepo.find.mockResolvedValue([{ user_id: 'user-1', org_id: 'org-1' }]);

      await service.checkAlerts();

      expect(mockClickhouse.query).toHaveBeenCalled();
    });

    it('should skip daily alert if checked less than 23 hours ago', async () => {
      const recentTrigger = {
        triggered_at: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      };

      mockAlertRepo.find.mockResolvedValue([
        {
          id: 'alert-1',
          org_id: 'org-1',
          metric_query: 'SELECT 1',
          condition_operator: ConditionOperator.GT,
          threshold_value: 0,
          check_frequency: CheckFrequency.DAILY,
          is_active: true,
        },
      ]);
      mockTriggerRepo.findOne.mockResolvedValue(recentTrigger);

      await service.checkAlerts();

      expect(mockClickhouse.query).not.toHaveBeenCalled();
    });

    it('should handle query failure in checkAlerts without crashing', async () => {
      mockAlertRepo.find.mockResolvedValue([
        {
          id: 'alert-1',
          org_id: 'org-1',
          metric_query: 'SELECT 1',
          condition_operator: ConditionOperator.GT,
          threshold_value: 0,
          check_frequency: CheckFrequency.REALTIME,
          is_active: true,
        },
      ]);
      mockTriggerRepo.findOne.mockResolvedValue(null);
      mockClickhouse.query.mockRejectedValue(new Error('ClickHouse down'));

      // Should not throw
      await expect(service.checkAlerts()).resolves.not.toThrow();
    });

    it('should process no alerts when none are active', async () => {
      mockAlertRepo.find.mockResolvedValue([]);

      await service.checkAlerts();

      expect(mockClickhouse.query).not.toHaveBeenCalled();
      expect(mockTriggerRepo.save).not.toHaveBeenCalled();
    });
  });

  // ===== handleAlertTriggered =====

  describe('handleAlertTriggered (via checkAlerts)', () => {
    it('should create trigger record and notify all org members', async () => {
      mockAlertRepo.find.mockResolvedValue([
        {
          id: 'alert-1',
          org_id: 'org-1',
          name: 'Revenue Alert',
          metric_query: 'SELECT SUM(total) FROM invoices',
          condition_operator: ConditionOperator.GT,
          threshold_value: 10000,
          check_frequency: CheckFrequency.REALTIME,
          is_active: true,
        },
      ]);
      mockClickhouse.query.mockResolvedValue([{ sum: 15000 }]);
      mockTriggerRepo.findOne.mockResolvedValue(null);
      mockTeamMemberRepo.find.mockResolvedValue([
        { user_id: 'user-1', org_id: 'org-1' },
        { user_id: 'user-2', org_id: 'org-1' },
      ]);

      await service.checkAlerts();

      // Trigger record created
      expect(mockTriggerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alert_id: 'alert-1',
          metric_value: 15000,
          threshold_value: 10000,
          notified_via: ['in_app', 'email'],
        }),
      );
      expect(mockTriggerRepo.save).toHaveBeenCalled();

      // Notifications created for each member
      expect(mockNotificationRepo.save).toHaveBeenCalledTimes(2);
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.ALERT_TRIGGERED,
          title: 'Alerta: Revenue Alert',
          link_url: '/alerts',
        }),
      );

      // WebSocket notification
      expect(mockGateway.emitAlertTriggered).toHaveBeenCalledWith('org-1', {
        alertId: 'alert-1',
        value: 15000,
        threshold: 10000,
      });
    });

    it('should handle zero members gracefully', async () => {
      mockAlertRepo.find.mockResolvedValue([
        {
          id: 'alert-1',
          org_id: 'org-1',
          name: 'Test',
          metric_query: 'SELECT 1',
          condition_operator: ConditionOperator.GT,
          threshold_value: 0,
          check_frequency: CheckFrequency.REALTIME,
          is_active: true,
        },
      ]);
      mockClickhouse.query.mockResolvedValue([{ value: 10 }]);
      mockTriggerRepo.findOne.mockResolvedValue(null);
      mockTeamMemberRepo.find.mockResolvedValue([]);

      await service.checkAlerts();

      expect(mockTriggerRepo.save).toHaveBeenCalled();
      expect(mockNotificationRepo.save).not.toHaveBeenCalled();
      expect(mockGateway.emitAlertTriggered).toHaveBeenCalled();
    });
  });

  // ===== getTriggerHistory =====

  describe('getTriggerHistory', () => {
    it('should return paginated trigger history', async () => {
      mockAlertRepo.findOne.mockResolvedValue({ id: 'alert-1', org_id: 'org-1' });
      const triggers = [{ id: 't1', alert_id: 'alert-1', metric_value: 100 }];
      mockTriggerRepo.findAndCount.mockResolvedValue([triggers, 1]);

      const result = await service.getTriggerHistory('org-1', 'alert-1');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should throw NotFoundException when alert not found', async () => {
      mockAlertRepo.findOne.mockResolvedValue(null);

      await expect(service.getTriggerHistory('org-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
