import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  LoadEvent,
} from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { encryptStripeId, decryptStripeId } from '../billing.utils';

@EventSubscriber()
export class SubscriptionSubscriber implements EntitySubscriberInterface<Subscription> {
  listenTo() {
    return Subscription;
  }

  /**
   * After loading from DB, decrypt the Stripe fields.
   */
  afterLoad(entity: Subscription, _event?: LoadEvent<Subscription>): void {
    if (entity.stripe_customer_id) {
      entity.stripe_customer_id = decryptStripeId(entity.stripe_customer_id);
    }
    if (entity.stripe_subscription_id) {
      entity.stripe_subscription_id = decryptStripeId(entity.stripe_subscription_id);
    }
  }

  /**
   * Before inserting, encrypt the Stripe fields.
   */
  beforeInsert(event: InsertEvent<Subscription>): void {
    const entity = event.entity;
    if (entity.stripe_customer_id) {
      entity.stripe_customer_id = encryptStripeId(entity.stripe_customer_id);
    }
    if (entity.stripe_subscription_id) {
      entity.stripe_subscription_id = encryptStripeId(entity.stripe_subscription_id);
    }
  }

  /**
   * Before updating, encrypt the Stripe fields.
   */
  beforeUpdate(event: UpdateEvent<Subscription>): void {
    const entity = event.entity as Subscription | undefined;
    if (!entity) return;

    if (entity.stripe_customer_id) {
      entity.stripe_customer_id = encryptStripeId(entity.stripe_customer_id);
    }
    if (entity.stripe_subscription_id) {
      entity.stripe_subscription_id = encryptStripeId(entity.stripe_subscription_id);
    }
  }
}
