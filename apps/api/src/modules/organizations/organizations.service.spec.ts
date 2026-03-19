/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Organization } from './entities/organization.entity';
import { TeamMember, TeamRole } from '../teams/entities/team-member.entity';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let orgRepo: any;
  let teamMemberRepo: any;

  const mockOrg: Partial<Organization> = {
    id: 'org-uuid-1',
    name: 'Test Org',
    slug: 'test-org',
    logo_url: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        {
          provide: getRepositoryToken(Organization),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TeamMember),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    orgRepo = module.get(getRepositoryToken(Organization));
    teamMemberRepo = module.get(getRepositoryToken(TeamMember));
  });

  describe('create', () => {
    it('should create org and assign owner', async () => {
      orgRepo.findOne.mockResolvedValue(null); // slug not taken
      orgRepo.create.mockReturnValue(mockOrg);
      orgRepo.save.mockResolvedValue(mockOrg);
      teamMemberRepo.create.mockReturnValue({});
      teamMemberRepo.save.mockResolvedValue({});

      const result = await service.create({ name: 'Test Org' }, 'user-1');

      expect(result).toEqual(mockOrg);
      expect(teamMemberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          role: TeamRole.OWNER,
        }),
      );
    });

    it('should throw ConflictException for duplicate slug', async () => {
      orgRepo.findOne.mockResolvedValue(mockOrg); // slug taken

      await expect(
        service.create({ name: 'Test Org', slug: 'test-org' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return org by id', async () => {
      orgRepo.findOne.mockResolvedValue(mockOrg);
      const result = await service.findById('org-uuid-1');
      expect(result).toEqual(mockOrg);
    });

    it('should throw NotFoundException', async () => {
      orgRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update org fields', async () => {
      orgRepo.findOne.mockResolvedValueOnce(mockOrg); // findById
      orgRepo.save.mockResolvedValue({ ...mockOrg, name: 'Updated Org' });

      const result = await service.update('org-uuid-1', { name: 'Updated Org' });
      expect(result.name).toBe('Updated Org');
    });

    it('should throw ConflictException on duplicate slug update', async () => {
      orgRepo.findOne.mockResolvedValueOnce(mockOrg); // findById
      orgRepo.findOne.mockResolvedValueOnce({ id: 'other-org', slug: 'taken-slug' }); // slug check

      await expect(service.update('org-uuid-1', { slug: 'taken-slug' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('softDelete', () => {
    it('should soft delete org', async () => {
      orgRepo.findOne.mockResolvedValue(mockOrg);
      orgRepo.softDelete.mockResolvedValue({ affected: 1 });

      await service.softDelete('org-uuid-1');
      expect(orgRepo.softDelete).toHaveBeenCalledWith('org-uuid-1');
    });
  });
});
