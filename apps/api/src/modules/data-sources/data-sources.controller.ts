import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSourcesService } from './data-sources.service';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { SyncJob } from '../sync/entities/sync-job.entity';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

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

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
        if (ALLOWED_EXTENSIONS.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Format invalid. Acceptam: .csv, .xlsx, .xls'), false);
        }
      },
    }),
  )
  async upload(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Fisierul lipseste');
    }

    const ds = await this.dataSourcesService.addCsvDataSource(
      orgId,
      name || file.originalname,
      file.buffer,
      file.originalname,
    );
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

  @Get(':id/preview')
  async preview(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.dataSourcesService.getPreview(orgId, id);
    return { data: result };
  }

  @Patch(':id/schema')
  async updateSchema(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('schema') schema: { name: string; type: string; sampleValues: string[] }[],
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.dataSourcesService.updateSchema(orgId, id, schema as any);
    return { data: { message: 'Schema updated' } };
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
