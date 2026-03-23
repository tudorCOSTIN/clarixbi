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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TeamRole } from '../teams/entities/team-member.entity';
import { WidgetsService } from './widgets.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { BulkUpdatePositionsDto } from './dto/bulk-update-positions.dto';

@ApiTags('Widgets')
@ApiBearerAuth()
@Controller('organizations/:orgId/dashboards/:dashboardId/widgets')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Post()
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Create a widget' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'List widgets for a dashboard' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
  ) {
    const widgets = await this.widgetsService.findByDashboard(orgId, dashboardId);
    return { data: widgets };
  }

  @Patch(':id')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Update a widget' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Delete a widget' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Bulk update widget positions' })
  @ApiResponse({ status: 201, description: 'Positions updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async bulkUpdatePositions(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('dashboardId', ParseUUIDPipe) dashboardId: string,
    @Body() dto: BulkUpdatePositionsDto,
  ) {
    await this.widgetsService.bulkUpdatePositions(orgId, dashboardId, dto);
    return { data: { message: 'Positions updated' } };
  }
}
