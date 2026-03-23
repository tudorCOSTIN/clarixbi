import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingFkIndexes1774329600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // audit_logs.user_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_id" ON "audit_logs" ("user_id")`,
    );

    // ai_conversations.user_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_conversations_user_id" ON "ai_conversations" ("user_id")`,
    );

    // ai_messages.conversation_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_messages_conversation_id" ON "ai_messages" ("conversation_id")`,
    );

    // alert_triggers.alert_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_alert_triggers_alert_id" ON "alert_triggers" ("alert_id")`,
    );

    // alert_triggers.acknowledged_by
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_alert_triggers_acknowledged_by" ON "alert_triggers" ("acknowledged_by")`,
    );

    // alerts.created_by
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_alerts_created_by" ON "alerts" ("created_by")`,
    );

    // alerts.data_source_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_alerts_data_source_id" ON "alerts" ("data_source_id")`,
    );

    // subscriptions.plan_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_subscriptions_plan_id" ON "subscriptions" ("plan_id")`,
    );

    // dashboard_shares.dashboard_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dashboard_shares_dashboard_id" ON "dashboard_shares" ("dashboard_id")`,
    );

    // dashboard_shares.created_by
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dashboard_shares_created_by" ON "dashboard_shares" ("created_by")`,
    );

    // dashboards.created_by
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dashboards_created_by" ON "dashboards" ("created_by")`,
    );

    // notifications.user_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_user_id" ON "notifications" ("user_id")`,
    );

    // report_schedules.report_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_report_schedules_report_id" ON "report_schedules" ("report_id")`,
    );

    // reports.dashboard_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reports_dashboard_id" ON "reports" ("dashboard_id")`,
    );

    // reports.created_by
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reports_created_by" ON "reports" ("created_by")`,
    );

    // sync_jobs.data_source_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sync_jobs_data_source_id" ON "sync_jobs" ("data_source_id")`,
    );

    // team_members.invited_by
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_team_members_invited_by" ON "team_members" ("invited_by")`,
    );

    // widgets.dashboard_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_widgets_dashboard_id" ON "widgets" ("dashboard_id")`,
    );

    // widgets.data_source_id
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_widgets_data_source_id" ON "widgets" ("data_source_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_conversations_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ai_messages_conversation_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_triggers_alert_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_triggers_acknowledged_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alerts_created_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alerts_data_source_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subscriptions_plan_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dashboard_shares_dashboard_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dashboard_shares_created_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dashboards_created_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_schedules_report_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_dashboard_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_created_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sync_jobs_data_source_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_members_invited_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_widgets_dashboard_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_widgets_data_source_id"`);
  }
}
