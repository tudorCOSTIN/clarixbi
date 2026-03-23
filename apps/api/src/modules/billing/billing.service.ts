import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan, Repository, DataSource } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription, SubscriptionStatus, BillingPeriod } from './entities/subscription.entity';
import { EmailService } from '../email/email.service';
import { User } from '../users/entities/user.entity';

export interface UsageInfo {
  dataSources: { used: number; limit: number };
  dashboards: { used: number; limit: number };
  teamMembers: { used: number; limit: number };
  aiQueries: { used: number; limit: number };
  alerts: { used: number; limit: number };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripeSecretKey: string;
  private readonly appUrl: string;

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Plan)
    private planRepo: Repository<Plan>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private configService: ConfigService,
    private dataSource: DataSource,
    private emailService: EmailService,
  ) {
    this.stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY') || '';
    this.appUrl =
      this.configService.get<string>('NEXT_PUBLIC_APP_URL') ||
      this.configService.get<string>('CORS_ORIGIN') ||
      '';
  }

  /**
   * Find an existing Stripe customer for the org, or create one via the Stripe API.
   */
  async getOrCreateStripeCustomer(orgId: string, email: string): Promise<string> {
    const existing = await this.subscriptionRepo.findOne({
      where: { org_id: orgId },
    });

    if (existing?.stripe_customer_id) {
      return existing.stripe_customer_id;
    }

    const customerId = await this.createStripeCustomer(email);

    if (existing) {
      existing.stripe_customer_id = customerId;
      await this.subscriptionRepo.save(existing);
    }

    return customerId;
  }

  /**
   * Start a 14-day trial for the given organization and plan.
   */
  async startTrial(orgId: string, planId: string): Promise<Subscription> {
    const plan = await this.findPlanOrFail(planId);

    const existingSub = await this.subscriptionRepo.findOne({
      where: { org_id: orgId },
    });
    if (existingSub) {
      throw new ConflictException('Organization already has an active subscription');
    }

    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const subscription = this.subscriptionRepo.create({
      org_id: orgId,
      plan_id: plan.id,
      status: SubscriptionStatus.TRIALING,
      billing_period: BillingPeriod.MONTHLY,
      trial_ends_at: trialEndsAt,
      current_period_start: now,
      current_period_end: trialEndsAt,
    });

    return this.subscriptionRepo.save(subscription);
  }

  /**
   * Auto-enroll a new organization in a Pro trial.
   * Silently skips if org already has a subscription or no Pro plan found.
   */
  async autoEnrollTrial(orgId: string): Promise<void> {
    const existing = await this.subscriptionRepo.findOne({ where: { org_id: orgId } });
    if (existing) return;

    const proPlan = await this.planRepo.findOne({ where: { name: 'pro', is_active: true } });
    if (!proPlan) {
      this.logger.warn('Pro plan not found for auto-trial enrollment');
      return;
    }

    try {
      await this.startTrial(orgId, proPlan.id);
      this.logger.log(`Auto-enrolled org ${orgId} in Pro trial`);
    } catch (e) {
      this.logger.warn(`Auto-trial enrollment failed for org ${orgId}: ${e}`);
    }
  }

  /**
   * Create a Stripe Checkout Session and return the URL.
   */
  async createCheckoutSession(
    orgId: string,
    email: string,
    planId: string,
    billingPeriod: BillingPeriod,
  ): Promise<string> {
    const plan = await this.findPlanOrFail(planId);
    const customerId = await this.getOrCreateStripeCustomer(orgId, email);

    const priceId =
      billingPeriod === BillingPeriod.ANNUAL
        ? plan.stripe_price_annual_id
        : plan.stripe_price_monthly_id;

    if (!priceId || !this.stripeSecretKey) {
      // Mock mode: return a placeholder URL
      this.logger.log(
        `[Stripe Mock] Checkout for org=${orgId}, plan=${plan.name}, period=${billingPeriod}`,
      );
      return `${this.appUrl}/settings/billing?session=mock_cs_${Date.now()}&success=true`;
    }

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('customer', customerId);
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${this.appUrl}/settings/billing?success=true`);
    params.append('cancel_url', `${this.appUrl}/settings/billing?canceled=true`);
    params.append('metadata[org_id]', orgId);
    params.append('metadata[plan_id]', planId);
    params.append('subscription_data[metadata][org_id]', orgId);
    params.append('subscription_data[metadata][plan_id]', planId);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const session = await response.json();
    if (!response.ok) {
      this.logger.error(`Stripe checkout error: ${JSON.stringify(session)}`);
      throw new BadGatewayException('Failed to create Stripe checkout session');
    }

    return session.url;
  }

  /**
   * Create a Stripe Customer Portal session URL.
   */
  async createPortalSession(orgId: string): Promise<string> {
    const subscription = await this.findSubscriptionOrFail(orgId);

    if (!subscription.stripe_customer_id || !this.stripeSecretKey) {
      this.logger.log(`[Stripe Mock] Portal for org=${orgId}`);
      return `${this.appUrl}/settings/billing`;
    }

    const params = new URLSearchParams();
    params.append('customer', subscription.stripe_customer_id);
    params.append('return_url', `${this.appUrl}/settings/billing`);

    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const session = await response.json();
    if (!response.ok) {
      this.logger.error(`Stripe portal error: ${JSON.stringify(session)}`);
      throw new BadGatewayException('Failed to create Stripe portal session');
    }

    return session.url;
  }

  /**
   * List Stripe invoices for the organization.
   */
  async getInvoices(orgId: string): Promise<Record<string, unknown>[]> {
    const subscription = await this.subscriptionRepo.findOne({ where: { org_id: orgId } });

    if (!subscription?.stripe_customer_id || !this.stripeSecretKey) {
      return [];
    }

    const params = new URLSearchParams();
    params.append('customer', subscription.stripe_customer_id);
    params.append('limit', '20');

    const response = await fetch(`https://api.stripe.com/v1/invoices?${params.toString()}`, {
      headers: { Authorization: `Bearer ${this.stripeSecretKey}` },
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();
    if (!response.ok) {
      this.logger.error(`Stripe invoices error: ${JSON.stringify(data)}`);
      return [];
    }

    return (data.data || []).map((inv: Record<string, unknown>) => ({
      id: inv['id'],
      number: inv['number'],
      status: inv['status'],
      amount_due: inv['amount_due'],
      amount_paid: inv['amount_paid'],
      currency: inv['currency'],
      created: inv['created'],
      hosted_invoice_url: inv['hosted_invoice_url'],
      invoice_pdf: inv['invoice_pdf'],
    }));
  }

  /**
   * Create or upgrade an organization to a paid ACTIVE subscription.
   */
  async subscribe(
    orgId: string,
    planId: string,
    stripePaymentMethodId: string,
  ): Promise<Subscription> {
    const plan = await this.findPlanOrFail(planId);

    let subscription = await this.subscriptionRepo.findOne({
      where: { org_id: orgId },
    });

    const stripeSubscriptionId = await this.createStripeSubscription(
      subscription?.stripe_customer_id || null,
      plan,
      stripePaymentMethodId,
    );

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    if (subscription) {
      subscription.plan_id = plan.id;
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.stripe_subscription_id = stripeSubscriptionId;
      subscription.current_period_start = now;
      subscription.current_period_end = periodEnd;
      subscription.trial_ends_at = null;
      subscription.canceled_at = null;
    } else {
      subscription = this.subscriptionRepo.create({
        org_id: orgId,
        plan_id: plan.id,
        status: SubscriptionStatus.ACTIVE,
        billing_period: BillingPeriod.MONTHLY,
        stripe_subscription_id: stripeSubscriptionId,
        current_period_start: now,
        current_period_end: periodEnd,
      });
    }

    return this.subscriptionRepo.save(subscription);
  }

  /**
   * Change the plan for an existing subscription.
   */
  async changePlan(orgId: string, newPlanId: string): Promise<Subscription> {
    const subscription = await this.findSubscriptionOrFail(orgId);
    const plan = await this.findPlanOrFail(newPlanId);

    subscription.plan_id = plan.id;

    this.logger.log(`Plan changed for org ${orgId} to ${plan.name} (Stripe update placeholder)`);

    return this.subscriptionRepo.save(subscription);
  }

  /**
   * Cancel a subscription. Sets status to CANCELED and records cancellation time.
   */
  async cancelSubscription(orgId: string): Promise<Subscription> {
    const subscription = await this.findSubscriptionOrFail(orgId);

    subscription.status = SubscriptionStatus.CANCELED;
    subscription.canceled_at = new Date();

    this.logger.log(`Subscription canceled for org ${orgId} (Stripe cancel placeholder)`);

    return this.subscriptionRepo.save(subscription);
  }

  /**
   * Return the current active subscription with its plan details.
   */
  async getCurrentSubscription(orgId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { org_id: orgId },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }

    return subscription;
  }

  /**
   * List all available plans ordered by monthly price ascending.
   */
  async getPlans(): Promise<Plan[]> {
    return this.planRepo.find({
      where: { is_active: true },
      order: { price_monthly_eur: 'ASC' },
    });
  }

  /**
   * Get usage info for the organization: counts of resources vs plan limits.
   */
  async getUsage(orgId: string): Promise<UsageInfo> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { org_id: orgId },
      relations: ['plan'],
    });

    const limits = subscription?.plan?.limits || {
      max_data_sources: 1,
      max_dashboards: 3,
      max_team_members: 1,
      max_ai_queries_monthly: 100,
      max_alerts: 3,
    };

    const [dsCount, dashCount, memberCount, alertCount] = await Promise.all([
      this.countResource(orgId, 'data_sources'),
      this.countResource(orgId, 'dashboards'),
      this.countResource(orgId, 'team_members'),
      this.countResource(orgId, 'alerts'),
    ]);

    return {
      dataSources: { used: dsCount, limit: limits.max_data_sources },
      dashboards: { used: dashCount, limit: limits.max_dashboards },
      teamMembers: { used: memberCount, limit: limits.max_team_members },
      aiQueries: { used: 0, limit: limits.max_ai_queries_monthly },
      alerts: { used: alertCount, limit: limits.max_alerts },
    };
  }

  /**
   * Check if adding one more resource of the given type would exceed plan limits.
   * Returns null if OK, or an object with limit info if exceeded.
   */
  async checkPlanLimit(
    orgId: string,
    resource: 'data_sources' | 'dashboards' | 'team_members' | 'ai_queries' | 'alerts',
  ): Promise<{ used: number; limit: number; upgradePlan: string } | null> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { org_id: orgId },
      relations: ['plan'],
    });

    if (!subscription?.plan) {
      return { used: 0, limit: 0, upgradePlan: 'starter' };
    }

    const limitKey = `max_${resource}` as keyof typeof subscription.plan.limits;
    const limit = subscription.plan.limits[limitKey];

    // -1 means unlimited
    if (limit === -1) return null;

    const used = await this.countResource(orgId, resource);

    if (used >= limit) {
      const nextPlan = subscription.plan.name === 'starter' ? 'pro' : 'enterprise';
      return { used, limit, upgradePlan: nextPlan };
    }

    return null;
  }

  /**
   * Handle Stripe webhook: activate subscription after checkout.
   */
  async handleCheckoutCompleted(session: Record<string, unknown>): Promise<void> {
    const metadata = session['metadata'] as Record<string, string> | undefined;
    const orgId = metadata?.['org_id'];
    const planId = metadata?.['plan_id'];
    const stripeSubscriptionId = session['subscription'] as string;
    const stripeCustomerId = session['customer'] as string;

    if (!orgId || !planId) {
      this.logger.warn('Checkout session missing org_id or plan_id metadata');
      return;
    }

    let subscription = await this.subscriptionRepo.findOne({ where: { org_id: orgId } });
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    if (subscription) {
      subscription.plan_id = planId;
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.stripe_subscription_id = stripeSubscriptionId;
      subscription.stripe_customer_id = stripeCustomerId;
      subscription.current_period_start = now;
      subscription.current_period_end = periodEnd;
      subscription.trial_ends_at = null;
      subscription.canceled_at = null;
    } else {
      subscription = this.subscriptionRepo.create({
        org_id: orgId,
        plan_id: planId,
        status: SubscriptionStatus.ACTIVE,
        billing_period: BillingPeriod.MONTHLY,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: stripeCustomerId,
        current_period_start: now,
        current_period_end: periodEnd,
      });
    }

    await this.subscriptionRepo.save(subscription);
    this.logger.log(`Checkout completed for org ${orgId}, plan ${planId}`);
  }

  /**
   * Handle Stripe webhook: invoice paid — extend period.
   */
  async handleInvoicePaid(invoice: Record<string, unknown>): Promise<void> {
    const subId = invoice['subscription'] as string;
    if (!subId) return;

    const subscription = await this.subscriptionRepo.findOne({
      where: { stripe_subscription_id: subId },
    });
    if (!subscription) return;

    subscription.status = SubscriptionStatus.ACTIVE;
    const periodEnd = new Date();
    periodEnd.setMonth(
      periodEnd.getMonth() + (subscription.billing_period === BillingPeriod.ANNUAL ? 12 : 1),
    );
    subscription.current_period_end = periodEnd;
    subscription.current_period_start = new Date();

    await this.subscriptionRepo.save(subscription);
    this.logger.log(`Invoice paid for subscription ${subId}`);
  }

  /**
   * Handle Stripe webhook: invoice payment failed.
   */
  async handleInvoicePaymentFailed(invoice: Record<string, unknown>): Promise<void> {
    const subId = invoice['subscription'] as string;
    if (!subId) return;

    const subscription = await this.subscriptionRepo.findOne({
      where: { stripe_subscription_id: subId },
    });
    if (!subscription) return;

    subscription.status = SubscriptionStatus.PAST_DUE;
    await this.subscriptionRepo.save(subscription);
    this.logger.warn(`Payment failed for subscription ${subId}`);
  }

  /**
   * Handle Stripe webhook: subscription updated (plan change, status change).
   */
  async handleSubscriptionUpdated(stripeSubscription: Record<string, unknown>): Promise<void> {
    const subId = stripeSubscription['id'] as string;
    const subscription = await this.subscriptionRepo.findOne({
      where: { stripe_subscription_id: subId },
    });
    if (!subscription) return;

    const status = stripeSubscription['status'] as string;
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      trialing: SubscriptionStatus.TRIALING,
    };

    if (statusMap[status]) {
      subscription.status = statusMap[status];
    }

    if (status === 'canceled') {
      subscription.canceled_at = new Date();
    }

    await this.subscriptionRepo.save(subscription);
    this.logger.log(`Subscription ${subId} updated to status ${status}`);
  }

  /**
   * Handle Stripe webhook: subscription deleted.
   */
  async handleSubscriptionDeleted(stripeSubscription: Record<string, unknown>): Promise<void> {
    const subId = stripeSubscription['id'] as string;
    const subscription = await this.subscriptionRepo.findOne({
      where: { stripe_subscription_id: subId },
    });
    if (!subscription) return;

    // Downgrade to starter
    const starterPlan = await this.planRepo.findOne({
      where: { name: 'starter', is_active: true },
    });
    if (starterPlan) {
      subscription.plan_id = starterPlan.id;
    }
    subscription.status = SubscriptionStatus.CANCELED;
    subscription.canceled_at = new Date();
    subscription.stripe_subscription_id = null;

    await this.subscriptionRepo.save(subscription);
    this.logger.log(`Subscription ${subId} deleted, org downgraded to starter`);
  }

  /**
   * Find all expired trials and downgrade to Starter.
   * Runs daily at midnight.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkTrialExpiry(): Promise<number> {
    const now = new Date();

    const expiredTrials = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.TRIALING,
        trial_ends_at: LessThan(now),
      },
    });

    const starterPlan = await this.planRepo.findOne({
      where: { name: 'starter', is_active: true },
    });

    for (const sub of expiredTrials) {
      sub.status = SubscriptionStatus.UNPAID;
      if (starterPlan) {
        sub.plan_id = starterPlan.id;
      }
      await this.subscriptionRepo.save(sub);

      // Send trial expired email to org owner
      await this.notifyOrgOwner(sub.org_id, (email) => this.emailService.sendTrialExpired(email));
    }

    // Send reminders for trials expiring soon (3 days, 1 day)
    for (const daysLeft of [3, 1]) {
      const reminderDate = new Date(now);
      reminderDate.setDate(reminderDate.getDate() + daysLeft);
      const nextDay = new Date(reminderDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const expiringTrials = await this.subscriptionRepo
        .createQueryBuilder('sub')
        .where('sub.status = :status', { status: SubscriptionStatus.TRIALING })
        .andWhere('sub.trial_ends_at >= :start', { start: reminderDate })
        .andWhere('sub.trial_ends_at < :end', { end: nextDay })
        .getMany();

      for (const sub of expiringTrials) {
        await this.notifyOrgOwner(sub.org_id, (email) =>
          this.emailService.sendTrialReminder(email, daysLeft),
        );
      }
    }

    if (expiredTrials.length > 0) {
      this.logger.log(
        `Expired ${expiredTrials.length} trial subscription(s), downgraded to Starter`,
      );
    }

    return expiredTrials.length;
  }

  /**
   * Find the plan for a given org (with fallback to starter limits).
   */
  async getOrgPlan(orgId: string): Promise<Plan | null> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { org_id: orgId },
      relations: ['plan'],
    });
    return subscription?.plan || null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async notifyOrgOwner(
    orgId: string,
    sendFn: (email: string) => Promise<void>,
  ): Promise<void> {
    try {
      const owner = await this.dataSource.query(
        `SELECT u.email FROM users u
         JOIN team_members tm ON tm.user_id = u.id
         WHERE tm.org_id = $1 AND tm.role = 'owner'
         LIMIT 1`,
        [orgId],
      );
      if (owner?.[0]?.email) {
        await sendFn(owner[0].email);
      }
    } catch (error) {
      this.logger.warn(`Failed to notify org owner for ${orgId}: ${error}`);
    }
  }

  private async findPlanOrFail(planId: string): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  private async findSubscriptionOrFail(orgId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { org_id: orgId },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }
    return subscription;
  }

  private static readonly RESOURCE_TABLE_MAP: Record<string, string> = {
    team_members: 'team_members',
    data_sources: 'data_sources',
    dashboards: 'dashboards',
    alerts: 'alerts',
    ai_queries: 'ai_conversations',
  };

  private async countResource(orgId: string, resource: string): Promise<number> {
    const table = BillingService.RESOURCE_TABLE_MAP[resource];
    if (!table) {
      this.logger.warn(`Unknown resource type for counting: ${resource}`);
      return 0;
    }

    try {
      const result = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM "${table}" WHERE org_id = $1 AND deleted_at IS NULL`,
        [orgId],
      );
      return parseInt(result?.[0]?.count || '0', 10);
    } catch {
      // Table might not have deleted_at
      try {
        const result = await this.dataSource.query(
          `SELECT COUNT(*) as count FROM "${table}" WHERE org_id = $1`,
          [orgId],
        );
        return parseInt(result?.[0]?.count || '0', 10);
      } catch {
        return 0;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Stripe mock/placeholder methods
  // ---------------------------------------------------------------------------

  private async createStripeCustomer(email: string): Promise<string> {
    if (!this.stripeSecretKey) {
      this.logger.log(`[Stripe Mock] Creating customer for ${email}`);
      return `cus_mock_${Date.now()}`;
    }

    const params = new URLSearchParams();
    params.append('email', email);

    const response = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();
    if (!response.ok) {
      this.logger.error(`Stripe customer creation failed: ${JSON.stringify(data)}`);
      return `cus_mock_${Date.now()}`;
    }

    return data.id;
  }

  private async createStripeSubscription(
    _customerId: string | null,
    _plan: Plan,
    _paymentMethodId: string,
  ): Promise<string> {
    this.logger.log('[Stripe Mock] Creating subscription');
    return `sub_mock_${Date.now()}`;
  }
}
