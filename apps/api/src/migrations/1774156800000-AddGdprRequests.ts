import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGdprRequests1774156800000 implements MigrationInterface {
  name = 'AddGdprRequests1774156800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."gdpr_requests_type_enum" AS ENUM('deletion', 'export')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."gdpr_requests_status_enum" AS ENUM('pending', 'processing', 'completed', 'expired', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "gdpr_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" "public"."gdpr_requests_type_enum" NOT NULL,
        "status" "public"."gdpr_requests_status_enum" NOT NULL DEFAULT 'pending',
        "scheduled_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "download_url" character varying,
        "download_expires_at" TIMESTAMP,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gdpr_requests" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gdpr_requests_user_id" ON "gdpr_requests" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gdpr_requests_status" ON "gdpr_requests" ("status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "gdpr_requests" ADD CONSTRAINT "FK_gdpr_requests_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gdpr_requests" DROP CONSTRAINT "FK_gdpr_requests_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_gdpr_requests_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_gdpr_requests_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gdpr_requests"`);
    await queryRunner.query(`DROP TYPE "public"."gdpr_requests_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."gdpr_requests_type_enum"`);
  }
}
