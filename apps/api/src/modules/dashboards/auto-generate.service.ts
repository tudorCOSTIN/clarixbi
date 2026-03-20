import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dashboard, DashboardSourceType } from './entities/dashboard.entity';
import { Widget, WidgetType } from '../widgets/entities/widget.entity';
import { DataSourceEntity, DataSourceType } from '../data-sources/entities/data-source.entity';

interface WidgetTemplate {
  type: WidgetType;
  title: string;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

@Injectable()
export class AutoGenerateService {
  private readonly logger = new Logger(AutoGenerateService.name);

  constructor(
    @InjectRepository(Dashboard)
    private readonly dashboardRepo: Repository<Dashboard>,
    @InjectRepository(Widget)
    private readonly widgetRepo: Repository<Widget>,
    @InjectRepository(DataSourceEntity)
    private readonly dataSourceRepo: Repository<DataSourceEntity>,
  ) {}

  async autoGenerate(
    orgId: string,
    userId: string,
    dataSourceId: string,
    dataSourceType: DataSourceType,
  ): Promise<Dashboard> {
    const dataSource = await this.dataSourceRepo.findOne({
      where: { id: dataSourceId, org_id: orgId },
    });
    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    const sourceTypeMap: Record<DataSourceType, DashboardSourceType> = {
      [DataSourceType.SMARTBILL]: DashboardSourceType.SMARTBILL,
      [DataSourceType.WOOCOMMERCE]: DashboardSourceType.WOOCOMMERCE,
      [DataSourceType.CSV]: DashboardSourceType.CSV,
      [DataSourceType.EFACTURA]: DashboardSourceType.EFACTURA,
    };

    const dashboard = this.dashboardRepo.create({
      org_id: orgId,
      created_by: userId,
      name: `${dataSource.name} — Auto Dashboard`,
      description: `Auto-generated dashboard for ${dataSource.name}`,
      layout: [],
      is_auto_generated: true,
      source_type: sourceTypeMap[dataSourceType] || null,
    });
    const savedDashboard = await this.dashboardRepo.save(dashboard);

    let template: WidgetTemplate[];
    switch (dataSourceType) {
      case DataSourceType.SMARTBILL:
        template = this.getSmartBillTemplate();
        break;
      case DataSourceType.WOOCOMMERCE:
        template = this.getWooCommerceTemplate();
        break;
      case DataSourceType.CSV: {
        const columns = (dataSource.config.columns as string[]) || [];
        template = this.getCsvTemplate(columns);
        break;
      }
      default:
        template = this.getSmartBillTemplate();
        break;
    }

    await this.createWidgetsFromTemplate(orgId, savedDashboard.id, dataSourceId, template);

    this.logger.log(
      `Auto-generated dashboard ${savedDashboard.id} with ${template.length} widgets for org ${orgId}`,
    );

    return this.dashboardRepo.findOne({
      where: { id: savedDashboard.id, org_id: orgId },
      relations: ['widgets'],
    }) as Promise<Dashboard>;
  }

  private getSmartBillTemplate(): WidgetTemplate[] {
    return [
      {
        type: WidgetType.KPI,
        title: 'Total Revenue',
        config: {
          aggregation: 'SUM',
          metric: 'total_amount',
          table: 'invoices',
          showTrend: true,
          colorScheme: 'primary',
        },
        position: { x: 0, y: 0, w: 4, h: 2 },
      },
      {
        type: WidgetType.LINE,
        title: 'Monthly Revenue',
        config: {
          smooth: true,
          showArea: true,
          colorScheme: 'primary',
          metric: 'total_amount',
          aggregation: 'SUM',
          dateColumn: 'issue_date',
          granularity: 'month',
          table: 'invoices',
        },
        position: { x: 4, y: 0, w: 8, h: 4 },
      },
      {
        type: WidgetType.BAR,
        title: 'Top Clients',
        config: {
          horizontal: false,
          gradient: true,
          colorScheme: 'primary',
          metric: 'total_amount',
          aggregation: 'SUM',
          categoryColumn: 'client_name',
          table: 'invoices',
          limit: 10,
        },
        position: { x: 0, y: 2, w: 6, h: 4 },
      },
      {
        type: WidgetType.TABLE,
        title: 'Recent Invoices',
        config: {
          pageSize: 10,
          sortOrder: 'DESC',
          searchable: true,
          columns: ['invoice_number', 'client_name', 'issue_date', 'total_amount', 'status'],
          orderColumn: 'issue_date',
          table: 'invoices',
        },
        position: { x: 0, y: 6, w: 12, h: 4 },
      },
      {
        type: WidgetType.PIE,
        title: 'Payment Status',
        config: {
          donut: true,
          showLabels: true,
          colorScheme: 'primary',
          metric: 'total_amount',
          aggregation: 'SUM',
          categoryColumn: 'status',
          table: 'invoices',
        },
        position: { x: 6, y: 2, w: 6, h: 4 },
      },
    ];
  }

