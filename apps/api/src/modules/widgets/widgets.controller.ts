import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TeamRole } from '../teams/entities/team-member.entity';
import { WidgetsService } from './widgets.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { BulkUpdatePositionsDto } from './dto/bulk-update-positions.dto';

@Controller('organizations/:orgId/dashboards/:dashboardId/widgets')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Post()
  @Roles(TeamRole.EDITOR)
  async create(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Body() dto: CreateWidgetDto,
  ) {
    const widget = await this.widgetsService.create(orgId, dashboardId, dto);
    return { data: widget };
  }

  @Get()
  @Roles(TeamRole.VIEWER)
  async findAll(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
  ) {
    const widgets = await this.widgetsService.findByDashboard(orgId, dashboardId);
    return { data: widgets };
  }

  @Patch(':id')
  @Roles(TeamRole.EDITOR)
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
  @Roles(TeamRole.EDITOR)
  async remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.widgetsService.remove(orgId, dashboardId, id);
    return { data: { message: 'Widget deleted' } };
  }

  @Post('bulk')
  @Roles(TeamRole.EDITOR)
  async bulkUpdatePositions(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Body() dto: BulkUpdatePositionsDto,
  ) {
    await this.widgetsService.bulkUpdatePositions(orgId, dashboardId, dto);
    return { data: { message: 'Positions updated' } };
  }
}
