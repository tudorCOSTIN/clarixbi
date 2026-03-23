import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import PDFDocument from 'pdfkit';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardShare } from './entities/dashboard-share.entity';
import { Widget } from '../widgets/entities/widget.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';

@Injectable()
export class DashboardsService {
  private readonly logger = new Logger(DashboardsService.name);

  constructor(
    @InjectRepository(Dashboard)
    private readonly dashboardRepo: Repository<Dashboard>,
    @InjectRepository(DashboardShare)
    private readonly shareRepo: Repository<DashboardShare>,
    @InjectRepository(Widget)
    private readonly widgetRepo: Repository<Widget>,
    private readonly clickhouse: ClickHouseService,
  ) {}

  // ─── EXISTING METHODS (unchanged) ─────────────────────────────

  async create(orgId: string, userId: string, dto: CreateDashboardDto): Promise<Dashboard> {
    const dashboard = this.dashboardRepo.create({
      org_id: orgId,
      created_by: userId,
      name: dto.name,
      description: dto.description || null,
      layout: [],
      is_auto_generated: false,
    });
    return this.dashboardRepo.save(dashboard);
  }

  async findAll(orgId: string): Promise<Dashboard[]> {
    return this.dashboardRepo.find({
      where: { org_id: orgId },
      order: { created_at: 'DESC' },
      relations: ['widgets'],
    });
  }

