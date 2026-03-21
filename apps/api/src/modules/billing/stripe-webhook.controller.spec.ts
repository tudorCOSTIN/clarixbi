import { StripeWebhookController } from './stripe-webhook.controller';
import { BillingService } from './billing.service';
import { ConfigService } from '@nestjs/config';

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController;
  let billingService: Record<string, jest.Mock>;

  beforeEach(() => {
    billingService = {
      handleCheckoutCompleted: jest.fn().mockResolvedValue(undefined),
      handleInvoicePaid: jest.fn().mockResolvedValue(undefined),
      handleInvoicePaymentFailed: jest.fn().mockResolvedValue(undefined),
      handleSubscriptionUpdated: jest.fn().mockResolvedValue(undefined),
      handleSubscriptionDeleted: jest.fn().mockResolvedValue(undefined),
    };

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_WEBHOOK_SECRET') return '';
        return undefined;
      }),
    };

    controller = new StripeWebhookController(
      billingService as unknown as BillingService,
      configService as unknown as ConfigService,
    );
  });

  const createMockReqRes = (eventType: string, obj: Record<string, unknown> = {}) => {
    const body = JSON.stringify({
      type: eventType,
      data: { object: obj },
    });
    const req = { rawBody: Buffer.from(body) };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return { req, res };
  };

  it('should handle checkout.session.completed', async () => {
    const { req, res } = createMockReqRes('checkout.session.completed', {
      metadata: { org_id: 'org-1', plan_id: 'plan-1' },
      subscription: 'sub_123',
      customer: 'cus_123',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.handleWebhook(req as any, res as any, '');
    expect(billingService['handleCheckoutCompleted']).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle invoice.paid', async () => {
    const { req, res } = createMockReqRes('invoice.paid', { subscription: 'sub_123' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.handleWebhook(req as any, res as any, '');
    expect(billingService['handleInvoicePaid']).toHaveBeenCalled();
  });

  it('should handle invoice.payment_failed', async () => {
    const { req, res } = createMockReqRes('invoice.payment_failed', { subscription: 'sub_123' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.handleWebhook(req as any, res as any, '');
    expect(billingService['handleInvoicePaymentFailed']).toHaveBeenCalled();
  });

  it('should handle customer.subscription.updated', async () => {
    const { req, res } = createMockReqRes('customer.subscription.updated', {
      id: 'sub_123',
      status: 'active',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.handleWebhook(req as any, res as any, '');
    expect(billingService['handleSubscriptionUpdated']).toHaveBeenCalled();
  });

  it('should handle customer.subscription.deleted', async () => {
    const { req, res } = createMockReqRes('customer.subscription.deleted', { id: 'sub_123' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.handleWebhook(req as any, res as any, '');
    expect(billingService['handleSubscriptionDeleted']).toHaveBeenCalled();
  });

  it('should return 400 when no raw body', async () => {
    const req = { rawBody: undefined };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.handleWebhook(req as any, res as any, '');
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
