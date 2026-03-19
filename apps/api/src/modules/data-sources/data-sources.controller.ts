import { Controller, Get, Post, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSourcesService } from './data-sources.service';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { SyncJob } from '../sync/entities/sync-job.entity';

@Controller('organizations/:orgId/data-sources')
export class DataSourcesController {
  constructor(
    private readonly dataSourcesService: DataSourcesService,
    @InjectRepository(SyncJob)
    private readonly syncJobRepo: Repository<SyncJob>,
  ) {}

  @Post()
  async create(@Param('orgId', ParseUUIDPipe) orgId: string, @Body() dto: CreateDataSourceDto) {
    const ds = await this.dataSourcesService.addDataSource(orgId, dto);
    return { data: ds };
  }

  @Get()
  async findAll(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const dataSources = await this.dataSourcesService.findAll(orgId);
    return { data: dataSources };
  }

  @Get(':id')
  async findOne(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const ds = await this.dataSourcesService.findOne(orgId, id);
    return { data: ds };
  }

  @Post(':id/test')
  async testConnection(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const ok = await this.dataSourcesService.testConnection(orgId, id);
    return { data: { connected: ok } };
  }

  @Post(':id/sync')
  async triggerSync(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.dataSourcesService.triggerSync(orgId, id);
    return { data: { message: 'Sync started' } };
  }

  @Get(':id/logs')
  async getSyncLogs(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const [logs, total] = await this.syncJobRepo.findAndCount({
      where: { data_source_id: id, org_id: orgId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return { data: logs, total, page, limit };
  }
}
