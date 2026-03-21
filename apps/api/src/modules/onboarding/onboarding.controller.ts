import { Controller, Get, Post, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { OnboardingService } from './onboarding.service';

@Controller('organizations/:orgId/onboarding')
@UseGuards(OrgMemberGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  async getStatus(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const status = await this.onboardingService.getStatus(orgId);
    return { data: status };
  }

  @Post('select-source')
  async selectSource(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() body: { sourceType: string },
  ) {
    await this.onboardingService.selectSource(orgId, body.sourceType);
    return { data: { message: 'Source type selected' } };
  }

  @Post('connect')
  async connect(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() body: { sourceType: string; credentials: Record<string, string> },
  ) {
    const result = await this.onboardingService.testAndConnect(
      orgId,
      body.sourceType,
      body.credentials,
    );
    return { data: result };
  }

  @Get('sync-status')
  async getSyncStatus(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const status = await this.onboardingService.getSyncStatus(orgId);
    return { data: status };
  }

  @Post('complete')
  async complete(@Param('orgId', ParseUUIDPipe) orgId: string) {
    await this.onboardingService.completeOnboarding(orgId);
    return { data: { message: 'Onboarding completed' } };
  }

  @Post('demo-data')
  async loadDemoData(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() body: { dataset?: string },
  ) {
    const result = await this.onboardingService.loadDemoData(orgId, body.dataset);
    return { data: result };
  }
}
