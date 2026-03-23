import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { TeamRole } from '../teams/entities/team-member.entity';
import { PlanLimitGuard } from '../billing/guards/plan-limit.guard';
import { CheckPlanLimit } from '../billing/decorators/requires-plan.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { ToggleAlertDto } from './dto/toggle-alert.dto';

@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('organizations/:orgId/alerts')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @Roles(TeamRole.EDITOR)
  @UseGuards(PlanLimitGuard)
  @CheckPlanLimit('alerts')
  @ApiOperation({ summary: 'Create a new alert' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateAlertDto,
    @CurrentUser() user: JwtUser,
  ) {
    const alert = await this.alertsService.create(orgId, user.id, dto);
    return { data: alert };
  }

  @Get()
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'List alerts for organization' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async list(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.alertsService.list(
      orgId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return { data: result.data, total: result.total };
  }

  @Get(':id')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Get alert by ID' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const alert = await this.alertsService.findOne(orgId, id);
    return { data: alert };
  }

  @Patch(':id')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Update an alert' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    const alert = await this.alertsService.update(orgId, id, dto);
    return { data: alert };
  }

  @Delete(':id')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Delete an alert' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.alertsService.remove(orgId, id);
    return { data: { message: 'Alert deleted' } };
  }

  @Patch(':id/toggle')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Toggle alert active state' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async toggle(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleAlertDto,
  ) {
    const alert = await this.alertsService.toggle(orgId, id, dto.isActive);
    return { data: alert };
  }

  @Post(':id/test')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Test an alert' })
  @ApiResponse({ status: 201, description: 'Test executed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async test(@Param('orgId', ParseUUIDPipe) orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.alertsService.test(orgId, id);
    return { data: result };
  }

  @Get(':id/triggers')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Get alert trigger history' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async triggers(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.alertsService.getTriggerHistory(
      orgId,
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return { data: result.data, total: result.total };
  }
}
