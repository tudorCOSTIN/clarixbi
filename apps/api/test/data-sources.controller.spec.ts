import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, CanActivate } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSourcesController } from '../src/modules/data-sources/data-sources.controller';
import { DataSourcesService } from '../src/modules/data-sources/data-sources.service';
import { SyncJob } from '../src/modules/sync/entities/sync-job.entity';
import { DataSourceType } from '../src/modules/data-sources/entities/data-source.entity';
import { CreateDataSourceDto } from '../src/modules/data-sources/dto/create-data-source.dto';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../src/modules/auth/guards/org-member.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { PlanLimitGuard } from '../src/modules/billing/guards/plan-limit.guard';

describe('DataSourcesController', () => {
  let controller: DataSourcesController;
  let service: jest.Mocked<Record<string, jest.Mock>>;
  let syncJobRepo: { findAndCount: jest.Mock };

  const orgId = '11111111-1111-1111-1111-111111111111';
  const dsId = '22222222-2222-2222-2222-222222222222';

  const mockDataSource = {
    id: dsId,
    org_id: orgId,
    type: DataSourceType.SMARTBILL,
    name: 'Test SmartBill',
    status: 'active',
    config: {},
    created_at: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      addDataSource: jest.fn(),
      addCsvDataSource: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      testConnection: jest.fn(),
      triggerSync: jest.fn(),
      updateDataSource: jest.fn(),
      deleteDataSource: jest.fn(),
    };

    syncJobRepo = {
      findAndCount: jest.fn(),
    };

    const mockGuard: CanActivate = { canActivate: () => true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataSourcesController],
      providers: [
        { provide: DataSourcesService, useValue: mockService },
        { provide: getRepositoryToken(SyncJob), useValue: syncJobRepo },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(OrgMemberGuard)
      .useValue(mockGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockGuard)
      .overrideGuard(PlanLimitGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<DataSourcesController>(DataSourcesController);
    service = mockService as unknown as jest.Mocked<Record<string, jest.Mock>>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // 1. create - success creates data source
  it('create - success creates data source', async () => {
    const dto: CreateDataSourceDto = {
      type: DataSourceType.SMARTBILL,
      name: 'My SmartBill',
      credentials: { email: 'test@example.com', token: 'abc123' },
    };
    service.addDataSource.mockResolvedValue(mockDataSource);

    const result = await controller.create(orgId, dto);

    expect(result).toEqual({ data: mockDataSource });
    expect(service.addDataSource).toHaveBeenCalledWith(orgId, dto);
  });

  // 2. create - validates dto (service throws on invalid input)
  it('create - validates dto by propagating service errors', async () => {
    const dto: CreateDataSourceDto = {
      type: DataSourceType.SMARTBILL,
      name: '',
      credentials: {},
    };
    service.addDataSource.mockRejectedValue(
      new BadRequestException('Credentiale invalide. Nu am putut conecta.'),
    );

    await expect(controller.create(orgId, dto)).rejects.toThrow(BadRequestException);
    expect(service.addDataSource).toHaveBeenCalledWith(orgId, dto);
  });

  // 3. upload - success processes CSV file
  it('upload - success processes CSV file', async () => {
    const csvDataSource = { ...mockDataSource, type: DataSourceType.CSV, name: 'sales.csv' };
    service.addCsvDataSource.mockResolvedValue(csvDataSource);

    const mockFile = {
      originalname: 'sales.csv',
      buffer: Buffer.from('col1,col2\nval1,val2'),
      mimetype: 'text/csv',
    } as Express.Multer.File;

    const result = await controller.upload(orgId, mockFile, 'Sales Data');

    expect(result).toEqual({ data: csvDataSource });
    expect(service.addCsvDataSource).toHaveBeenCalledWith(
      orgId,
      'Sales Data',
      mockFile.buffer,
      'sales.csv',
    );
  });

  // 4. upload - rejects when no file provided
  it('upload - rejects invalid file type (no file)', async () => {
    await expect(
      controller.upload(orgId, undefined as unknown as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
  });

  // 5. findAll - returns list of data sources
  it('findAll - returns list of data sources', async () => {
    const dataSources = [mockDataSource, { ...mockDataSource, id: 'other-id', name: 'DS 2' }];
    service.findAll.mockResolvedValue(dataSources);

    const result = await controller.findAll(orgId);

    expect(result).toEqual({ data: dataSources });
    expect(service.findAll).toHaveBeenCalledWith(orgId);
  });

  // 6. findOne - returns single data source
  it('findOne - returns single data source', async () => {
    service.findOne.mockResolvedValue(mockDataSource);

    const result = await controller.findOne(orgId, dsId);

    expect(result).toEqual({ data: mockDataSource });
    expect(service.findOne).toHaveBeenCalledWith(orgId, dsId);
  });

  // 7. findOne - throws NotFoundException
  it('findOne - throws NotFoundException', async () => {
    service.findOne.mockRejectedValue(new NotFoundException('Data source not found'));

    await expect(controller.findOne(orgId, dsId)).rejects.toThrow(NotFoundException);
  });

  // 8. testConnection - success returns ok
  it('testConnection - success returns ok', async () => {
    service.testConnection.mockResolvedValue(true);

    const result = await controller.testConnection(orgId, dsId);

    expect(result).toEqual({ data: { connected: true } });
    expect(service.testConnection).toHaveBeenCalledWith(orgId, dsId);
  });

  // 9. triggerSync - success triggers sync
  it('triggerSync - success triggers sync', async () => {
    service.triggerSync.mockResolvedValue(undefined);

    const result = await controller.triggerSync(orgId, dsId);

    expect(result).toEqual({ data: { message: 'Sync started' } });
    expect(service.triggerSync).toHaveBeenCalledWith(orgId, dsId);
  });

  // 10. update - success updates data source
  it('update - success updates data source', async () => {
    const updated = { ...mockDataSource, name: 'Updated Name' };
    service.updateDataSource.mockResolvedValue(updated);

    const dto = { name: 'Updated Name', sync_interval_minutes: 30 };
    const result = await controller.updateDataSource(orgId, dsId, dto);

    expect(result).toEqual({ data: updated });
    expect(service.updateDataSource).toHaveBeenCalledWith(orgId, dsId, dto);
  });

  // 11. remove - success deletes data source
  it('remove - success deletes data source', async () => {
    service.deleteDataSource.mockResolvedValue(undefined);

    const result = await controller.deleteDataSource(orgId, dsId);

    expect(result).toEqual({ data: { message: 'Data source deleted' } });
    expect(service.deleteDataSource).toHaveBeenCalledWith(orgId, dsId);
  });

  // 12. getLogs - returns paginated sync logs
  it('getLogs - returns paginated sync logs', async () => {
    const mockLogs = [
      { id: 'log-1', data_source_id: dsId, status: 'completed', created_at: new Date() },
      { id: 'log-2', data_source_id: dsId, status: 'failed', created_at: new Date() },
    ];
    syncJobRepo.findAndCount.mockResolvedValue([mockLogs, 2]);

    const result = await controller.getSyncLogs(orgId, dsId, 1, 20);

    expect(result).toEqual({ data: mockLogs, total: 2, page: 1, limit: 20 });
    expect(syncJobRepo.findAndCount).toHaveBeenCalledWith({
      where: { data_source_id: dsId, org_id: orgId },
      order: { created_at: 'DESC' },
      take: 20,
      skip: 0,
    });
  });
});
