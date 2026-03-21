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
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { TeamRole } from '../teams/entities/team-member.entity';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ScheduleReportDto } from './dto/schedule-report.dto';

@Controller('organizations/:orgId/reports')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @Roles(TeamRole.EDITOR)
  async create(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateReportDto,
    @CurrentUser() user: JwtUser,
  ) {
    const report = await this.reportsService.create(orgId, user.id, dto);
    return { data: report };
  }

  @Get()
  @Roles(TeamRole.VIEWER)
  async list(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.reportsService.list(
      orgId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return { data: result.data, total: result.total };
  }

  @Get(':id')
  @Roles(TeamRole.VIEWER)
  async findOne(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const report = await this.reportsService.findOne(orgId, id);
    return { data: report };
  }

  @Patch(':id')
  @Roles(TeamRole.EDITOR)
  async update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportDto,
  ) {
    const report = await this.reportsService.update(orgId, id, dto);
    return { data: report };
  }

  @Delete(':id')
  @Roles(TeamRole.EDITOR)
  async remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.reportsService.remove(orgId, id);
    return { data: { message: 'Report deleted' } };
  }

  @Post(':id/generate')
  @Roles(TeamRole.EDITOR)
  async generate(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.reportsService.generate(orgId, id);
    return { data: result };
  }

  @Get(':id/download')
  @Roles(TeamRole.VIEWER)
  async download(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.reportsService.getLatestDownloadUrl(orgId, id);
    if (!result) throw new NotFoundException('No generated PDF found');
    return { data: result };
  }

  @Get(':id/history')
  @Roles(TeamRole.VIEWER)
  async history(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.reportsService.getGeneratedFiles(orgId, id);
    return { data: result.files };
  }

  @Post(':id/schedule')
  @Roles(TeamRole.ADMIN)
  async createSchedule(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleReportDto,
  ) {
    const schedule = await this.reportsService.createSchedule(orgId, id, dto);
    return { data: schedule };
  }

  @Delete(':id/schedule')
  @Roles(TeamRole.ADMIN)
  async removeSchedule(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.reportsService.removeSchedule(orgId, id);
    return { data: { message: 'Schedule removed' } };
  }
}
