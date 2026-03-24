import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Widget } from './entities/widget.entity';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { BulkUpdatePositionsDto } from './dto/bulk-update-positions.dto';

const DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  line: { smooth: true, showArea: false, colorScheme: 'primary' },
  bar: { horizontal: false, gradient: true, colorScheme: 'primary' },
  pie: { donut: false, showLabels: true, colorScheme: 'primary' },
  table: { pageSize: 10, sortOrder: 'DESC', searchable: true },
  kpi: { aggregation: 'SUM', showTrend: true, colorScheme: 'primary' },
};

@Injectable()
export class WidgetsService {
  private readonly logger = new Logger(WidgetsService.name);

  constructor(
    @InjectRepository(Widget)
    private readonly widgetRepo: Repository<Widget>,
    private readonly dataSource: DataSource,
  ) {}

  async create(orgId: string, dashboardId: string, dto: CreateWidgetDto): Promise<Widget> {
    try {
      const defaultConfig = DEFAULT_CONFIGS[dto.type] || {};
      const widget = this.widgetRepo.create({
        dashboard_id: dashboardId,
        org_id: orgId,
        type: dto.type,
        title: dto.title,
        config: { ...defaultConfig, ...(dto.config || {}) },
        query_sql: '',
        position: dto.position || { x: 0, y: 0, w: 4, h: 3 },
        data_source_id: dto.data_source_id || null,
      });
      return await this.widgetRepo.save(widget);
    } catch (error) {
      this.logger.error(
        `Failed to create widget for dashboard ${dashboardId}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException('Failed to create widget');
    }
  }

  async findByDashboard(orgId: string, dashboardId: string): Promise<Widget[]> {
    try {
      return await this.widgetRepo.find({
        where: { dashboard_id: dashboardId, org_id: orgId },
        relations: ['data_source'],
        order: { created_at: 'ASC' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to list widgets for dashboard ${dashboardId}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException('Failed to retrieve widgets');
    }
  }

  async findOne(orgId: string, dashboardId: string, id: string): Promise<Widget> {
    const widget = await this.widgetRepo.findOne({
      where: { id, dashboard_id: dashboardId, org_id: orgId },
      relations: ['data_source'],
    });
    if (!widget) {
      throw new NotFoundException('Widget not found');
    }
    return widget;
  }

  async update(
    orgId: string,
    dashboardId: string,
    id: string,
    dto: UpdateWidgetDto,
  ): Promise<Widget> {
    const widget = await this.findOne(orgId, dashboardId, id);
    if (dto.type !== undefined) widget.type = dto.type;
    if (dto.title !== undefined) widget.title = dto.title;
    if (dto.config !== undefined) widget.config = { ...widget.config, ...dto.config };
    if (dto.query_sql !== undefined) widget.query_sql = dto.query_sql;
    if (dto.position !== undefined) widget.position = dto.position;
    if (dto.data_source_id !== undefined) widget.data_source_id = dto.data_source_id;
    return this.widgetRepo.save(widget);
  }

  async remove(orgId: string, dashboardId: string, id: string): Promise<void> {
    const widget = await this.findOne(orgId, dashboardId, id);
    await this.widgetRepo.remove(widget);
  }

  async bulkUpdatePositions(
    orgId: string,
    dashboardId: string,
    dto: BulkUpdatePositionsDto,
  ): Promise<void> {
    const widgetIds = dto.widgets.map((w) => w.id);

    await this.dataSource.transaction(async (manager) => {
      const widgets = await manager.find(Widget, {
        where: { id: In(widgetIds), dashboard_id: dashboardId, org_id: orgId },
      });

      const widgetMap = new Map(widgets.map((w) => [w.id, w]));
      const updates = dto.widgets
        .filter((w) => widgetMap.has(w.id))
        .map((w) => {
          const widget = widgetMap.get(w.id)!;
          widget.position = w.position;
          return widget;
        });

      await manager.save(Widget, updates);
    });
  }
}
