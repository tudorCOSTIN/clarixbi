import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { DashboardsService } from './dashboards.service';
import { Dashboard } from './entities/dashboard.entity';

describe('DashboardsService', () => {
  let service: DashboardsService;
  let repo: jest.Mocked<Repository<Dashboard>>;

  const orgId = uuid();
  const userId = uuid();
  const dashboardId = uuid();

  const mockDashboard: Dashboard = {
    id: dashboardId,
    org_id: orgId,
    created_by: userId,
    name: 'Sales Dashboard',
    description: 'Monthly sales overview',
    layout: [],
    is_auto_generated: false,
    source_type: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    organization: null as any,
    creator: null as any,
    widgets: [],
    shares: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardsService,
        {
          provide: getRepositoryToken(Dashboard),
          useValue: {
            create: jest.fn((dto) => ({ ...mockDashboard, ...dto })),
            save: jest.fn((entity) => Promise.resolve({ ...mockDashboard, ...entity })),
            find: jest.fn(),
            findOne: jest.fn(),
            softRemove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DashboardsService>(DashboardsService);
    repo = module.get(getRepositoryToken(Dashboard));
  });

  describe('create', () => {
    it('should create a dashboard with orgId, userId, and dto', async () => {
      const dto = { name: 'New Dashboard', description: 'Description here' };

      const result = await service.create(orgId, userId, dto);

      expect(repo.create).toHaveBeenCalledWith({
        org_id: orgId,
        created_by: userId,
        name: dto.name,
        description: dto.description,
        layout: [],
        is_auto_generated: false,
      });
      expect(repo.save).toHaveBeenCalled();
      expect(result.name).toBe(dto.name);
      expect(result.org_id).toBe(orgId);
    });

    it('should set description to null when not provided', async () => {
      const dto = { name: 'No Desc' };

      await service.create(orgId, userId, dto);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
    });
  });

  describe('findAll', () => {
    it('should return dashboards with widgets relation ordered by created_at DESC', async () => {
      const dashboards = [mockDashboard, { ...mockDashboard, id: uuid(), name: 'Second' }];
      repo.find.mockResolvedValue(dashboards as Dashboard[]);

      const result = await service.findAll(orgId);

      expect(repo.find).toHaveBeenCalledWith({
        where: { org_id: orgId },
        order: { created_at: 'DESC' },
        relations: ['widgets'],
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no dashboards exist', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findAll(orgId);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a dashboard with widgets and data_source relations', async () => {
      repo.findOne.mockResolvedValue(mockDashboard);

      const result = await service.findOne(orgId, dashboardId);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: dashboardId, org_id: orgId },
        relations: ['widgets', 'widgets.data_source'],
      });
      expect(result).toEqual(mockDashboard);
    });

    it('should throw NotFoundException when dashboard is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(orgId, 'nonexistent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findOne(orgId, 'nonexistent-id')).rejects.toThrow('Dashboard not found');
    });
  });

  describe('update', () => {
    it('should update name only', async () => {
      repo.findOne.mockResolvedValue({ ...mockDashboard });

      const result = await service.update(orgId, dashboardId, { name: 'Updated Name' });

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated Name' }));
      expect(result.name).toBe('Updated Name');
    });

    it('should update description only', async () => {
      repo.findOne.mockResolvedValue({ ...mockDashboard });

      await service.update(orgId, dashboardId, { description: 'New description' });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'New description' }),
      );
    });

    it('should update layout only', async () => {
      repo.findOne.mockResolvedValue({ ...mockDashboard });
      const newLayout = [{ i: 'w1', x: 0, y: 0, w: 6, h: 4 }];

      await service.update(orgId, dashboardId, { layout: newLayout as any });

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ layout: newLayout }));
    });

    it('should update multiple fields at once', async () => {
      repo.findOne.mockResolvedValue({ ...mockDashboard });

      await service.update(orgId, dashboardId, {
        name: 'Multi Update',
        description: 'Multi desc',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Multi Update',
          description: 'Multi desc',
        }),
      );
    });

    it('should throw NotFoundException when dashboard is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update(orgId, 'nonexistent-id', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft remove the dashboard', async () => {
      repo.findOne.mockResolvedValue(mockDashboard);

      await service.remove(orgId, dashboardId);

      expect(repo.softRemove).toHaveBeenCalledWith(mockDashboard);
    });

    it('should throw NotFoundException when dashboard is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove(orgId, 'nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
