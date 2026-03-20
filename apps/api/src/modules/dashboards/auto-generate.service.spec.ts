import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { AutoGenerateService } from './auto-generate.service';
import { Dashboard, DashboardSourceType } from './entities/dashboard.entity';
import { Widget, WidgetType } from '../widgets/entities/widget.entity';
import { DataSourceEntity, DataSourceType } from '../data-sources/entities/data-source.entity';

describe('AutoGenerateService', () => {
  let service: AutoGenerateService;
  let dashboardRepo: jest.Mocked<Repository<Dashboard>>;
  let widgetRepo: jest.Mocked<Repository<Widget>>;
  let dataSourceRepo: jest.Mocked<Repository<DataSourceEntity>>;

  const orgId = uuid();
  const userId = uuid();
  const dataSourceId = uuid();
  const dashboardId = uuid();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoGenerateService,
        {
          provide: getRepositoryToken(Dashboard),
          useValue: {
            create: jest.fn((dto) => ({ id: dashboardId, ...dto })),
            save: jest.fn((entity) => Promise.resolve({ ...entity, id: entity.id || dashboardId })),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Widget),
          useValue: {
            create: jest.fn((dto) => ({ id: uuid(), ...dto })),
            save: jest.fn((entities) => {
              if (Array.isArray(entities)) {
                return Promise.resolve(entities);
              }
              return Promise.resolve(entities);
            }),
          },
        },
        {
          provide: getRepositoryToken(DataSourceEntity),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AutoGenerateService>(AutoGenerateService);
    dashboardRepo = module.get(getRepositoryToken(Dashboard));
    widgetRepo = module.get(getRepositoryToken(Widget));
    dataSourceRepo = module.get(getRepositoryToken(DataSourceEntity));
  });

  function mockDataSource(
    type: DataSourceType,
    config: Record<string, unknown> = {},
  ): DataSourceEntity {
    return {
      id: dataSourceId,
      org_id: orgId,
      type,
      name: 'Test Source',
      credentials_encrypted: null,
      config,
      status: 'active' as any,
      last_sync_at: null,
      total_rows: 0,
      sync_interval_minutes: 15,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      organization: null as any,
      sync_jobs: [],
    };
  }

  describe('autoGenerate', () => {
    describe('data source not found', () => {
      it('should throw NotFoundException when data source does not exist', async () => {
        dataSourceRepo.findOne.mockResolvedValue(null);

        await expect(
          service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.SMARTBILL),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.SMARTBILL),
        ).rejects.toThrow('Data source not found');
      });
    });

    describe('SmartBill template', () => {
      beforeEach(() => {
        dataSourceRepo.findOne.mockResolvedValue(mockDataSource(DataSourceType.SMARTBILL));
        dashboardRepo.findOne.mockResolvedValue({
          id: dashboardId,
          widgets: [],
        } as any);
      });

      it('should create a dashboard with is_auto_generated = true', async () => {
        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.SMARTBILL);

        expect(dashboardRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            org_id: orgId,
            created_by: userId,
            is_auto_generated: true,
            source_type: DashboardSourceType.SMARTBILL,
          }),
        );
        expect(dashboardRepo.save).toHaveBeenCalled();
      });

      it('should create exactly 5 widgets for SmartBill', async () => {
        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.SMARTBILL);

        // widgetRepo.create should be called 5 times (via map)
        expect(widgetRepo.create).toHaveBeenCalledTimes(5);
        expect(widgetRepo.save).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ type: WidgetType.KPI }),
            expect.objectContaining({ type: WidgetType.LINE }),
            expect.objectContaining({ type: WidgetType.BAR }),
            expect.objectContaining({ type: WidgetType.TABLE }),
            expect.objectContaining({ type: WidgetType.PIE }),
          ]),
        );
      });

      it('should create widgets with correct titles', async () => {
        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.SMARTBILL);

        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Total Revenue', type: WidgetType.KPI }),
        );
        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Monthly Revenue', type: WidgetType.LINE }),
        );
        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Top Clients', type: WidgetType.BAR }),
        );
        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Recent Invoices', type: WidgetType.TABLE }),
        );
        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Payment Status', type: WidgetType.PIE }),
        );
      });

      it('should set data_source_id on all widgets', async () => {
        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.SMARTBILL);

        for (const call of widgetRepo.create.mock.calls) {
          expect(call[0]).toMatchObject({ data_source_id: dataSourceId });
        }
      });

      it('should set dashboard_id and org_id on all widgets', async () => {
        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.SMARTBILL);

        for (const call of widgetRepo.create.mock.calls) {
          expect(call[0]).toMatchObject({
            dashboard_id: dashboardId,
            org_id: orgId,
          });
        }
      });
    });

    describe('WooCommerce template', () => {
      beforeEach(() => {
        dataSourceRepo.findOne.mockResolvedValue(mockDataSource(DataSourceType.WOOCOMMERCE));
        dashboardRepo.findOne.mockResolvedValue({
          id: dashboardId,
          widgets: [],
        } as any);
      });

      it('should create exactly 5 widgets for WooCommerce', async () => {
        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.WOOCOMMERCE);

        expect(widgetRepo.create).toHaveBeenCalledTimes(5);
      });

      it('should set source_type to WOOCOMMERCE', async () => {
        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.WOOCOMMERCE);

        expect(dashboardRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ source_type: DashboardSourceType.WOOCOMMERCE }),
        );
      });

      it('should create WooCommerce-specific widgets', async () => {
        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.WOOCOMMERCE);

        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Total Orders', type: WidgetType.KPI }),
        );
        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Revenue Over Time', type: WidgetType.LINE }),
        );
        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Top Products', type: WidgetType.BAR }),
        );
        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Recent Orders', type: WidgetType.TABLE }),
        );
        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Order Status', type: WidgetType.PIE }),
        );
      });

      it('should configure WooCommerce widgets with orders table', async () => {
        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.WOOCOMMERCE);

        // KPI widget uses orders table
        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: WidgetType.KPI,
            config: expect.objectContaining({ table: 'orders', aggregation: 'COUNT' }),
          }),
        );
      });
    });

    describe('CSV template', () => {
      it('should create at least 2 widgets when columns are provided', async () => {
        const columns = ['amount', 'category', 'date', 'status'];
        dataSourceRepo.findOne.mockResolvedValue(mockDataSource(DataSourceType.CSV, { columns }));
        dashboardRepo.findOne.mockResolvedValue({
          id: dashboardId,
          widgets: [],
        } as any);

        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.CSV);

        // KPI + TABLE = 2 widgets minimum
        expect(widgetRepo.create).toHaveBeenCalledTimes(2);
      });

      it('should create a KPI widget using the first numeric-pattern column', async () => {
        const columns = ['name', 'total_price', 'category'];
        dataSourceRepo.findOne.mockResolvedValue(mockDataSource(DataSourceType.CSV, { columns }));
        dashboardRepo.findOne.mockResolvedValue({
          id: dashboardId,
          widgets: [],
        } as any);

        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.CSV);

        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: WidgetType.KPI,
            title: 'Total total_price',
            config: expect.objectContaining({
              metric: 'total_price',
              aggregation: 'SUM',
              table: 'csv_data',
            }),
          }),
        );
      });

      it('should create a TABLE widget with all columns (up to 10)', async () => {
        const columns = ['col1', 'col2', 'col3'];
        dataSourceRepo.findOne.mockResolvedValue(mockDataSource(DataSourceType.CSV, { columns }));
        dashboardRepo.findOne.mockResolvedValue({
          id: dashboardId,
          widgets: [],
        } as any);

        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.CSV);

        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: WidgetType.TABLE,
            title: 'All Data',
            config: expect.objectContaining({
              columns: ['col1', 'col2', 'col3'],
              table: 'csv_data',
            }),
          }),
        );
      });

      it('should set source_type to CSV', async () => {
        dataSourceRepo.findOne.mockResolvedValue(
          mockDataSource(DataSourceType.CSV, { columns: ['a'] }),
        );
        dashboardRepo.findOne.mockResolvedValue({
          id: dashboardId,
          widgets: [],
        } as any);

        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.CSV);

        expect(dashboardRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ source_type: DashboardSourceType.CSV }),
        );
      });

      it('should fallback to first column for KPI when no numeric-pattern column found', async () => {
        const columns = ['name', 'email', 'city'];
        dataSourceRepo.findOne.mockResolvedValue(mockDataSource(DataSourceType.CSV, { columns }));
        dashboardRepo.findOne.mockResolvedValue({
          id: dashboardId,
          widgets: [],
        } as any);

        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.CSV);

        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: WidgetType.KPI,
            config: expect.objectContaining({ metric: 'name' }),
          }),
        );
      });

      it('should handle empty columns array gracefully', async () => {
        dataSourceRepo.findOne.mockResolvedValue(
          mockDataSource(DataSourceType.CSV, { columns: [] }),
        );
        dashboardRepo.findOne.mockResolvedValue({
          id: dashboardId,
          widgets: [],
        } as any);

        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.CSV);

        // With empty columns, numericCol is undefined (columns[0] is undefined),
        // so only the TABLE widget is created
        expect(widgetRepo.create).toHaveBeenCalledTimes(1);
        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: WidgetType.TABLE,
            config: expect.objectContaining({ columns: ['*'] }),
          }),
        );
      });
    });

    describe('template selection by dataSourceType', () => {
      beforeEach(() => {
        dashboardRepo.findOne.mockResolvedValue({
          id: dashboardId,
          widgets: [],
        } as any);
      });

      it('should use SmartBill template for SMARTBILL type', async () => {
        dataSourceRepo.findOne.mockResolvedValue(mockDataSource(DataSourceType.SMARTBILL));

        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.SMARTBILL);

        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Total Revenue' }),
        );
      });

      it('should use WooCommerce template for WOOCOMMERCE type', async () => {
        dataSourceRepo.findOne.mockResolvedValue(mockDataSource(DataSourceType.WOOCOMMERCE));

        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.WOOCOMMERCE);

        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Total Orders' }),
        );
      });

      it('should use SmartBill template as default for unknown types', async () => {
        dataSourceRepo.findOne.mockResolvedValue(mockDataSource(DataSourceType.EFACTURA));

        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.EFACTURA);

        // EFACTURA falls to default case which uses SmartBill template
        expect(widgetRepo.create).toHaveBeenCalledTimes(5);
        expect(widgetRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Total Revenue' }),
        );
      });
    });

    describe('dashboard metadata', () => {
      it('should set dashboard name from data source name', async () => {
        dataSourceRepo.findOne.mockResolvedValue(mockDataSource(DataSourceType.SMARTBILL));
        dashboardRepo.findOne.mockResolvedValue({
          id: dashboardId,
          widgets: [],
        } as any);

        await service.autoGenerate(orgId, userId, dataSourceId, DataSourceType.SMARTBILL);

        expect(dashboardRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Source \u2014 Auto Dashboard',
            description: 'Auto-generated dashboard for Test Source',
          }),
        );
      });

      it('should return the dashboard with widgets relation', async () => {
        dataSourceRepo.findOne.mockResolvedValue(mockDataSource(DataSourceType.SMARTBILL));
        const fullDashboard = { id: dashboardId, widgets: [{ id: 'w1' }] };
        dashboardRepo.findOne.mockResolvedValue(fullDashboard as any);

        const result = await service.autoGenerate(
          orgId,
          userId,
          dataSourceId,
          DataSourceType.SMARTBILL,
        );

        expect(dashboardRepo.findOne).toHaveBeenCalledWith({
          where: { id: dashboardId, org_id: orgId },
          relations: ['widgets'],
        });
        expect(result).toEqual(fullDashboard);
      });
    });
  });
});
