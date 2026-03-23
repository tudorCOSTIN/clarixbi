import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { UpdateOrgSettingsDto } from './dto/update-org-settings.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  async getUserPreferences(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      language: user.preferred_language,
      timezone: user.preferred_timezone,
      notifications_enabled: user.notifications_enabled,
    };
  }

  async updateUserPreferences(userId: string, dto: UpdateUserPreferencesDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.language !== undefined) {
      user.preferred_language = dto.language;
    }
    if (dto.timezone !== undefined) {
      user.preferred_timezone = dto.timezone;
    }
    if (dto.notifications_enabled !== undefined) {
      user.notifications_enabled = dto.notifications_enabled;
    }

    await this.userRepo.save(user);

    return {
      language: user.preferred_language,
      timezone: user.preferred_timezone,
      notifications_enabled: user.notifications_enabled,
    };
  }

  async getOrganizationSettings(orgId: string) {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return {
      name: org.name,
      slug: org.slug,
      logo_url: org.logo_url,
      default_timezone: org.default_timezone,
      default_language: org.default_language,
    };
  }

  async updateOrganizationSettings(orgId: string, dto: UpdateOrgSettingsDto) {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (dto.name !== undefined) {
      org.name = dto.name;
    }
    if (dto.default_timezone !== undefined) {
      org.default_timezone = dto.default_timezone;
    }
    if (dto.default_language !== undefined) {
      org.default_language = dto.default_language;
    }

    await this.orgRepo.save(org);

    return {
      name: org.name,
      slug: org.slug,
      logo_url: org.logo_url,
      default_timezone: org.default_timezone,
      default_language: org.default_language,
    };
  }
}
