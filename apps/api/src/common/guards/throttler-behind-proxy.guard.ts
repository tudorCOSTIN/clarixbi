import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(String((req as Record<string, string>).ip || '0.0.0.0'));
  }

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context } = requestProps;
    const request = context.switchToHttp().getRequest();

    // Skip rate limiting for Stripe webhook endpoints
    if (request.path?.includes('webhook') && request.headers['stripe-signature']) {
      return true;
    }

    return super.handleRequest(requestProps);
  }
}
