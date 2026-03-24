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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TeamRole } from '../teams/entities/team-member.entity';
import { PlanLimitGuard } from '../billing/guards/plan-limit.guard';
import { CheckPlanLimit } from '../billing/decorators/requires-plan.decorator';
import { DataSourcesService } from './data-sources.service';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto';
import { SyncJob } from '../sync/entities/sync-job.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

@ApiTags('Data Sources')
@ApiBearerAuth()
@Controller('organizations/:orgId/data-sources')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class DataSourcesController {
  constructor(
    private readonly dataSourcesService: DataSourcesService,
    @InjectRepository(SyncJob)
    private readonly syncJobRepo: Repository<SyncJob>,
  ) {}

  @Post()
  @Roles(TeamRole.EDITOR)
  @UseGuards(PlanLimitGuard)
  @CheckPlanLimit('data_sources')
  @ApiOperation({ summary: 'Create a new data source' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Param('orgId', ParseUUIDPipe) orgId: string, @Body() dto: CreateDataSourceDto) {
    const ds = await this.dataSourcesService.addDataSource(orgId, dto);
    return { data: ds };
  }

  @Post('upload')
  @Roles(TeamRole.EDITOR)
  @UseGuards(PlanLimitGuard)
  @CheckPlanLimit('data_sources')
  @ApiOperation({ summary: 'Upload a CSV/Excel file as data source' })
  @ApiResponse({ status: 201, description: 'File uploaded' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @Roles(TeamRole.VIEWER)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  @ApiOperation({ summary: 'List all data sources' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Param('orgId', ParseUUIDPipe) orgId: string, @Query() query: PaginationDto) {
    const result = await this.dataSourcesService.findAll(orgId, query.page, query.limit);
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
  @ApiOperation({ summary: 'Get data source by ID' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const ds = await this.dataSourcesService.findOne(orgId, id);
    return { data: ds };
  }

  @Get(':id/preview')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Preview data source content' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async preview(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.dataSourcesService.getPreview(orgId, id);
    return { data: result };
  }

  @Patch(':id/schema')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Update data source schema' })
  @ApiResponse({ status: 200, description: 'Schema updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Test data source connection' })
  @ApiResponse({ status: 201, description: 'Connection tested' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async testConnection(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const ok = await this.dataSourcesService.testConnection(orgId, id);
    return { data: { connected: ok } };
  }

  @Post(':id/sync')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Trigger data source sync' })
  @ApiResponse({ status: 201, description: 'Sync started' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async triggerSync(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.dataSourcesService.triggerSync(orgId, id);
    return { data: { message: 'Sync started' } };
  }

  @Get(':id/columns')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Get data source columns' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getColumns(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const columns = await this.dataSourcesService.getColumns(orgId, id);
    return { data: columns };
  }

  @Get(':id/logs')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Get sync job logs' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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

  @Patch(':id')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Update data source name or sync interval' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateDataSource(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDataSourceDto,
  ) {
    const ds = await this.dataSourcesService.updateDataSource(orgId, id, dto);
    return { data: ds };
  }

  @Delete(':id')
  @Roles(TeamRole.ADMIN)
  @ApiOperation({ summary: 'Delete a data source' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteDataSource(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.dataSourcesService.deleteDataSource(orgId, id);
    return { data: { message: 'Data source deleted' } };
  }
}
