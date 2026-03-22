import { createHmac } from 'crypto';
import { StripeWebhookController } from './stripe-webhook.controller';
import { BillingService } from './billing.service';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';

const WEBHOOK_SECRET = 'whsec_test_secret';

function createSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${timestamp}.${payload}`;
  const sig = createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

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
        if (key === 'STRIPE_WEBHOOK_SECRET') return WEBHOOK_SECRET;
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
    const signature = createSignature(body, WEBHOOK_SECRET);
    const req = { rawBody: Buffer.from(body) };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return { req, res, signature };
  };

  it('should handle checkout.session.completed', async () => {
    const { req, res, signature } = createMockReqRes('checkout.session.completed', {
      metadata: { org_id: 'org-1', plan_id: 'plan-1' },
      subscription: 'sub_123',
      customer: 'cus_123',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.handleWebhook(req as any, res as any, signature);
    expect(billingService['handleCheckoutCompleted']).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle invoice.paid', async () => {
    const { req, res, signature } = createMockReqRes('invoice.paid', { subscription: 'sub_123' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.handleWebhook(req as any, res as any, signature);
    expect(billingService['handleInvoicePaid']).toHaveBeenCalled();
  });

  it('should handle invoice.payment_failed', async () => {
    const { req, res, signature } = createMockReqRes('invoice.payment_failed', {
      subscription: 'sub_123',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.handleWebhook(req as any, res as any, signature);
    expect(billingService['handleInvoicePaymentFailed']).toHaveBeenCalled();
  });

  it('should handle customer.subscription.updated', async () => {
    const { req, res, signature } = createMockReqRes('customer.subscription.updated', {
      id: 'sub_123',
      status: 'active',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.handleWebhook(req as any, res as any, signature);
    expect(billingService['handleSubscriptionUpdated']).toHaveBeenCalled();
  });

  it('should handle customer.subscription.deleted', async () => {
    const { req, res, signature } = createMockReqRes('customer.subscription.deleted', {
      id: 'sub_123',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.handleWebhook(req as any, res as any, signature);
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

  it('should throw InternalServerErrorException when webhook secret is missing', async () => {
    const configService = {
      get: jest.fn(() => ''),
    };

    const ctrl = new StripeWebhookController(
      billingService as unknown as BillingService,
      configService as unknown as ConfigService,
    );

    const body = JSON.stringify({ type: 'test', data: { object: {} } });
    const req = { rawBody: Buffer.from(body) };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(ctrl.handleWebhook(req as any, res as any, '')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
