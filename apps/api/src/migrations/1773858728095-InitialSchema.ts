import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1773858728095 implements MigrationInterface {
  name = 'InitialSchema1773858728095';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_preferred_language_enum" AS ENUM('ro', 'en')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "auth0_id" character varying NOT NULL, "email" character varying NOT NULL, "name" character varying NOT NULL, "avatar_url" character varying, "preferred_language" "public"."users_preferred_language_enum" NOT NULL DEFAULT 'ro', "preferred_timezone" character varying NOT NULL DEFAULT 'Europe/Bucharest', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_2356e187b2a6e1490e4f06f7508" UNIQUE ("auth0_id"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
    await queryRunner.query(
      `CREATE TYPE "public"."team_members_role_enum" AS ENUM('owner', 'admin', 'editor', 'viewer')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."team_members_invite_status_enum" AS ENUM('pending', 'accepted', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "team_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "org_id" uuid NOT NULL, "role" "public"."team_members_role_enum" NOT NULL, "invited_by" uuid, "invite_email" character varying, "invite_token" character varying, "invite_status" "public"."team_members_invite_status_enum", "invite_expires_at" TIMESTAMP, "joined_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_85ab115cbd36d29844dfcc5c7c2" UNIQUE ("invite_token"), CONSTRAINT "UQ_67483dadc4b1fa0edf2769ba873" UNIQUE ("user_id", "org_id"), CONSTRAINT "PK_ca3eae89dcf20c9fd95bf7460aa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c2bf4967c8c2a6b845dadfbf3d" ON "team_members" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4b95030cdeecc04482e948a5cb" ON "team_members" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sync_jobs_status_enum" AS ENUM('queued', 'running', 'completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sync_jobs_job_type_enum" AS ENUM('initial', 'incremental', 'manual')`,
    );
    await queryRunner.query(
      `CREATE TABLE "sync_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "data_source_id" uuid NOT NULL, "org_id" uuid NOT NULL, "status" "public"."sync_jobs_status_enum" NOT NULL, "started_at" TIMESTAMP, "completed_at" TIMESTAMP, "rows_imported" integer NOT NULL DEFAULT '0', "rows_updated" integer NOT NULL DEFAULT '0', "rows_failed" integer NOT NULL DEFAULT '0', "error_message" text, "job_type" "public"."sync_jobs_job_type_enum" NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8586b15058c8811de6286052139" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a175fed7de0c99c37d8cb277a6" ON "sync_jobs" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_70597b4533496985f96871a14b" ON "sync_jobs" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4d62b56c2670064debb1f6f861" ON "sync_jobs" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."data_sources_type_enum" AS ENUM('smartbill', 'efactura', 'woocommerce', 'csv')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."data_sources_status_enum" AS ENUM('active', 'syncing', 'error', 'disconnected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "data_sources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "org_id" uuid NOT NULL, "type" "public"."data_sources_type_enum" NOT NULL, "name" character varying NOT NULL, "credentials_encrypted" text, "config" jsonb NOT NULL DEFAULT '{}', "status" "public"."data_sources_status_enum" NOT NULL DEFAULT 'active', "last_sync_at" TIMESTAMP, "total_rows" integer NOT NULL DEFAULT '0', "sync_interval_minutes" integer NOT NULL DEFAULT '15', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_dc70b1c6b641726739857fd938d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cc1827d1e84ce2fa06157cb679" ON "data_sources" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c76edc1e50d935210c73ba27bb" ON "data_sources" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_366c4ca869c73c70e3aac678fc" ON "data_sources" ("org_id", "type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "display_name" character varying NOT NULL, "price_monthly_eur" numeric(10,2) NOT NULL, "price_annual_eur" numeric(10,2) NOT NULL, "stripe_price_monthly_id" character varying, "stripe_price_annual_id" character varying, "limits" jsonb NOT NULL, "features" jsonb NOT NULL DEFAULT '[]', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3720521a81c7c24fe9b7202ba61" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscriptions_status_enum" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'unpaid')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscriptions_billing_period_enum" AS ENUM('monthly', 'annual')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "org_id" uuid NOT NULL, "plan_id" uuid NOT NULL, "stripe_subscription_id" character varying, "stripe_customer_id" character varying, "status" "public"."subscriptions_status_enum" NOT NULL, "billing_period" "public"."subscriptions_billing_period_enum" NOT NULL, "trial_ends_at" TIMESTAMP, "current_period_start" TIMESTAMP NOT NULL, "current_period_end" TIMESTAMP NOT NULL, "canceled_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_363623aab86786a0b99e10b03fc" UNIQUE ("org_id"), CONSTRAINT "UQ_3a2d09d943f39912a01831a9272" UNIQUE ("stripe_subscription_id"), CONSTRAINT "REL_363623aab86786a0b99e10b03f" UNIQUE ("org_id"), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_363623aab86786a0b99e10b03f" ON "subscriptions" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6ccf973355b70645eff37774de" ON "subscriptions" ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organizations_default_language_enum" AS ENUM('ro', 'en')`,
    );
    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "logo_url" character varying, "default_timezone" character varying NOT NULL DEFAULT 'Europe/Bucharest', "default_language" "public"."organizations_default_language_enum" NOT NULL DEFAULT 'ro', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE ("slug"), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "dashboard_shares" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dashboard_id" uuid NOT NULL, "share_token" character varying NOT NULL, "created_by" uuid NOT NULL, "view_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fdd1d94cb6b1c8ba73ac4093d98" UNIQUE ("share_token"), CONSTRAINT "PK_2568cb877738ea012c2ce028f1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."dashboards_source_type_enum" AS ENUM('smartbill', 'woocommerce', 'csv', 'efactura', 'mixed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "dashboards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "org_id" uuid NOT NULL, "created_by" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "layout" jsonb NOT NULL DEFAULT '[]', "is_auto_generated" boolean NOT NULL DEFAULT false, "source_type" "public"."dashboards_source_type_enum", "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_1b4b4bc346118e0d335f16c5344" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_922b460643122fc5ca62091766" ON "dashboards" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_39e577261125d90f966a584e42" ON "dashboards" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."widgets_type_enum" AS ENUM('line', 'bar', 'pie', 'area', 'table', 'kpi', 'gauge', 'heatmap')`,
    );
    await queryRunner.query(
      `CREATE TABLE "widgets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dashboard_id" uuid NOT NULL, "org_id" uuid NOT NULL, "type" "public"."widgets_type_enum" NOT NULL, "title" character varying NOT NULL, "config" jsonb NOT NULL DEFAULT '{}', "query_sql" text NOT NULL, "position" jsonb NOT NULL DEFAULT '{}', "data_source_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_da23136dbcfc91424451e24b725" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_340769bb951cdf0818dd280917" ON "widgets" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "report_schedules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "report_id" uuid NOT NULL, "cron_expression" character varying NOT NULL, "timezone" character varying NOT NULL DEFAULT 'Europe/Bucharest', "recipients" jsonb NOT NULL DEFAULT '[]', "is_active" boolean NOT NULL DEFAULT true, "last_sent_at" TIMESTAMP, "next_run_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_603f9cdaaf4c1193d7399c1e79c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE TYPE "public"."reports_format_enum" AS ENUM('pdf', 'xlsx')`);
    await queryRunner.query(
      `CREATE TABLE "reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "org_id" uuid NOT NULL, "dashboard_id" uuid NOT NULL, "created_by" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "format" "public"."reports_format_enum" NOT NULL, "config" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cea2f786748fa6f2e329e91206" ON "reports" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dc4079492e338ac5ce4f9a740a" ON "reports" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('alert_triggered', 'sync_complete', 'sync_failed', 'report_ready', 'invite_received', 'plan_limit_warning', 'payment_failed', 'system')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "org_id" uuid NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "title" character varying NOT NULL, "message" text NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "link_url" character varying, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_324de082662023de80fdf06897" ON "notifications" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_77ee7b06d6f802000c0846f3a5" ON "notifications" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "alert_triggers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "alert_id" uuid NOT NULL, "triggered_at" TIMESTAMP NOT NULL, "metric_value" numeric NOT NULL, "threshold_value" numeric NOT NULL, "notified_via" jsonb NOT NULL DEFAULT '[]', "acknowledged_at" TIMESTAMP, "acknowledged_by" uuid, CONSTRAINT "PK_8a7ba06f20359a3ed5a86f5c3fc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alerts_condition_operator_enum" AS ENUM('gt', 'lt', 'eq', 'gte', 'lte', 'change_pct')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alerts_check_frequency_enum" AS ENUM('realtime', 'hourly', 'daily')`,
    );
    await queryRunner.query(
      `CREATE TABLE "alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "org_id" uuid NOT NULL, "created_by" uuid NOT NULL, "data_source_id" uuid NOT NULL, "name" character varying NOT NULL, "metric_query" text NOT NULL, "condition_operator" "public"."alerts_condition_operator_enum" NOT NULL, "threshold_value" numeric NOT NULL, "check_frequency" "public"."alerts_check_frequency_enum" NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f01c17396d017dfb799857718f" ON "alerts" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a56f667c22a7afc04b8a45f83" ON "alerts" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "org_id" uuid NOT NULL, "user_id" uuid NOT NULL, "title" character varying, "message_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_60db12765b82858ba00c8aa4ae2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6d55dbf3e2a5f525cffe2d7d44" ON "ai_conversations" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ai_messages_role_enum" AS ENUM('user', 'assistant')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "role" "public"."ai_messages_role_enum" NOT NULL, "content" text NOT NULL, "generated_sql" text, "query_result" jsonb, "tokens_used" integer NOT NULL DEFAULT '0', "latency_ms" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a390434d4a515ba18a41bc996c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "org_id" uuid, "action" character varying NOT NULL, "entity_type" character varying, "entity_id" character varying, "details" jsonb, "ip_address" character varying, "user_agent" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8f3655b4b607ce3e7a3fb90678" ON "audit_logs" ("org_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2cd10fda8276bb995288acfbfb" ON "audit_logs" ("created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" ADD CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" ADD CONSTRAINT "FK_4b95030cdeecc04482e948a5cba" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" ADD CONSTRAINT "FK_6bc0908eb7e0daec078916e6f1f" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sync_jobs" ADD CONSTRAINT "FK_63c8ec800b7f4e27d73229eda9c" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sync_jobs" ADD CONSTRAINT "FK_a175fed7de0c99c37d8cb277a68" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_sources" ADD CONSTRAINT "FK_cc1827d1e84ce2fa06157cb679a" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_363623aab86786a0b99e10b03fc" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_e45fca5d912c3a2fab512ac25dc" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dashboard_shares" ADD CONSTRAINT "FK_058e6af8e9013b859310c0da962" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dashboard_shares" ADD CONSTRAINT "FK_fc46a81d05b0e01a12659c1a10d" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dashboards" ADD CONSTRAINT "FK_922b460643122fc5ca620917662" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dashboards" ADD CONSTRAINT "FK_8b7ee74da193c2c9c710dbc3d17" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "widgets" ADD CONSTRAINT "FK_6317057fb9b4d98837ca9747f57" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "widgets" ADD CONSTRAINT "FK_340769bb951cdf0818dd280917d" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "widgets" ADD CONSTRAINT "FK_6d2f01de14f4481b1a59d2b10b1" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_schedules" ADD CONSTRAINT "FK_1dccfc2d17645280bbf6e851cfe" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_cea2f786748fa6f2e329e91206b" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_82fda87894456d3ba48bef1b7d2" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_a20814878638f52ffc91005fc42" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_324de082662023de80fdf068978" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_triggers" ADD CONSTRAINT "FK_85a97ffeec959d24bb7eccf5cb9" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_triggers" ADD CONSTRAINT "FK_8fdadbc75b40718e76a3aec0fa5" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "FK_f01c17396d017dfb799857718fb" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "FK_779c7c43268165afb5a947e0562" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "FK_8b3e3f33273ae9c801e9fe0b040" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversations" ADD CONSTRAINT "FK_6d55dbf3e2a5f525cffe2d7d445" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversations" ADD CONSTRAINT "FK_12fdbf99ca0da93085d61edd3bb" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_messages" ADD CONSTRAINT "FK_de21fcb2d1df7fd6ca70f555b6d" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_bd2726fd31b35443f2245b93ba0" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_8f3655b4b607ce3e7a3fb906784" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_8f3655b4b607ce3e7a3fb906784"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_bd2726fd31b35443f2245b93ba0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_messages" DROP CONSTRAINT "FK_de21fcb2d1df7fd6ca70f555b6d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversations" DROP CONSTRAINT "FK_12fdbf99ca0da93085d61edd3bb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_conversations" DROP CONSTRAINT "FK_6d55dbf3e2a5f525cffe2d7d445"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "FK_8b3e3f33273ae9c801e9fe0b040"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "FK_779c7c43268165afb5a947e0562"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP CONSTRAINT "FK_f01c17396d017dfb799857718fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_triggers" DROP CONSTRAINT "FK_8fdadbc75b40718e76a3aec0fa5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_triggers" DROP CONSTRAINT "FK_85a97ffeec959d24bb7eccf5cb9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_324de082662023de80fdf068978"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_a20814878638f52ffc91005fc42"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_82fda87894456d3ba48bef1b7d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_cea2f786748fa6f2e329e91206b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_schedules" DROP CONSTRAINT "FK_1dccfc2d17645280bbf6e851cfe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "widgets" DROP CONSTRAINT "FK_6d2f01de14f4481b1a59d2b10b1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "widgets" DROP CONSTRAINT "FK_340769bb951cdf0818dd280917d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "widgets" DROP CONSTRAINT "FK_6317057fb9b4d98837ca9747f57"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dashboards" DROP CONSTRAINT "FK_8b7ee74da193c2c9c710dbc3d17"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dashboards" DROP CONSTRAINT "FK_922b460643122fc5ca620917662"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dashboard_shares" DROP CONSTRAINT "FK_fc46a81d05b0e01a12659c1a10d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dashboard_shares" DROP CONSTRAINT "FK_058e6af8e9013b859310c0da962"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_e45fca5d912c3a2fab512ac25dc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_363623aab86786a0b99e10b03fc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_sources" DROP CONSTRAINT "FK_cc1827d1e84ce2fa06157cb679a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sync_jobs" DROP CONSTRAINT "FK_a175fed7de0c99c37d8cb277a68"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sync_jobs" DROP CONSTRAINT "FK_63c8ec800b7f4e27d73229eda9c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" DROP CONSTRAINT "FK_6bc0908eb7e0daec078916e6f1f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" DROP CONSTRAINT "FK_4b95030cdeecc04482e948a5cba"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" DROP CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_2cd10fda8276bb995288acfbfb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8f3655b4b607ce3e7a3fb90678"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "ai_messages"`);
    await queryRunner.query(`DROP TYPE "public"."ai_messages_role_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6d55dbf3e2a5f525cffe2d7d44"`);
    await queryRunner.query(`DROP TABLE "ai_conversations"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9a56f667c22a7afc04b8a45f83"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f01c17396d017dfb799857718f"`);
    await queryRunner.query(`DROP TABLE "alerts"`);
    await queryRunner.query(`DROP TYPE "public"."alerts_check_frequency_enum"`);
    await queryRunner.query(`DROP TYPE "public"."alerts_condition_operator_enum"`);
    await queryRunner.query(`DROP TABLE "alert_triggers"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_77ee7b06d6f802000c0846f3a5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_324de082662023de80fdf06897"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_dc4079492e338ac5ce4f9a740a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cea2f786748fa6f2e329e91206"`);
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(`DROP TYPE "public"."reports_format_enum"`);
    await queryRunner.query(`DROP TABLE "report_schedules"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_340769bb951cdf0818dd280917"`);
    await queryRunner.query(`DROP TABLE "widgets"`);
    await queryRunner.query(`DROP TYPE "public"."widgets_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_39e577261125d90f966a584e42"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_922b460643122fc5ca62091766"`);
    await queryRunner.query(`DROP TABLE "dashboards"`);
    await queryRunner.query(`DROP TYPE "public"."dashboards_source_type_enum"`);
    await queryRunner.query(`DROP TABLE "dashboard_shares"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
    await queryRunner.query(`DROP TYPE "public"."organizations_default_language_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6ccf973355b70645eff37774de"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_363623aab86786a0b99e10b03f"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TYPE "public"."subscriptions_billing_period_enum"`);
    await queryRunner.query(`DROP TYPE "public"."subscriptions_status_enum"`);
    await queryRunner.query(`DROP TABLE "plans"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_366c4ca869c73c70e3aac678fc"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c76edc1e50d935210c73ba27bb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cc1827d1e84ce2fa06157cb679"`);
    await queryRunner.query(`DROP TABLE "data_sources"`);
    await queryRunner.query(`DROP TYPE "public"."data_sources_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."data_sources_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4d62b56c2670064debb1f6f861"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_70597b4533496985f96871a14b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a175fed7de0c99c37d8cb277a6"`);
    await queryRunner.query(`DROP TABLE "sync_jobs"`);
    await queryRunner.query(`DROP TYPE "public"."sync_jobs_job_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."sync_jobs_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4b95030cdeecc04482e948a5cb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c2bf4967c8c2a6b845dadfbf3d"`);
    await queryRunner.query(`DROP TABLE "team_members"`);
    await queryRunner.query(`DROP TYPE "public"."team_members_invite_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."team_members_role_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_preferred_language_enum"`);
  }
}