  async findOne(orgId: string, id: string): Promise<Dashboard> {
    const dashboard = await this.dashboardRepo.findOne({
      where: { id, org_id: orgId },
      relations: ['widgets', 'widgets.data_source'],
    });
    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }
    return dashboard;
  }

  async update(orgId: string, id: string, dto: UpdateDashboardDto): Promise<Dashboard> {
    const dashboard = await this.findOne(orgId, id);
    if (dto.name !== undefined) dashboard.name = dto.name;
    if (dto.description !== undefined) dashboard.description = dto.description;
    if (dto.layout !== undefined) dashboard.layout = dto.layout;
    return this.dashboardRepo.save(dashboard);
  }

  async remove(orgId: string, id: string): Promise<void> {
    const dashboard = await this.findOne(orgId, id);
    await this.dashboardRepo.softRemove(dashboard);
  }

  // ─── SHARING ──────────────────────────────────────────────────

  async createShare(
    orgId: string,
    dashboardId: string,
    userId: string,
  ): Promise<{ token: string; url: string }> {
    await this.findOne(orgId, dashboardId);
    const share = this.shareRepo.create({
      dashboard_id: dashboardId,
      share_token: uuid(),
      created_by: userId,
    });
    const saved = await this.shareRepo.save(share);
    return {
      token: saved.share_token,
      url: `/d/${saved.share_token}`,
    };
  }

  async getShares(orgId: string, dashboardId: string): Promise<DashboardShare[]> {
    await this.findOne(orgId, dashboardId);
    return this.shareRepo.find({
      where: { dashboard_id: dashboardId },
      order: { created_at: 'DESC' },
    });
  }

  async revokeShare(orgId: string, dashboardId: string, shareId: string): Promise<void> {
    await this.findOne(orgId, dashboardId);
    const share = await this.shareRepo.findOne({
      where: { id: shareId, dashboard_id: dashboardId },
    });
    if (!share) {
      throw new NotFoundException('Share not found');
    }
    await this.shareRepo.remove(share);
  }

  async revokeAllShares(orgId: string, dashboardId: string): Promise<void> {
    await this.findOne(orgId, dashboardId);
    const shares = await this.shareRepo.find({
      where: { dashboard_id: dashboardId },
    });
    if (shares.length > 0) {
      await this.shareRepo.remove(shares);
    }
  }

  async getSharedDashboard(shareToken: string): Promise<{
    dashboard: Dashboard;
    widgets: { title: string; type: string; data: Record<string, unknown>[] }[];
  }> {
    const share = await this.shareRepo.findOne({
      where: { share_token: shareToken },
      relations: ['dashboard', 'dashboard.widgets'],
    });
    if (!share) {
      throw new NotFoundException('Dashboard not found');
    }

    // Increment view count
    share.view_count += 1;
    await this.shareRepo.save(share);

    const dashboard = share.dashboard;
    const widgetResults: { title: string; type: string; data: Record<string, unknown>[] }[] = [];

    for (const widget of dashboard.widgets || []) {
      try {
        const data = await this.clickhouse.query(widget.query_sql);
        widgetResults.push({ title: widget.title, type: widget.type, data });
      } catch {
        widgetResults.push({ title: widget.title, type: widget.type, data: [] });
      }
    }

    return { dashboard, widgets: widgetResults };
  }

  // ─── PDF EXPORT ───────────────────────────────────────────────

  async exportPdf(orgId: string, dashboardId: string): Promise<Buffer> {
    const dashboard = await this.findOne(orgId, dashboardId);

    const widgetDataList: { title: string; type: string; data: Record<string, unknown>[] }[] = [];
    for (const widget of dashboard.widgets || []) {
      try {
        const data = await this.clickhouse.query(widget.query_sql);
        widgetDataList.push({ title: widget.title, type: widget.type, data });
      } catch {
        widgetDataList.push({ title: widget.title, type: widget.type, data: [] });
      }
    }

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text(`ClarixBI — ${dashboard.name}`, { align: 'center' });
      doc.fontSize(10).text(`Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(2);

      // Widgets
      for (const widget of widgetDataList) {
        doc.fontSize(14).text(widget.title, { underline: true });
        doc.moveDown(0.5);

        if (widget.data.length === 0) {
          doc.fontSize(10).text('No data available');
        } else {
          const columns = Object.keys(widget.data[0]!);
          // Table header
          doc.fontSize(9).font('Helvetica-Bold');
          doc.text(columns.join('  |  '));
          doc.font('Helvetica');

          // Table rows (max 50 for readability)
          const rows = widget.data.slice(0, 50);
          for (const row of rows) {
            const values = columns.map((c) => String(row[c] ?? ''));
            doc.fontSize(8).text(values.join('  |  '));
          }
          if (widget.data.length > 50) {
            doc.fontSize(8).text(`... and ${widget.data.length - 50} more rows`);
          }
        }
        doc.moveDown(1);
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).text('Generated by ClarixBI', { align: 'center' });

      doc.end();
    });
  }

  // ─── DUPLICATE / CLONE ────────────────────────────────────────

  async duplicate(orgId: string, dashboardId: string, userId: string): Promise<Dashboard> {
    const original = await this.findOne(orgId, dashboardId);

    const newDashboard = this.dashboardRepo.create({
      org_id: orgId,
      created_by: userId,
      name: `${original.name} (copie)`,
      description: original.description,
      layout: original.layout,
      is_auto_generated: false,
    });
    const saved = await this.dashboardRepo.save(newDashboard);

    // Clone all widgets
    for (const widget of original.widgets || []) {
      const newWidget = this.widgetRepo.create({
        dashboard_id: saved.id,
        org_id: orgId,
        type: widget.type,
        title: widget.title,
        config: widget.config,
        query_sql: widget.query_sql,
        position: widget.position,
        data_source_id: widget.data_source_id,
      });
      await this.widgetRepo.save(newWidget);
    }

    return this.findOne(orgId, saved.id);
  }

  // ─── RESTORE ──────────────────────────────────────────────────

  async restore(orgId: string, dashboardId: string): Promise<Dashboard> {
    const dashboard = await this.dashboardRepo.findOne({
      where: { id: dashboardId, org_id: orgId },
      withDeleted: true,
    });
    if (!dashboard || !dashboard.deleted_at) {
      throw new NotFoundException('Deleted dashboard not found');
    }
    await this.dashboardRepo.recover(dashboard);
    return this.findOne(orgId, dashboardId);
  }
}
