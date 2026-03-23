import { Controller, Get, Patch, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Get user preferences' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserPreferences(@CurrentUser() user: JwtUser) {
    const preferences = await this.settingsService.getUserPreferences(user.id);
    return { data: preferences };
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateUserPreferences(@CurrentUser() user: JwtUser, @Body() dto: UpdateUserPreferencesDto) {
    const preferences = await this.settingsService.updateUserPreferences(user.id, dto);
    return { data: preferences };
  }

  @Get('organizations/:orgId')
  @UseGuards(OrgMemberGuard, RolesGuard)
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Get organization settings' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getOrganizationSettings(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const settings = await this.settingsService.getOrganizationSettings(orgId);
    return { data: settings };
  }

  @Patch('organizations/:orgId')
  @UseGuards(OrgMemberGuard, RolesGuard)
  @Roles(TeamRole.ADMIN)
  @ApiOperation({ summary: 'Update organization settings' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateOrganizationSettings(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: UpdateOrgSettingsDto,
  ) {
    const settings = await this.settingsService.updateOrganizationSettings(orgId, dto);
    return { data: settings };
  }
}