  private getWooCommerceTemplate(): WidgetTemplate[] {
    return [
      {
        type: WidgetType.KPI,
        title: 'Total Orders',
        config: {
          aggregation: 'COUNT',
          metric: 'id',
          table: 'orders',
          showTrend: true,
          colorScheme: 'primary',
        },
        position: { x: 0, y: 0, w: 4, h: 2 },
      },
      {
        type: WidgetType.LINE,
        title: 'Revenue Over Time',
        config: {
          smooth: true,
          showArea: true,
          colorScheme: 'primary',
          metric: 'total',
          aggregation: 'SUM',
          dateColumn: 'date_created',
          granularity: 'month',
          table: 'orders',
        },
        position: { x: 4, y: 0, w: 8, h: 4 },
      },
      {
        type: WidgetType.BAR,
        title: 'Top Products',
        config: {
          horizontal: false,
          gradient: true,
          colorScheme: 'primary',
          metric: 'quantity',
          aggregation: 'SUM',
          categoryColumn: 'product_name',
          table: 'order_items',
          limit: 10,
        },
        position: { x: 0, y: 2, w: 6, h: 4 },
      },
      {
        type: WidgetType.TABLE,
        title: 'Recent Orders',
        config: {
          pageSize: 10,
          sortOrder: 'DESC',
          searchable: true,
          columns: ['order_number', 'customer_name', 'date_created', 'total', 'status'],
          orderColumn: 'date_created',
          table: 'orders',
        },
        position: { x: 0, y: 6, w: 12, h: 4 },
      },
      {
        type: WidgetType.PIE,
        title: 'Order Status',
        config: {
          donut: true,
          showLabels: true,
          colorScheme: 'primary',
          metric: 'id',
          aggregation: 'COUNT',
          categoryColumn: 'status',
          table: 'orders',
        },
        position: { x: 6, y: 2, w: 6, h: 4 },
      },
    ];
  }

  private getCsvTemplate(columns: string[]): WidgetTemplate[] {
    const templates: WidgetTemplate[] = [];
    const table = 'csv_data';

    // Detect first numeric-looking column for KPI
    const numericPatterns =
      /amount|total|price|qty|quantity|count|sum|value|revenue|cost|number|num/i;
    const numericCol = columns.find((col) => numericPatterns.test(col)) || columns[0];

    if (numericCol) {
      templates.push({
        type: WidgetType.KPI,
        title: `Total ${numericCol}`,
        config: {
          aggregation: 'SUM',
          metric: numericCol,
          table,
          showTrend: false,
          colorScheme: 'primary',
        },
        position: { x: 0, y: 0, w: 4, h: 2 },
      });
    }

    // Table widget showing all columns
    templates.push({
      type: WidgetType.TABLE,
      title: 'All Data',
      config: {
        pageSize: 10,
        sortOrder: 'DESC',
        searchable: true,
        columns: columns.length > 0 ? columns.slice(0, 10) : ['*'],
        orderColumn: columns[0] || undefined,
        table,
      },
      position: { x: 0, y: 2, w: 12, h: 5 },
    });

    return templates;
  }

  private async createWidgetsFromTemplate(
    orgId: string,
    dashboardId: string,
    dataSourceId: string,
    template: WidgetTemplate[],
  ): Promise<Widget[]> {
    const widgets = template.map((tpl) =>
      this.widgetRepo.create({
        dashboard_id: dashboardId,
        org_id: orgId,
        type: tpl.type,
        title: tpl.title,
        config: tpl.config,
        query_sql: '',
        position: tpl.position,
        data_source_id: dataSourceId,
      }),
    );

    return this.widgetRepo.save(widgets);
  }
}
