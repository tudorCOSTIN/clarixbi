import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { TeamMember, TeamRole } from '../teams/entities/team-member.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(TeamMember) private teamMemberRepo: Repository<TeamMember>,
  ) {}

  async create(dto: CreateOrganizationDto, userId: string): Promise<Organization> {
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check slug uniqueness
    const existing = await this.orgRepo.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException('Organization slug already exists');
    }

    const org = this.orgRepo.create({
      name: dto.name,
      slug,
      logo_url: dto.logo_url || null,
    });
    const savedOrg = await this.orgRepo.save(org);

    // Make creator the owner
    const membership = this.teamMemberRepo.create({
      user_id: userId,
      org_id: savedOrg.id,
      role: TeamRole.OWNER,
      joined_at: new Date(),
    });
    await this.teamMemberRepo.save(membership);

    return savedOrg;
  }

  async findById(id: string): Promise<Organization> {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    const org = await this.findById(id);

    if (dto.slug && dto.slug !== org.slug) {
      const existing = await this.orgRepo.findOne({ where: { slug: dto.slug } });
      if (existing) {
        throw new ConflictException('Organization slug already exists');
      }
    }

    Object.assign(org, dto);
    return this.orgRepo.save(org);
  }

  async softDelete(id: string): Promise<void> {
    await this.findById(id);
    await this.orgRepo.softDelete(id);
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const suffix = Math.random().toString(36).substring(2, 8);
    return `${base}-${suffix}`;
  }
}
