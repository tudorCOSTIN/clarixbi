import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
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
}
