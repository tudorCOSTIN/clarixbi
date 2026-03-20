import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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
    });

    it('should throw if dashboard not found', async () => {
      mockDashboardRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('org-1', 'user-1', {
          name: 'Test',
          dashboardId: 'invalid',
          widgetIds: ['w1'],
        }),
      ).rejects.toThrow('Dashboard not found');
    });
  });

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
        }),
      );
    });
  });

  describe('createSchedule', () => {
    it('should create daily schedule', async () => {
      mockReportRepo.findOne.mockResolvedValue({ id: 'report-1', org_id: 'org-1' });

      const result = await service.createSchedule('org-1', 'report-1', {
        frequency: 'daily',
        recipients: ['test@example.com'],
        timezone: 'Europe/Bucharest',
      });

      expect(result.cron_expression).toBe('0 8 * * *');
      expect(result.recipients).toEqual(['test@example.com']);
      expect(result.is_active).toBe(true);
    });
  });

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
  });
});
