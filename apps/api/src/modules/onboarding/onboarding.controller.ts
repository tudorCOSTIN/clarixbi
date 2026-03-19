import { Controller, Get, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status/:orgId')
  async getStatus(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const status = await this.onboardingService.getStatus(orgId);
    return { data: status };
  }

  @Post('select-source')
  async selectSource(@Body() body: { orgId: string; sourceType: string }) {
    await this.onboardingService.selectSource(body.orgId, body.sourceType);
    return { data: { message: 'Source type selected' } };
  }

  @Post('connect')
  async connect(
    @Body()
    body: {
      orgId: string;
      sourceType: string;
      credentials: Record<string, string>;
    },
  ) {
    const result = await this.onboardingService.testAndConnect(
      body.orgId,
      body.sourceType,
      body.credentials,
    );
    return { data: result };
  }

  @Get('sync-status/:orgId')
  async getSyncStatus(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const status = await this.onboardingService.getSyncStatus(orgId);
    return { data: status };
  }

  @Post('complete')
  async complete(@Body() body: { orgId: string }) {
    await this.onboardingService.completeOnboarding(body.orgId);
    return { data: { message: 'Onboarding completed' } };
  }

  @Post('demo-data')
  async loadDemoData(@Body() body: { orgId: string; dataset?: string }) {
    const result = await this.onboardingService.loadDemoData(body.orgId, body.dataset);
    return { data: result };
  }
}
