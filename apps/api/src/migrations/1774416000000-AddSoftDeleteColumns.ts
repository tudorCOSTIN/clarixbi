import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteColumns1774416000000 implements MigrationInterface {
  name = 'AddSoftDeleteColumns1774416000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_conversations" ADD "deleted_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "alerts" ADD "deleted_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD "deleted_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "report_schedules" ADD "deleted_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "reports" ADD "deleted_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "team_members" ADD "deleted_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "widgets" ADD "deleted_at" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "widgets" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "report_schedules" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "ai_conversations" DROP COLUMN "deleted_at"`);
  }
}
