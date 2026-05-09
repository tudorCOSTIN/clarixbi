import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSource } from '../data-sources/entities/data-source.entity';
import { Dashboard } from '../dashboards/entities/dashboard.entity';
import { Alert } from '../alerts/entities/alert.entity';
import { AlertTrigger } from '../alerts/entities/alert-trigger.entity';
import { SyncJob } from '../sync/entities/sync-job.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';

export interface OverviewData {
  totalRevenue: number;
  previousRevenue: number;
  totalOrders: number;
  previousOrders: number;
  activeDataSources: number;
  activeAlerts: number;
  revenueTrend: { date: string; revenue: number }[];
  topProducts: { name: string; sales: number }[];
  recentSyncJobs: {
    id: string;
    status: string;
    source_name: string;
    duration: number;
    rows_imported: number;
    created_at: string;
  }[];
  recentAlertTriggers: {
    id: string;
    alert_name: string;
    value: number;
    created_at: string;
  }[];
}

@Injectable()
export class OverviewService {
  private readonly logger = new Logger(OverviewService.name);

  constructor(
    @InjectRepository(DataSource)
    private dataSourceRepo: Repository<DataSource>,
    @InjectRepository(Dashboard)
    private dashboardRepo: Repository<Dashboard>,
    @InjectRepository(Alert)
    private alertRepo: Repository<Alert>,
    @InjectRepository(AlertTrigger)
    private alertTriggerRepo: Repository<AlertTrigger>,
    @InjectRepository(SyncJob)
    private syncJobRepo: Repository<SyncJob>,
    private clickhouse: ClickHouseService,
  ) {}

  async getOverview(orgId: string): Promise<OverviewData> {
    const [activeDataSources, activeAlerts, recentSyncJobs, recentAlertTriggers] =
      await Promise.all([
        this.dataSourceRepo.count({ where: { org_id: orgId, status: 'active' as never } }),
        this.alertRepo.count({ where: { org_id: orgId, is_active: true } }),
        this.getRecentSyncJobs(orgId),
        this.getRecentAlertTriggers(orgId),
      ]);

    // Attempt ClickHouse queries for revenue data, fallback to zeros
    const {
      totalRevenue,
      previousRevenue,
      totalOrders,
      previousOrders,
      revenueTrend,
      topProducts,
    } = await this.getRevenueData(orgId);

    return {
      totalRevenue,
      previousRevenue,
      totalOrders,
      previousOrders,
      activeDataSources,
      activeAlerts,
      revenueTrend,
      topProducts,
      recentSyncJobs,
      recentAlertTriggers,
    };
  }

  private async getRecentSyncJobs(orgId: string) {
    const jobs = await this.syncJobRepo.find({
      where: { org_id: orgId },
      relations: ['data_source'],
      order: { created_at: 'DESC' },
      take: 5,
    });

    return jobs.map((job) => {
      const duration =
        job.started_at && job.completed_at
          ? Math.round(
              (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000,
            )
          : 0;

      return {
        id: job.id,
        status: job.status,
        source_name: job.data_source?.name || 'Unknown',
        duration,
        rows_imported: job.rows_imported,
        created_at: job.created_at.toISOString(),
      };
    });
  }

  private async getRecentAlertTriggers(orgId: string) {
    const triggers = await this.alertTriggerRepo
      .createQueryBuilder('trigger')
      .innerJoinAndSelect('trigger.alert', 'alert')
      .where('alert.org_id = :orgId', { orgId })
      .orderBy('trigger.triggered_at', 'DESC')
      .take(5)
      .getMany();

    return triggers.map((t) => ({
      id: t.id,
      alert_name: t.alert?.name || 'Unknown',
      value: Number(t.metric_value),
      created_at: t.triggered_at.toISOString(),
    }));
  }

  private async getRevenueData(orgId: string) {
    const defaults = {
      totalRevenue: 0,
      previousRevenue: 0,
      totalOrders: 0,
      previousOrders: 0,
      revenueTrend: [] as { date: string; revenue: number }[],
      topProducts: [] as { name: string; sales: number }[],
    };

    try {
      // Current 30-day revenue and orders
      const currentResult = await this.clickhouse.query<{
        revenue: string;
        orders: string;
      }>(
        `SELECT
          COALESCE(SUM(total), 0) as revenue,
          COUNT(*) as orders
        FROM invoices
        WHERE org_id = {orgId:String}
          AND issue_date >= today() - 30`,
        { orgId },
      );

      // Previous 30-day revenue and orders
      const previousResult = await this.clickhouse.query<{
        revenue: string;
        orders: string;
      }>(
        `SELECT
          COALESCE(SUM(total), 0) as revenue,
          COUNT(*) as orders
        FROM invoices
        WHERE org_id = {orgId:String}
          AND issue_date >= today() - 60
          AND issue_date < today() - 30`,
        { orgId },
      );

      // 7-day revenue trend
      const trendResult = await this.clickhouse.query<{
        date: string;
        revenue: string;
      }>(
        `SELECT
          toDate(issue_date) as date,
          COALESCE(SUM(total), 0) as revenue
        FROM invoices
        WHERE org_id = {orgId:String}
          AND issue_date >= today() - 7
        GROUP BY date
        ORDER BY date`,
        { orgId },
      );

      // Top 5 products
      const productsResult = await this.clickhouse.query<{
        name: string;
        sales: string;
      }>(
        `SELECT
          product_name as name,
          COUNT(*) as sales
        FROM invoice_items
        WHERE org_id = {orgId:String}
          AND issue_date >= today() - 30
        GROUP BY name
        ORDER BY sales DESC
        LIMIT 5`,
        { orgId },
      );

      return {
        totalRevenue: Number(currentResult[0]?.revenue || 0),
        previousRevenue: Number(previousResult[0]?.revenue || 0),
        totalOrders: Number(currentResult[0]?.orders || 0),
        previousOrders: Number(previousResult[0]?.orders || 0),
        revenueTrend: trendResult.map((r) => ({
          date: r.date,
          revenue: Number(r.revenue),
        })),
        topProducts: productsResult.map((p) => ({
          name: p.name,
          sales: Number(p.sales),
        })),
      };
    } catch (error) {
      this.logger.debug(`ClickHouse revenue query failed (expected for new orgs): ${error}`);
      return defaults;
    }
  }
}
