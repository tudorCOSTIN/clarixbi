import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { WidgetsService } from './widgets.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { BulkUpdatePositionsDto } from './dto/bulk-update-positions.dto';

@Controller('organizations/:orgId/dashboards/:dashboardId/widgets')
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Post()
  async create(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Body() dto: CreateWidgetDto,
  ) {
    const widget = await this.widgetsService.create(orgId, dashboardId, dto);
    return { data: widget };
  }

  @Get()
  async findAll(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
  ) {
    const widgets = await this.widgetsService.findByDashboard(orgId, dashboardId);
    return { data: widgets };
  }

  @Patch(':id')
  async update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWidgetDto,
  ) {
    const widget = await this.widgetsService.update(orgId, dashboardId, id, dto);
    return { data: widget };
  }

  @Delete(':id')
  async remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.widgetsService.remove(orgId, dashboardId, id);
    return { data: { message: 'Widget deleted' } };
  }

  @Post('bulk')
  async bulkUpdatePositions(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Body() dto: BulkUpdatePositionsDto,
  ) {
    await this.widgetsService.bulkUpdatePositions(orgId, dashboardId, dto);
    return { data: { message: 'Positions updated' } };
  }
}
