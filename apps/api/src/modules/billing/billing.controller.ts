import { Controller, Get, Post, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { TeamRole } from '../teams/entities/team-member.entity';
import { BillingService } from './billing.service';
import { SubscribeDto, ChangePlanDto } from './dto/subscribe.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('organizations/:orgId/billing')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Get billing info and usage' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBilling(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const [subscription, usage] = await Promise.all([
      this.billingService.getCurrentSubscription(orgId),
      this.billingService.getUsage(orgId),
    ]);
    return {
      data: {
        subscription,
        usage,
        nextBilling: subscription.current_period_end,
      },
    };
  }

  @Get('plans')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'List available plans' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPlans() {
    const plans = await this.billingService.getPlans();
    return { data: plans };
  }

  @Post('subscribe')
  @Roles(TeamRole.OWNER)
  @ApiOperation({ summary: 'Create checkout session for subscription' })
  @ApiResponse({ status: 201, description: 'Checkout session created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async subscribe(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: SubscribeDto,
  ) {
    const url = await this.billingService.createCheckoutSession(
      orgId,
      user.email,
      dto.planId,
      dto.billingPeriod,
    );
    return { data: { url } };
  }

  @Post('change-plan')
  @Roles(TeamRole.OWNER)
  @ApiOperation({ summary: 'Change subscription plan' })
  @ApiResponse({ status: 201, description: 'Plan changed' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePlan(@Param('orgId', ParseUUIDPipe) orgId: string, @Body() dto: ChangePlanDto) {
    const subscription = await this.billingService.changePlan(orgId, dto.planId);
    return { data: subscription };
  }

  @Post('cancel')
  @Roles(TeamRole.OWNER)
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiResponse({ status: 201, description: 'Subscription cancelled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async cancel(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const subscription = await this.billingService.cancelSubscription(orgId);
    return { data: subscription };
  }

  @Get('invoices')
  @Roles(TeamRole.ADMIN)
  @ApiOperation({ summary: 'List invoices' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getInvoices(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const invoices = await this.billingService.getInvoices(orgId);
    return { data: invoices };
  }

  @Get('portal')
  @Roles(TeamRole.OWNER)
  @ApiOperation({ summary: 'Get Stripe customer portal URL' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPortal(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const url = await this.billingService.createPortalSession(orgId);
    return { data: { url } };
  }
}
