import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Organization } from './entities/organization.entity';
import { TeamMember, TeamRole } from '../teams/entities/team-member.entity';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let orgRepo: Record<string, jest.Mock>;
  let teamMemberRepo: Record<string, jest.Mock>;

  const mockOrg: Partial<Organization> = {
    id: 'org-uuid-1',
    name: 'Test Organization',
    slug: 'test-organization',
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

  // ---------------------------------------------------------------
  // create
  // ---------------------------------------------------------------
  describe('create', () => {
    it('should create an organization with the provided slug and assign owner', async () => {
      orgRepo.findOne!.mockResolvedValue(null); // slug not taken
      const savedOrg = { ...mockOrg, slug: 'my-slug' };
      orgRepo.create!.mockReturnValue(savedOrg);
      orgRepo.save!.mockResolvedValue(savedOrg);

      const membership = { user_id: 'user-1', org_id: savedOrg.id, role: TeamRole.OWNER };
      teamMemberRepo.create!.mockReturnValue(membership);
      teamMemberRepo.save!.mockResolvedValue(membership);

      const result = await service.create({ name: 'Test Org', slug: 'my-slug' }, 'user-1');

      expect(result).toEqual(savedOrg);
      expect(orgRepo.findOne).toHaveBeenCalledWith({ where: { slug: 'my-slug' } });
      expect(orgRepo.create).toHaveBeenCalledWith({
        name: 'Test Org',
        slug: 'my-slug',
        logo_url: null,
      });
      expect(teamMemberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          org_id: savedOrg.id,
          role: TeamRole.OWNER,
        }),
      );
      expect(teamMemberRepo.save).toHaveBeenCalledWith(membership);
    });

    it('should auto-generate slug from name when slug is not provided', async () => {
      orgRepo.findOne!.mockResolvedValue(null);
      orgRepo.create!.mockImplementation((data) => data);
      orgRepo.save!.mockImplementation((data) => Promise.resolve({ id: 'org-new', ...data }));
      teamMemberRepo.create!.mockReturnValue({});
      teamMemberRepo.save!.mockResolvedValue({});

      const result = await service.create({ name: 'My Cool Company' }, 'user-1');

      // Slug should be based on the name, lowercased with hyphens, plus a random suffix
      expect(result.slug).toMatch(/^my-cool-company-[a-z0-9]+$/);
    });

    it('should throw ConflictException when slug already exists', async () => {
      orgRepo.findOne!.mockResolvedValue(mockOrg); // slug taken

      await expect(
        service.create({ name: 'Test Org', slug: 'test-organization' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.create({ name: 'Test Org', slug: 'test-organization' }, 'user-1'),
      ).rejects.toThrow('Organization slug already exists');
    });

    it('should pass logo_url when provided', async () => {
      orgRepo.findOne!.mockResolvedValue(null);
      const orgWithLogo = { ...mockOrg, logo_url: 'https://logo.png' };
      orgRepo.create!.mockReturnValue(orgWithLogo);
      orgRepo.save!.mockResolvedValue(orgWithLogo);
      teamMemberRepo.create!.mockReturnValue({});
      teamMemberRepo.save!.mockResolvedValue({});

      await service.create({ name: 'Org', slug: 'org', logo_url: 'https://logo.png' }, 'user-1');

      expect(orgRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ logo_url: 'https://logo.png' }),
      );
    });

    it('should set logo_url to null when not provided', async () => {
      orgRepo.findOne!.mockResolvedValue(null);
      orgRepo.create!.mockReturnValue(mockOrg);
      orgRepo.save!.mockResolvedValue(mockOrg);
      teamMemberRepo.create!.mockReturnValue({});
      teamMemberRepo.save!.mockResolvedValue({});

      await service.create({ name: 'Org', slug: 'org-slug' }, 'user-1');

      expect(orgRepo.create).toHaveBeenCalledWith(expect.objectContaining({ logo_url: null }));
    });

    it('should set joined_at on the team membership', async () => {
      orgRepo.findOne!.mockResolvedValue(null);
      orgRepo.create!.mockReturnValue(mockOrg);
      orgRepo.save!.mockResolvedValue(mockOrg);
      teamMemberRepo.create!.mockReturnValue({});
      teamMemberRepo.save!.mockResolvedValue({});

      await service.create({ name: 'Org', slug: 'o' }, 'user-1');

      expect(teamMemberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ joined_at: expect.any(Date) }),
      );
    });
  });

  // ---------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------
  describe('findById', () => {
    it('should return the organization when found', async () => {
      orgRepo.findOne!.mockResolvedValue(mockOrg);

      const result = await service.findById('org-uuid-1');

      expect(result).toEqual(mockOrg);
      expect(orgRepo.findOne).toHaveBeenCalledWith({ where: { id: 'org-uuid-1' } });
    });

    it('should throw NotFoundException when organization not found', async () => {
      orgRepo.findOne!.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.findById('nonexistent')).rejects.toThrow('Organization not found');
    });
  });

  // ---------------------------------------------------------------
  // update
  // ---------------------------------------------------------------
  describe('update', () => {
    it('should update and return the organization on success', async () => {
      const existingOrg = { ...mockOrg };
      orgRepo.findOne!.mockResolvedValueOnce(existingOrg); // findById
      orgRepo.save!.mockResolvedValue({ ...existingOrg, name: 'Updated Org' });

      const result = await service.update('org-uuid-1', { name: 'Updated Org' });

      expect(result.name).toBe('Updated Org');
      expect(orgRepo.save).toHaveBeenCalled();
    });

    it('should allow updating slug when new slug is unique', async () => {
      const existingOrg = { ...mockOrg, slug: 'old-slug' };
      orgRepo
        .findOne!.mockResolvedValueOnce(existingOrg) // findById
        .mockResolvedValueOnce(null); // slug uniqueness check — available
      orgRepo.save!.mockResolvedValue({ ...existingOrg, slug: 'new-slug' });

      const result = await service.update('org-uuid-1', { slug: 'new-slug' });

      expect(result.slug).toBe('new-slug');
      expect(orgRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException when updating to a duplicate slug', async () => {
      const existingOrg = { ...mockOrg, slug: 'old-slug' };
      orgRepo
        .findOne!.mockResolvedValueOnce(existingOrg) // findById
        .mockResolvedValueOnce({ id: 'other-org', slug: 'taken-slug' }); // slug taken

      await expect(service.update('org-uuid-1', { slug: 'taken-slug' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should include correct error message for duplicate slug on update', async () => {
      const existingOrg = { ...mockOrg, slug: 'old-slug' };
      orgRepo
        .findOne!.mockResolvedValueOnce(existingOrg)
        .mockResolvedValueOnce({ id: 'other-org', slug: 'taken-slug' });

      await expect(service.update('org-uuid-1', { slug: 'taken-slug' })).rejects.toThrow(
        'Organization slug already exists',
      );
    });

    it('should skip slug uniqueness check when slug is unchanged', async () => {
      const existingOrg = { ...mockOrg, slug: 'same-slug' };
      orgRepo.findOne!.mockResolvedValueOnce(existingOrg);
      orgRepo.save!.mockResolvedValue({ ...existingOrg, name: 'New Name' });

      await service.update('org-uuid-1', { slug: 'same-slug', name: 'New Name' });

      // findOne called only once for findById, not for slug uniqueness
      expect(orgRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('should skip slug uniqueness check when slug is not provided in dto', async () => {
      const existingOrg = { ...mockOrg };
      orgRepo.findOne!.mockResolvedValueOnce(existingOrg);
      orgRepo.save!.mockResolvedValue({ ...existingOrg, name: 'New Name' });

      await service.update('org-uuid-1', { name: 'New Name' });

      expect(orgRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when organization not found', async () => {
      orgRepo.findOne!.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(
        'Organization not found',
      );
    });

    it('should merge dto fields onto the organization before saving', async () => {
      const existingOrg = { ...mockOrg, name: 'Old', logo_url: null };
      orgRepo.findOne!.mockResolvedValueOnce(existingOrg);
      orgRepo.save!.mockImplementation((o) => Promise.resolve(o));

      const result = await service.update('org-uuid-1', {
        name: 'New',
        logo_url: 'https://new-logo.png',
      });

      expect(result.name).toBe('New');
      expect(result.logo_url).toBe('https://new-logo.png');
    });
  });

  // ---------------------------------------------------------------
  // softDelete
  // ---------------------------------------------------------------
  describe('softDelete', () => {
    it('should soft delete the organization on success', async () => {
      orgRepo.findOne!.mockResolvedValue(mockOrg);
      orgRepo.softDelete!.mockResolvedValue({ affected: 1 });

      await service.softDelete('org-uuid-1');

      expect(orgRepo.findOne).toHaveBeenCalledWith({ where: { id: 'org-uuid-1' } });
      expect(orgRepo.softDelete).toHaveBeenCalledWith('org-uuid-1');
    });

    it('should call findOne before softDelete', async () => {
      const callOrder: string[] = [];
      orgRepo.findOne!.mockImplementation(() => {
        callOrder.push('findOne');
        return Promise.resolve(mockOrg);
      });
      orgRepo.softDelete!.mockImplementation(() => {
        callOrder.push('softDelete');
        return Promise.resolve({ affected: 1 });
      });

      await service.softDelete('org-uuid-1');

      expect(callOrder).toEqual(['findOne', 'softDelete']);
    });

    it('should throw NotFoundException when organization not found', async () => {
      orgRepo.findOne!.mockResolvedValue(null);

      await expect(service.softDelete('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.softDelete('nonexistent')).rejects.toThrow('Organization not found');
    });
  });
});
