import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Report, ReportFormat } from './entities/report.entity';
import { ReportSchedule } from './entities/report-schedule.entity';
import { Dashboard } from '../dashboards/entities/dashboard.entity';
import { Widget } from '../widgets/entities/widget.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';

// Mock BullMQ queue
jest.mock('../sync/queues.config', () => ({
  reportsGenerateQueue: {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  },
}));

describe('ReportsService', () => {
  let service: ReportsService;
  const mockReportRepo = {
    create: jest.fn((data) => ({ id: 'report-1', ...data })),
    save: jest.fn((data) => data),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };
  const mockScheduleRepo = {
    create: jest.fn((data) => ({ id: 'schedule-1', ...data })),
    save: jest.fn((data) => data),
    find: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
  };
  const mockDashboardRepo = {
    findOne: jest.fn(),
  };
  const mockWidgetRepo = {
    findOne: jest.fn(),
  };
  const mockClickhouse = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Report), useValue: mockReportRepo },
        { provide: getRepositoryToken(ReportSchedule), useValue: mockScheduleRepo },
        { provide: getRepositoryToken(Dashboard), useValue: mockDashboardRepo },
        { provide: getRepositoryToken(Widget), useValue: mockWidgetRepo },
        { provide: ClickHouseService, useValue: mockClickhouse },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
  });

  // ===== create =====

  describe('create', () => {
    it('should create report from dashboard with widgets', async () => {
      mockDashboardRepo.findOne.mockResolvedValue({ id: 'dash-1', org_id: 'org-1' });

      const result = await service.create('org-1', 'user-1', {
        name: 'Monthly Report',
        dashboardId: 'dash-1',
        widgetIds: ['w1', 'w2'],
        description: 'Test',
      });

      expect(result.name).toBe('Monthly Report');
      expect(result.format).toBe(ReportFormat.PDF);
      expect(result.config).toEqual({ widgetIds: ['w1', 'w2'] });
      expect(result.org_id).toBe('org-1');
      expect(result.created_by).toBe('user-1');
    });

    it('should create report without description', async () => {
      mockDashboardRepo.findOne.mockResolvedValue({ id: 'dash-1', org_id: 'org-1' });

      const result = await service.create('org-1', 'user-1', {
        name: 'No Desc Report',
        dashboardId: 'dash-1',
        widgetIds: ['w1'],
      });

      expect(result.description).toBeNull();
    });

    it('should throw if dashboard not found', async () => {
      mockDashboardRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('org-1', 'user-1', {
          name: 'Test',
          dashboardId: 'invalid',
          widgetIds: ['w1'],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===== list =====

  describe('list', () => {
    it('should return paginated reports', async () => {
      const reports = [
        { id: 'r1', name: 'Report 1' },
        { id: 'r2', name: 'Report 2' },
      ];
      mockReportRepo.findAndCount.mockResolvedValue([reports, 2]);

      const result = await service.list('org-1', 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockReportRepo.findAndCount).toHaveBeenCalledWith({
        where: { org_id: 'org-1' },
        relations: ['dashboard', 'schedules'],
        order: { created_at: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should handle page 2 with custom limit', async () => {
      mockReportRepo.findAndCount.mockResolvedValue([[], 25]);

      const result = await service.list('org-1', 2, 10);

      expect(result.total).toBe(25);
      expect(mockReportRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('should use default pagination', async () => {
      mockReportRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.list('org-1');

      expect(mockReportRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  // ===== findOne =====

  describe('findOne', () => {
    it('should return report with relations', async () => {
      const report = {
        id: 'report-1',
        org_id: 'org-1',
        name: 'Test',
        dashboard: { id: 'dash-1' },
        schedules: [],
      };
      mockReportRepo.findOne.mockResolvedValue(report);

      const result = await service.findOne('org-1', 'report-1');

      expect(result.name).toBe('Test');
      expect(mockReportRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'report-1', org_id: 'org-1' },
        relations: ['dashboard', 'schedules'],
      });
    });

    it('should throw NotFoundException when report not found', async () => {
      mockReportRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('org-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ===== update =====

  describe('update', () => {
    it('should update report name and description', async () => {
      mockReportRepo.findOne.mockResolvedValue({
        id: 'report-1',
        org_id: 'org-1',
        name: 'Old Name',
        description: 'Old Desc',
        config: { widgetIds: ['w1'] },
      });

      const result = await service.update('org-1', 'report-1', {
        name: 'New Name',
        description: 'New Desc',
      });

      expect(result.name).toBe('New Name');
      expect(result.description).toBe('New Desc');
    });

    it('should update widget IDs in config', async () => {
      mockReportRepo.findOne.mockResolvedValue({
        id: 'report-1',
        org_id: 'org-1',
        name: 'Test',
        config: { widgetIds: ['w1'], otherKey: 'preserved' },
      });

      const result = await service.update('org-1', 'report-1', {
        widgetIds: ['w1', 'w2', 'w3'],
      });

      expect(result.config).toEqual({
        widgetIds: ['w1', 'w2', 'w3'],
        otherKey: 'preserved',
      });
    });

    it('should throw NotFoundException when report not found', async () => {
      mockReportRepo.findOne.mockResolvedValue(null);

      await expect(service.update('org-1', 'nonexistent', { name: 'Nope' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ===== remove =====

  describe('remove', () => {
    it('should remove existing report', async () => {
      const report = { id: 'report-1', org_id: 'org-1' };
      mockReportRepo.findOne.mockResolvedValue(report);

      await service.remove('org-1', 'report-1');

      expect(mockReportRepo.remove).toHaveBeenCalledWith(report);
    });

    it('should throw NotFoundException when report not found', async () => {
      mockReportRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('org-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ===== generate =====

  describe('generate', () => {
    it('should queue PDF generation job', async () => {
      mockReportRepo.findOne.mockResolvedValue({
        id: 'report-1',
        org_id: 'org-1',
        dashboard_id: 'dash-1',
        name: 'Test',
        config: { widgetIds: ['w1'] },
      });

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { reportsGenerateQueue } = require('../sync/queues.config');
      const result = await service.generate('org-1', 'report-1');

      expect(result.jobId).toBe('job-1');
      expect(reportsGenerateQueue.add).toHaveBeenCalledWith(
        'generate-pdf',
        expect.objectContaining({
          reportId: 'report-1',
          orgId: 'org-1',
          dashboardId: 'dash-1',
          widgetIds: ['w1'],
          reportName: 'Test',
        }),
      );
    });

    it('should throw NotFoundException when report not found', async () => {
      mockReportRepo.findOne.mockResolvedValue(null);

      await expect(service.generate('org-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should handle report with empty widgetIds in config', async () => {
      mockReportRepo.findOne.mockResolvedValue({
        id: 'report-1',
        org_id: 'org-1',
        dashboard_id: 'dash-1',
        name: 'Empty Widgets',
        config: {},
      });

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { reportsGenerateQueue } = require('../sync/queues.config');
      await service.generate('org-1', 'report-1');

      expect(reportsGenerateQueue.add).toHaveBeenCalledWith(
        'generate-pdf',
        expect.objectContaining({ widgetIds: [] }),
      );
    });
  });

  // ===== createSchedule =====

  describe('createSchedule', () => {
    beforeEach(() => {
      mockReportRepo.findOne.mockResolvedValue({ id: 'report-1', org_id: 'org-1' });
    });

    it('should create daily schedule with cron 0 8 * * *', async () => {
      const result = await service.createSchedule('org-1', 'report-1', {
        frequency: 'daily',
        recipients: ['test@example.com'],
        timezone: 'Europe/Bucharest',
      });

      expect(result.cron_expression).toBe('0 8 * * *');
      expect(result.recipients).toEqual(['test@example.com']);
      expect(result.is_active).toBe(true);
      expect(result.timezone).toBe('Europe/Bucharest');
    });

    it('should create weekly schedule with cron 0 8 * * 1', async () => {
      const result = await service.createSchedule('org-1', 'report-1', {
        frequency: 'weekly',
        recipients: ['team@example.com'],
      });

      expect(result.cron_expression).toBe('0 8 * * 1');
    });

    it('should create monthly schedule with cron 0 8 1 * *', async () => {
      const result = await service.createSchedule('org-1', 'report-1', {
        frequency: 'monthly',
        recipients: ['manager@example.com'],
      });

      expect(result.cron_expression).toBe('0 8 1 * *');
    });

    it('should use default timezone Europe/Bucharest when not specified', async () => {
      const result = await service.createSchedule('org-1', 'report-1', {
        frequency: 'daily',
        recipients: ['test@example.com'],
      });

      expect(result.timezone).toBe('Europe/Bucharest');
    });

    it('should throw NotFoundException when report not found', async () => {
      mockReportRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createSchedule('org-1', 'nonexistent', {
          frequency: 'daily',
          recipients: ['test@example.com'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set next_run_at in the future', async () => {
      const result = await service.createSchedule('org-1', 'report-1', {
        frequency: 'daily',
        recipients: ['test@example.com'],
      });

      expect(result.next_run_at).toBeInstanceOf(Date);
      expect(result.next_run_at!.getTime()).toBeGreaterThan(Date.now() - 1000);
    });
  });

  // ===== removeSchedule =====

  describe('removeSchedule', () => {
    it('should remove all schedules for a report', async () => {
      mockReportRepo.findOne.mockResolvedValue({ id: 'report-1', org_id: 'org-1' });
      const schedules = [{ id: 's1' }, { id: 's2' }];
      mockScheduleRepo.find.mockResolvedValue(schedules);

      await service.removeSchedule('org-1', 'report-1');

      expect(mockScheduleRepo.remove).toHaveBeenCalledWith(schedules);
    });

    it('should handle report with no schedules gracefully', async () => {
      mockReportRepo.findOne.mockResolvedValue({ id: 'report-1', org_id: 'org-1' });
      mockScheduleRepo.find.mockResolvedValue([]);

      await service.removeSchedule('org-1', 'report-1');

      expect(mockScheduleRepo.remove).not.toHaveBeenCalled();
    });
  });

  // ===== getWidgetData =====

  describe('getWidgetData', () => {
    it('should fetch data for each widget', async () => {
      mockWidgetRepo.findOne.mockResolvedValue({
        id: 'w1',
        title: 'Revenue',
        query_sql: 'SELECT SUM(amount) FROM invoices',
      });
      mockClickhouse.query.mockResolvedValue([{ sum: 50000 }]);

      const results = await service.getWidgetData(['w1'], 'org-1');
      expect(results).toHaveLength(1);
      expect(results[0]!.data).toEqual([{ sum: 50000 }]);
    });

    it('should handle widget query failure gracefully with empty data', async () => {
      mockWidgetRepo.findOne.mockResolvedValue({
        id: 'w1',
        title: 'Revenue',
        query_sql: 'SELECT SUM(amount) FROM invoices',
      });
      mockClickhouse.query.mockRejectedValue(new Error('ClickHouse timeout'));

      const results = await service.getWidgetData(['w1'], 'org-1');

      expect(results).toHaveLength(1);
      expect(results[0]!.data).toEqual([]);
    });

    it('should skip widgets that do not exist', async () => {
      mockWidgetRepo.findOne.mockResolvedValue(null);

      const results = await service.getWidgetData(['nonexistent'], 'org-1');

      expect(results).toHaveLength(0);
    });

    it('should handle multiple widgets with mixed results', async () => {
      mockWidgetRepo.findOne
        .mockResolvedValueOnce({
          id: 'w1',
          title: 'Revenue',
          query_sql: 'SELECT SUM(amount) FROM invoices',
        })
        .mockResolvedValueOnce(null) // w2 doesn't exist
        .mockResolvedValueOnce({
          id: 'w3',
          title: 'Count',
          query_sql: 'SELECT COUNT(*) FROM orders',
        });

      mockClickhouse.query
        .mockResolvedValueOnce([{ sum: 50000 }])
        .mockResolvedValueOnce([{ count: 100 }]);

      const results = await service.getWidgetData(['w1', 'w2', 'w3'], 'org-1');

      expect(results).toHaveLength(2);
      expect(results[0]!.widget.id).toBe('w1');
      expect(results[1]!.widget.id).toBe('w3');
    });
  });

  // ===== getLatestDownloadUrl =====

  describe('getLatestDownloadUrl', () => {
    it('should return the latest file URL', async () => {
      mockReportRepo.findOne
        .mockResolvedValueOnce({ id: 'report-1', org_id: 'org-1' }) // findOne for validation
        .mockResolvedValueOnce({
          id: 'report-1',
          org_id: 'org-1',
          config: {
            generatedFiles: [
              { url: 'https://cdn.example.com/old.pdf', generatedAt: '2025-01-01' },
              { url: 'https://cdn.example.com/latest.pdf', generatedAt: '2025-02-01' },
            ],
          },
        });

      const result = await service.getLatestDownloadUrl('org-1', 'report-1');

      expect(result).toEqual({ url: 'https://cdn.example.com/latest.pdf' });
    });

    it('should return null when no files have been generated', async () => {
      mockReportRepo.findOne
        .mockResolvedValueOnce({ id: 'report-1', org_id: 'org-1' })
        .mockResolvedValueOnce({
          id: 'report-1',
          org_id: 'org-1',
          config: {},
        });

      const result = await service.getLatestDownloadUrl('org-1', 'report-1');

      expect(result).toBeNull();
    });
  });
});
