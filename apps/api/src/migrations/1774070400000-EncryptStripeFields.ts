import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stripe field encryption migration.
 *
 * This migration documents that stripe_subscription_id and stripe_customer_id
 * in the subscriptions table are now encrypted at the application level using
 * AES-256-GCM via the SubscriptionSubscriber (TypeORM entity subscriber).
 *
 * No SQL schema changes are needed — the columns remain varchar and store
 * the JSON-encoded encrypted payload ({ iv, encrypted, tag }) instead of
 * plaintext Stripe IDs.
 *
 * Existing plaintext values will continue to work because decryptStripeId()
 * falls back to returning the raw value when decryption fails, allowing
 * a gradual migration: any row that is updated will be re-encrypted
 * automatically by the beforeUpdate subscriber hook.
 */
export class EncryptStripeFields1774070400000 implements MigrationInterface {
  name = 'EncryptStripeFields1774070400000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // No schema changes required.
    // Encryption is handled transparently at the application level
    // by SubscriptionSubscriber.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No schema changes to revert.
    // To revert encryption, remove the SubscriptionSubscriber and
    // run a script to decrypt all stored values back to plaintext.
  }
}
