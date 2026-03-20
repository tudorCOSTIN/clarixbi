import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription, SubscriptionStatus, BillingPeriod } from './entities/subscription.entity';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripeSecretKey: string;

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Plan)
    private planRepo: Repository<Plan>,
    private configService: ConfigService,
  ) {
    this.stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY') || '';
  }

  /**
   * Find an existing Stripe customer for the org, or create one via the Stripe API.
   * Returns the (decrypted) stripe_customer_id.
   */
  async getOrCreateStripeCustomer(orgId: string, email: string): Promise<string> {
    const existing = await this.subscriptionRepo.findOne({
      where: { org_id: orgId },
    });

    if (existing?.stripe_customer_id) {
      return existing.stripe_customer_id;
    }

    // Create Stripe customer (mock/placeholder)
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

    // Create Stripe subscription (mock/placeholder)
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

    // In production, update the Stripe subscription as well
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

    // In production, cancel at period end via Stripe
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
   * Find all expired trials and update their status to CANCELED.
   * Intended to be called by a cron job.
   */
  async checkTrialExpiry(): Promise<number> {
    const now = new Date();

    const expiredTrials = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.TRIALING,
        trial_ends_at: LessThan(now),
      },
    });

    for (const sub of expiredTrials) {
      sub.status = SubscriptionStatus.UNPAID;
      await this.subscriptionRepo.save(sub);
    }

    if (expiredTrials.length > 0) {
      this.logger.log(`Expired ${expiredTrials.length} trial subscription(s)`);
    }

    return expiredTrials.length;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Stripe mock/placeholder methods
  // ---------------------------------------------------------------------------

  /**
   * Placeholder for Stripe customer creation.
   * Replace with actual Stripe SDK or fetch call in production.
   */
  private async createStripeCustomer(email: string): Promise<string> {
    // TODO: Replace with actual Stripe API call
    // const response = await fetch('https://api.stripe.com/v1/customers', {
    //   method: 'POST',
    //   headers: {
    //     Authorization: `Bearer ${this.stripeSecretKey}`,
    //     'Content-Type': 'application/x-www-form-urlencoded',
    //   },
    //   body: `email=${encodeURIComponent(email)}`,
    // });
    // const data = await response.json();
    // return data.id;

    this.logger.log(`[Stripe Mock] Creating customer for ${email}`);
    return `cus_mock_${Date.now()}`;
  }

  /**
   * Placeholder for Stripe subscription creation.
   * Replace with actual Stripe SDK or fetch call in production.
   */
  private async createStripeSubscription(
    _customerId: string | null,
    _plan: Plan,
    _paymentMethodId: string,
  ): Promise<string> {
    // TODO: Replace with actual Stripe API call
    this.logger.log('[Stripe Mock] Creating subscription');
    return `sub_mock_${Date.now()}`;
  }
}
