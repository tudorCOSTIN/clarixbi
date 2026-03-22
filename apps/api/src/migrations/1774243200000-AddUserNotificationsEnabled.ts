import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNotificationsEnabled1774243200000 implements MigrationInterface {
  name = 'AddUserNotificationsEnabled1774243200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifications_enabled" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "notifications_enabled"`);
  }
}
