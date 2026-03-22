import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { StripeWebhookController } from '../src/modules/billing/stripe-webhook.controller';
import { BillingService } from '../src/modules/billing/billing.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'whsec_test_secret';

function makeEvent(type: string, object: Record<string, unknown> = {}) {
  return { type, data: { object } };
}

function signPayload(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sig = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

function mockRequest(body: Record<string, unknown>, signed = true) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = signed ? signPayload(rawBody.toString(), WEBHOOK_SECRET) : 'v1=invalid';

  return {
    req: { rawBody } as { rawBody: Buffer },
    signature: signed ? signature : `t=${Math.floor(Date.now() / 1000)},v1=invalidsig`,
  };
}

function mockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as { status: jest.Mock; json: jest.Mock };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Stripe Webhook Handler', () => {
  let controller: StripeWebhookController;
  let billingService: Record<string, jest.Mock>;

  beforeEach(async () => {
    billingService = {
      handleCheckoutCompleted: jest.fn().mockResolvedValue(undefined),
      handleInvoicePaid: jest.fn().mockResolvedValue(undefined),
      handleInvoicePaymentFailed: jest.fn().mockResolvedValue(undefined),
      handleSubscriptionUpdated: jest.fn().mockResolvedValue(undefined),
      handleSubscriptionDeleted: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        { provide: BillingService, useValue: billingService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_WEBHOOK_SECRET') return WEBHOOK_SECRET;
              return '';
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<StripeWebhookController>(StripeWebhookController);
  });

  // -----------------------------------------------------------------------
  // Signature validation
  // -----------------------------------------------------------------------

  test('valid signature → event processed', async () => {
    const event = makeEvent('checkout.session.completed', {
      metadata: { org_id: 'org-1', plan_id: 'plan-1' },
      subscription: 'sub_123',
      customer: 'cus_123',
    });
    const { req, signature } = mockRequest(event, true);
    const res = mockResponse();

    await controller.handleWebhook(req as never, res as never, signature);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  test('invalid signature → 400 Bad Request', async () => {
    const event = makeEvent('checkout.session.completed', {});
    const { req, signature } = mockRequest(event, false);
    const res = mockResponse();

    await controller.handleWebhook(req as never, res as never, signature);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
  });

  // -----------------------------------------------------------------------
  // Event routing
  // -----------------------------------------------------------------------

  test('checkout.session.completed → calls handleCheckoutCompleted', async () => {
    const sessionObj = {
      metadata: { org_id: 'org-1', plan_id: 'plan-1' },
      subscription: 'sub_123',
      customer: 'cus_123',
    };
    const event = makeEvent('checkout.session.completed', sessionObj);
    const { req, signature } = mockRequest(event, true);
    const res = mockResponse();

    await controller.handleWebhook(req as never, res as never, signature);

    expect(billingService.handleCheckoutCompleted).toHaveBeenCalledWith(sessionObj);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('invoice.payment_failed → calls handleInvoicePaymentFailed', async () => {
    const invoiceObj = { subscription: 'sub_456' };
    const event = makeEvent('invoice.payment_failed', invoiceObj);
    const { req, signature } = mockRequest(event, true);
    const res = mockResponse();

    await controller.handleWebhook(req as never, res as never, signature);

    expect(billingService.handleInvoicePaymentFailed).toHaveBeenCalledWith(invoiceObj);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('customer.subscription.deleted → calls handleSubscriptionDeleted', async () => {
    const subObj = { id: 'sub_789', status: 'canceled' };
    const event = makeEvent('customer.subscription.deleted', subObj);
    const { req, signature } = mockRequest(event, true);
    const res = mockResponse();

    await controller.handleWebhook(req as never, res as never, signature);

    expect(billingService.handleSubscriptionDeleted).toHaveBeenCalledWith(subObj);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('unknown event type → ignored gracefully (200 OK)', async () => {
    const event = makeEvent('unknown.event.type', { some: 'data' });
    const { req, signature } = mockRequest(event, true);
    const res = mockResponse();

    await controller.handleWebhook(req as never, res as never, signature);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });

    // None of the billing service handlers should have been called
    expect(billingService.handleCheckoutCompleted).not.toHaveBeenCalled();
    expect(billingService.handleInvoicePaid).not.toHaveBeenCalled();
    expect(billingService.handleInvoicePaymentFailed).not.toHaveBeenCalled();
    expect(billingService.handleSubscriptionUpdated).not.toHaveBeenCalled();
    expect(billingService.handleSubscriptionDeleted).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  test('no raw body → 400', async () => {
    const res = mockResponse();
    const req = { rawBody: undefined };

    await controller.handleWebhook(req as never, res as never, 'some-sig');

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No raw body' });
  });
});
