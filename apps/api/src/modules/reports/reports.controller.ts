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
  Req,
  NotFoundException,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ScheduleReportDto } from './dto/schedule-report.dto';

@Controller('organizations/:orgId/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  async create(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateReportDto,
    @Req() req: { user?: { id: string } },
  ) {
    const userId = req.user?.id || orgId;
    const report = await this.reportsService.create(orgId, userId, dto);
    return { data: report };
  }

  @Get()
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
  async findOne(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const report = await this.reportsService.findOne(orgId, id);
    return { data: report };
  }

  @Patch(':id')
  async update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportDto,
  ) {
    const report = await this.reportsService.update(orgId, id, dto);
    return { data: report };
  }

  @Delete(':id')
  async remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.reportsService.remove(orgId, id);
    return { data: { message: 'Report deleted' } };
  }

  @Post(':id/generate')
  async generate(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.reportsService.generate(orgId, id);
    return { data: result };
  }

  @Get(':id/download')
  async download(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.reportsService.getLatestDownloadUrl(orgId, id);
    if (!result) throw new NotFoundException('No generated PDF found');
    return { data: result };
  }

  @Get(':id/history')
  async history(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.reportsService.getGeneratedFiles(orgId, id);
    return { data: result.files };
  }

  @Post(':id/schedule')
  async createSchedule(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleReportDto,
  ) {
    const schedule = await this.reportsService.createSchedule(orgId, id, dto);
    return { data: schedule };
  }

  @Delete(':id/schedule')
  async removeSchedule(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.reportsService.removeSchedule(orgId, id);
    return { data: { message: 'Schedule removed' } };
  }
}
