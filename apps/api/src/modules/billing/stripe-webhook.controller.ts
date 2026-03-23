import { Controller, Post, Req, Res, Headers, Logger, RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { Public } from '../auth/decorators/public.decorator';
import { BillingService } from './billing.service';

@Controller('webhooks')
@SkipThrottle()
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly billingService: BillingService,
    private configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
  }

  @Post('stripe')
  @Public()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;

    if (!rawBody) {
      this.logger.warn('No raw body found on webhook request');
      return res.status(400).json({ error: 'No raw body' });
    }

    if (!this.webhookSecret) {
      if (process.env['NODE_ENV'] === 'production') {
        this.logger.error('STRIPE_WEBHOOK_SECRET not configured in production');
        return res.status(500).json({ error: 'Webhook verification not configured' });
      }
      this.logger.warn('STRIPE_WEBHOOK_SECRET not configured, skipping verification in dev');
    } else if (!this.verifySignature(rawBody, signature, this.webhookSecret)) {
      this.logger.warn('Invalid Stripe webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    let event: { type: string; data: { object: Record<string, unknown> } };
    try {
      event = JSON.parse(rawBody.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const obj = event.data.object;

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.billingService.handleCheckoutCompleted(obj);
          break;
        case 'invoice.paid':
          await this.billingService.handleInvoicePaid(obj);
          break;
        case 'invoice.payment_failed':
          await this.billingService.handleInvoicePaymentFailed(obj);
          break;
        case 'customer.subscription.updated':
          await this.billingService.handleSubscriptionUpdated(obj);
          break;
        case 'customer.subscription.deleted':
          await this.billingService.handleSubscriptionDeleted(obj);
          break;
        default:
          this.logger.log(`Unhandled Stripe event type: ${event.type}`);
      }
    } catch (err) {
      this.logger.error(`Error processing webhook ${event.type}: ${err}`);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }

    return res.status(200).json({ received: true });
  }

  private verifySignature(payload: Buffer, header: string, secret: string): boolean {
    if (!header) return false;

    try {
      const parts = header.split(',');
      const timestampPart = parts.find((p) => p.startsWith('t='));
      const sigPart = parts.find((p) => p.startsWith('v1='));

      if (!timestampPart || !sigPart) return false;

      const timestamp = timestampPart.split('=')[1];
      const expectedSig = sigPart.split('=')[1];

      if (!timestamp || !expectedSig) return false;

      // Check timestamp is within 5 minutes
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

      const signedPayload = `${timestamp}.${payload.toString()}`;
      const computedSig = createHmac('sha256', secret).update(signedPayload).digest('hex');

      return timingSafeEqual(Buffer.from(computedSig), Buffer.from(expectedSig));
    } catch {
      return false;
    }
  }
}
