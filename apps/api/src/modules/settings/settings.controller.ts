import { Controller, Get, Patch, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { TeamRole } from '../teams/entities/team-member.entity';
import { SettingsService } from './settings.service';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { UpdateOrgSettingsDto } from './dto/update-org-settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('preferences')
  async getUserPreferences(@CurrentUser() user: JwtUser) {
    const preferences = await this.settingsService.getUserPreferences(user.id);
    return { data: preferences };
  }

  @Patch('preferences')
  async updateUserPreferences(@CurrentUser() user: JwtUser, @Body() dto: UpdateUserPreferencesDto) {
    const preferences = await this.settingsService.updateUserPreferences(user.id, dto);
    return { data: preferences };
  }

  @Get('organizations/:orgId')
  @UseGuards(OrgMemberGuard, RolesGuard)
  @Roles(TeamRole.VIEWER)
  async getOrganizationSettings(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const settings = await this.settingsService.getOrganizationSettings(orgId);
    return { data: settings };
  }

  @Patch('organizations/:orgId')
  @UseGuards(OrgMemberGuard, RolesGuard)
  @Roles(TeamRole.ADMIN)
  async updateOrganizationSettings(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: UpdateOrgSettingsDto,
  ) {
    const settings = await this.settingsService.updateOrganizationSettings(orgId, dto);
    return { data: settings };
  }
}
