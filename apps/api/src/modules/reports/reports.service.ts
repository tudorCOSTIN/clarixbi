import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Report, ReportFormat } from './entities/report.entity';
import { ReportSchedule } from './entities/report-schedule.entity';
import { Dashboard } from '../dashboards/entities/dashboard.entity';
import { Widget } from '../widgets/entities/widget.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { reportsGenerateQueue } from '../sync/queues.config';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Report)
    private reportRepo: Repository<Report>,
    @InjectRepository(ReportSchedule)
    private scheduleRepo: Repository<ReportSchedule>,
    @InjectRepository(Dashboard)
    private dashboardRepo: Repository<Dashboard>,
    @InjectRepository(Widget)
    private widgetRepo: Repository<Widget>,
    private clickhouse: ClickHouseService,
  ) {}

  async create(
    orgId: string,
    userId: string,
    data: { name: string; dashboardId: string; widgetIds: string[]; description?: string },
  ): Promise<Report> {
    // Verify dashboard belongs to org
    const dashboard = await this.dashboardRepo.findOne({
      where: { id: data.dashboardId, org_id: orgId, deleted_at: IsNull() },
    });
    if (!dashboard) throw new NotFoundException('Dashboard not found');

    const report = this.reportRepo.create({
      org_id: orgId,
      dashboard_id: data.dashboardId,
      created_by: userId,
      name: data.name,
      description: data.description || null,
      format: ReportFormat.PDF,
      config: { widgetIds: data.widgetIds },
    });

    return this.reportRepo.save(report);
  }

  async list(orgId: string, page = 1, limit = 20): Promise<{ data: Report[]; total: number }> {
    const [data, total] = await this.reportRepo.findAndCount({
      where: { org_id: orgId },
      relations: ['dashboard', 'schedules'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findOne(orgId: string, reportId: string): Promise<Report> {
    const report = await this.reportRepo.findOne({
      where: { id: reportId, org_id: orgId },
      relations: ['dashboard', 'schedules'],
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async update(
    orgId: string,
    reportId: string,
    data: { name?: string; description?: string; widgetIds?: string[] },
  ): Promise<Report> {
    const report = await this.findOne(orgId, reportId);

    if (data.name !== undefined) report.name = data.name;
    if (data.description !== undefined) report.description = data.description;
    if (data.widgetIds) {
      report.config = { ...report.config, widgetIds: data.widgetIds };
    }

    return this.reportRepo.save(report);
  }

  async remove(orgId: string, reportId: string): Promise<void> {
    const report = await this.findOne(orgId, reportId);
    await this.reportRepo.remove(report);
  }

  async generate(orgId: string, reportId: string): Promise<{ jobId: string }> {
    const report = await this.findOne(orgId, reportId);

    const job = await reportsGenerateQueue.add('generate-pdf', {
      reportId: report.id,
      orgId,
      dashboardId: report.dashboard_id,
      widgetIds: (report.config as { widgetIds?: string[] }).widgetIds || [],
      reportName: report.name,
    });

    return { jobId: job.id as string };
  }

  async getGeneratedFiles(
    orgId: string,
    reportId: string,
  ): Promise<{ files: { url: string; generatedAt: string }[] }> {
    await this.findOne(orgId, reportId);
    // Files stored in config.generatedFiles
    const report = await this.reportRepo.findOne({
      where: { id: reportId, org_id: orgId },
    });

    const generatedFiles =
      (report?.config as { generatedFiles?: { url: string; generatedAt: string }[] })
        ?.generatedFiles || [];
    return { files: generatedFiles };
  }

  async getLatestDownloadUrl(orgId: string, reportId: string): Promise<{ url: string } | null> {
    const { files } = await this.getGeneratedFiles(orgId, reportId);
    if (files.length === 0) return null;
    return { url: files[files.length - 1]!.url };
  }

  // --- Schedule ---

  async createSchedule(
    orgId: string,
    reportId: string,
    data: { frequency: 'daily' | 'weekly' | 'monthly'; recipients: string[]; timezone?: string },
  ): Promise<ReportSchedule> {
    await this.findOne(orgId, reportId);

    const cronExpression = this.frequencyToCron(data.frequency);
    const timezone = data.timezone || 'Europe/Bucharest';
    const nextRunAt = this.calculateNextRun(data.frequency);

    const schedule = this.scheduleRepo.create({
      report_id: reportId,
      cron_expression: cronExpression,
      timezone,
      recipients: data.recipients,
      is_active: true,
      next_run_at: nextRunAt,
    });

    return this.scheduleRepo.save(schedule);
  }

  async removeSchedule(orgId: string, reportId: string): Promise<void> {
    await this.findOne(orgId, reportId);
    const schedules = await this.scheduleRepo.find({ where: { report_id: reportId } });
    if (schedules.length > 0) {
      await this.scheduleRepo.remove(schedules);
    }
  }

  async getActiveSchedules(): Promise<ReportSchedule[]> {
    return this.scheduleRepo.find({
      where: { is_active: true },
      relations: ['report'],
    });
  }

  async updateScheduleAfterSend(scheduleId: string, frequency: string): Promise<void> {
    const freqMap: Record<string, 'daily' | 'weekly' | 'monthly'> = {
      '0 8 * * *': 'daily',
      '0 8 * * 1': 'weekly',
      '0 8 1 * *': 'monthly',
    };
    const freq = freqMap[frequency] || 'daily';
    const nextRunAt = this.calculateNextRun(freq);

    await this.scheduleRepo.update(scheduleId, {
      last_sent_at: new Date(),
      next_run_at: nextRunAt,
    });
  }

  // --- Widget Data ---

  async getWidgetData(
    widgetIds: string[],
    orgId: string,
  ): Promise<{ widget: Widget; data: Record<string, unknown>[] }[]> {
    const results: { widget: Widget; data: Record<string, unknown>[] }[] = [];

    for (const widgetId of widgetIds) {
      const widget = await this.widgetRepo.findOne({
        where: { id: widgetId, org_id: orgId },
      });
      if (!widget) continue;

      try {
        const data = await this.clickhouse.query(widget.query_sql);
        results.push({ widget, data });
      } catch (error) {
        this.logger.warn(`Failed to fetch data for widget ${widgetId}: ${error}`);
        results.push({ widget, data: [] });
      }
    }

    return results;
  }

  private frequencyToCron(frequency: 'daily' | 'weekly' | 'monthly'): string {
    switch (frequency) {
      case 'daily':
        return '0 8 * * *'; // 8 AM daily
      case 'weekly':
        return '0 8 * * 1'; // 8 AM Monday
      case 'monthly':
        return '0 8 1 * *'; // 8 AM 1st of month
    }
  }

  private calculateNextRun(frequency: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    const next = new Date(now);
    next.setHours(8, 0, 0, 0);

    switch (frequency) {
      case 'daily':
        if (now.getHours() >= 8) next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + ((7 - next.getDay() + 1) % 7 || 7));
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        break;
    }

    return next;
  }
}
