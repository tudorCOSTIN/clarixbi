import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Res,
  Headers,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { DashboardsService } from './dashboards.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';

@Controller('organizations/:orgId/dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Post()
  async create(@Param('orgId', ParseUUIDPipe) orgId: string, @Body() dto: CreateDashboardDto) {
    // Use a placeholder userId for now (will come from JWT in production)
    const dashboard = await this.dashboardsService.create(orgId, orgId, dto);
    return { data: dashboard };
  }

  @Get()
  async findAll(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const dashboards = await this.dashboardsService.findAll(orgId);
    return { data: dashboards };
  }

  @Get(':id')
  async findOne(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const dashboard = await this.dashboardsService.findOne(orgId, id);
    return { data: dashboard };
  }

  @Patch(':id')
  async update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDashboardDto,
  ) {
    const dashboard = await this.dashboardsService.update(orgId, id, dto);
    return { data: dashboard };
  }

  @Delete(':id')
  async remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.dashboardsService.remove(orgId, id);
    return { data: { message: 'Dashboard deleted' } };
  }

  // ─── SHARING ──────────────────────────────────────────────────

  @Post(':id/share')
  async createShare(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.dashboardsService.createShare(orgId, id, orgId);
    return { data: result };
  }

  @Get(':id/shares')
  async getShares(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const shares = await this.dashboardsService.getShares(orgId, id);
    return { data: shares };
  }

  @Delete(':id/shares/:shareId')
  async revokeShare(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shareId', ParseUUIDPipe) shareId: string,
  ) {
    await this.dashboardsService.revokeShare(orgId, id, shareId);
    return { data: { message: 'Share revoked' } };
  }

  @Delete(':id/shares')
  async revokeAllShares(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-confirm-revoke-all') confirmHeader: string,
  ) {
    if (confirmHeader !== 'true') {
      throw new BadRequestException('Missing X-Confirm-Revoke-All header');
    }
    await this.dashboardsService.revokeAllShares(orgId, id);
    return { data: { message: 'All shares revoked' } };
  }

  // ─── EXPORT ───────────────────────────────────────────────────

  @Post(':id/export')
  async exportDashboard(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('format') format: string,
    @Res() res: Response,
  ) {
    if (format !== 'pdf') {
      throw new BadRequestException('Only PDF format is supported');
    }
    const dashboard = await this.dashboardsService.findOne(orgId, id);
    const pdfBuffer = await this.dashboardsService.exportPdf(orgId, id);
    const filename = `${dashboard.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  // ─── DUPLICATE ────────────────────────────────────────────────

  @Post(':id/duplicate')
  async duplicate(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const dashboard = await this.dashboardsService.duplicate(orgId, id, orgId);
    return { data: dashboard };
  }

  // ─── RESTORE ──────────────────────────────────────────────────

  @Patch(':id/restore')
  async restore(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const dashboard = await this.dashboardsService.restore(orgId, id);
    return { data: dashboard };
  }
}
