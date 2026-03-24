import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  Headers,
  ParseUUIDPipe,
  BadRequestException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TeamRole } from '../teams/entities/team-member.entity';
import { PlanLimitGuard } from '../billing/guards/plan-limit.guard';
import { CheckPlanLimit } from '../billing/decorators/requires-plan.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { DashboardsService } from './dashboards.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Dashboards')
@ApiBearerAuth()
@Controller('organizations/:orgId/dashboards')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Post()
  @Roles(TeamRole.EDITOR)
  @UseGuards(PlanLimitGuard)
  @CheckPlanLimit('dashboards')
  @ApiOperation({ summary: 'Create a new dashboard' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDashboardDto,
  ) {
    const dashboard = await this.dashboardsService.create(orgId, user.id, dto);
    return { data: dashboard };
  }

  @Get()
  @Roles(TeamRole.VIEWER)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  @ApiOperation({ summary: 'List all dashboards' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Param('orgId', ParseUUIDPipe) orgId: string, @Query() query: PaginationDto) {
    const result = await this.dashboardsService.findAll(orgId, query.page, query.limit);
    return {
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @Get(':id')
  @Roles(TeamRole.VIEWER)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(10)
  @ApiOperation({ summary: 'Get dashboard by ID' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const dashboard = await this.dashboardsService.findOne(orgId, id);
    return { data: dashboard };
  }

  @Patch(':id')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Update a dashboard' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDashboardDto,
  ) {
    const dashboard = await this.dashboardsService.update(orgId, id, dto);
    return { data: dashboard };
  }

  @Delete(':id')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Delete a dashboard' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.dashboardsService.remove(orgId, id);
    return { data: { message: 'Dashboard deleted' } };
  }

  // ─── SHARING ──────────────────────────────────────────────────

  @Post(':id/share')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Create a share link for dashboard' })
  @ApiResponse({ status: 201, description: 'Share created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createShare(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.dashboardsService.createShare(orgId, id, user.id);
    return { data: result };
  }

  @Get(':id/shares')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'List shares for a dashboard' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getShares(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const shares = await this.dashboardsService.getShares(orgId, id);
    return { data: shares };
  }

  @Delete(':id/shares/:shareId')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Revoke a specific share' })
  @ApiResponse({ status: 200, description: 'Share revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async revokeShare(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shareId', ParseUUIDPipe) shareId: string,
  ) {
    await this.dashboardsService.revokeShare(orgId, id, shareId);
    return { data: { message: 'Share revoked' } };
  }

  @Delete(':id/shares')
  @Roles(TeamRole.ADMIN)
  @ApiOperation({ summary: 'Revoke all shares for a dashboard' })
  @ApiResponse({ status: 200, description: 'All shares revoked' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Export dashboard as PDF' })
  @ApiResponse({ status: 200, description: 'PDF exported' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @Roles(TeamRole.EDITOR)
  @UseGuards(PlanLimitGuard)
  @CheckPlanLimit('dashboards')
  @ApiOperation({ summary: 'Duplicate a dashboard' })
  @ApiResponse({ status: 201, description: 'Dashboard duplicated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async duplicate(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const dashboard = await this.dashboardsService.duplicate(orgId, id, user.id);
    return { data: dashboard };
  }

  // ─── RESTORE ──────────────────────────────────────────────────

  @Patch(':id/restore')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Restore a soft-deleted dashboard' })
  @ApiResponse({ status: 200, description: 'Restored' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async restore(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const dashboard = await this.dashboardsService.restore(orgId, id);
    return { data: dashboard };
  }
}
