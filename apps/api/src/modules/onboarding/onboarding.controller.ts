import { Controller, Get, Post, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { OnboardingService } from './onboarding.service';
import { StartConnectionDto } from './dto/start-connection.dto';
import { ValidateCredentialsDto } from './dto/validate-credentials.dto';
import { StartSyncDto } from './dto/start-sync.dto';

@ApiTags('Onboarding')
@ApiBearerAuth()
@Controller('organizations/:orgId/onboarding')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get onboarding status for organization' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStatus(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const status = await this.onboardingService.getStatus(orgId);
    return { data: status };
  }

  @Post('select-source')
  @ApiOperation({ summary: 'Select data source type during onboarding' })
  @ApiResponse({ status: 201, description: 'Source type selected' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async selectSource(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: StartConnectionDto,
  ) {
    await this.onboardingService.selectSource(orgId, dto.sourceType);
    return { data: { message: 'Source type selected' } };
  }

  @Post('connect')
  @ApiOperation({ summary: 'Test and connect a data source' })
  @ApiResponse({ status: 201, description: 'Connected' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async connect(@Param('orgId', ParseUUIDPipe) orgId: string, @Body() dto: ValidateCredentialsDto) {
    const result = await this.onboardingService.testAndConnect(
      orgId,
      dto.sourceType,
      dto.credentials,
    );
    return { data: result };
  }

  @Get('sync-status')
  @ApiOperation({ summary: 'Get sync status during onboarding' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSyncStatus(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const status = await this.onboardingService.getSyncStatus(orgId);
    return { data: status };
  }

  @Post('complete')
  @ApiOperation({ summary: 'Mark onboarding as complete' })
  @ApiResponse({ status: 201, description: 'Onboarding completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async complete(@Param('orgId', ParseUUIDPipe) orgId: string) {
    await this.onboardingService.completeOnboarding(orgId);
    return { data: { message: 'Onboarding completed' } };
  }

  @Post('demo-data')
  @ApiOperation({ summary: 'Load demo data for organization' })
  @ApiResponse({ status: 201, description: 'Demo data loaded' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async loadDemoData(@Param('orgId', ParseUUIDPipe) orgId: string, @Body() dto: StartSyncDto) {
    const result = await this.onboardingService.loadDemoData(orgId, dto.dataset);
    return { data: result };
  }
}
