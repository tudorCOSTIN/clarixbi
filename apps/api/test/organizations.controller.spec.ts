import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrganizationsController } from '../src/modules/organizations/organizations.controller';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { CreateOrganizationDto } from '../src/modules/organizations/dto/create-organization.dto';
import { UpdateOrganizationDto } from '../src/modules/organizations/dto/update-organization.dto';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../src/modules/auth/guards/org-member.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOrganizationsService = {
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

const mockUser = { sub: 'user-id', id: 'user-id', email: 'test@test.com' };

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let service: typeof mockOrganizationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [{ provide: OrganizationsService, useValue: mockOrganizationsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(OrgMemberGuard)
      .useValue(mockGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
    service = mockOrganizationsService;

    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // create
  // -----------------------------------------------------------------------

  describe('create', () => {
    it('should create an organization and make the user the owner', async () => {
      const dto: CreateOrganizationDto = { name: 'Acme Corp' };
      const createdOrg = { id: 'org-1', name: 'Acme Corp', ownerId: 'user-id' };

      service.create.mockResolvedValue(createdOrg);

      const result = await controller.create(mockUser as any, dto);

      expect(service.create).toHaveBeenCalledWith(dto, 'user-id');
      expect(result).toEqual({ data: createdOrg });
    });

    it('should pass the dto to the service for validation', async () => {
      const dto: CreateOrganizationDto = { name: '' };

      service.create.mockRejectedValue(new Error('Validation failed'));

      await expect(controller.create(mockUser as any, dto)).rejects.toThrow('Validation failed');
      expect(service.create).toHaveBeenCalledWith(dto, 'user-id');
    });
  });

  // -----------------------------------------------------------------------
  // findOne
  // -----------------------------------------------------------------------

  describe('findOne', () => {
    it('should return organization details for a valid orgId', async () => {
      const org = { id: 'org-1', name: 'Acme Corp', slug: 'acme-corp' };

      service.findById.mockResolvedValue(org);

      const result = await controller.findOne('org-1');

      expect(service.findById).toHaveBeenCalledWith('org-1');
      expect(result).toEqual({ data: org });
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      service.findById.mockRejectedValue(new NotFoundException('Organization not found'));

      await expect(controller.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
      expect(service.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  // -----------------------------------------------------------------------
  // update
  // -----------------------------------------------------------------------

  describe('update', () => {
    it('should update the organization name successfully', async () => {
      const dto: UpdateOrganizationDto = { name: 'Acme Corp Renamed' };
      const updatedOrg = { id: 'org-1', name: 'Acme Corp Renamed' };

      service.update.mockResolvedValue(updatedOrg);

      const result = await controller.update('org-1', dto);

      expect(service.update).toHaveBeenCalledWith('org-1', dto);
      expect(result).toEqual({ data: updatedOrg });
    });

    it('should pass the dto to the service for validation', async () => {
      const dto: UpdateOrganizationDto = { name: '' };

      service.update.mockRejectedValue(new Error('Validation failed'));

      await expect(controller.update('org-1', dto)).rejects.toThrow('Validation failed');
      expect(service.update).toHaveBeenCalledWith('org-1', dto);
    });
  });

  // -----------------------------------------------------------------------
  // remove
  // -----------------------------------------------------------------------

  describe('remove', () => {
    it('should soft delete the organization successfully', async () => {
      service.softDelete.mockResolvedValue(undefined);

      const result = await controller.remove('org-1');

      expect(service.softDelete).toHaveBeenCalledWith('org-1');
      expect(result).toEqual({
        data: { message: 'Organization deleted successfully' },
      });
    });

    it('should throw NotFoundException when organization does not exist', async () => {
      service.softDelete.mockRejectedValue(new NotFoundException('Organization not found'));

      await expect(controller.remove('non-existent-id')).rejects.toThrow(NotFoundException);
      expect(service.softDelete).toHaveBeenCalledWith('non-existent-id');
    });
  });
});
