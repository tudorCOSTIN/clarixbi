import { Injectable, Logger, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert, ConditionOperator, CheckFrequency } from './entities/alert.entity';
import { AlertTrigger } from './entities/alert-trigger.entity';
import { Subscription } from '../billing/entities/subscription.entity';
import { Notification, NotificationType } from '../notifications/entities/notification.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { SqlValidatorService } from '../ai/sql-validator.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert)
    private alertRepo: Repository<Alert>,
    @InjectRepository(AlertTrigger)
    private triggerRepo: Repository<AlertTrigger>,
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(TeamMember)
    private teamMemberRepo: Repository<TeamMember>,
    private clickhouse: ClickHouseService,
    private notificationsGateway: NotificationsGateway,
    private sqlValidator: SqlValidatorService,
    private emailService: EmailService,
  ) {}

  async create(
    orgId: string,
    userId: string,
    data: {
      name: string;
      dataSourceId: string;
      metricQuery: string;
      conditionOperator: ConditionOperator;
      thresholdValue: number;
      checkFrequency: CheckFrequency;
    },
  ): Promise<Alert> {
    // Check alert limit per plan
    await this.enforceAlertLimit(orgId);

    // Validate the metric query
    const validation = await this.sqlValidator.validate(data.metricQuery, orgId);
    if (!validation.isValid) {
      throw new HttpException(
        {
          error: 'INVALID_QUERY',
          message: `Invalid metric query: ${validation.errors.join('; ')}`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const alert = this.alertRepo.create({
      org_id: orgId,
      created_by: userId,
      data_source_id: data.dataSourceId,
      name: data.name,
      metric_query: validation.sanitizedSql,
      condition_operator: data.conditionOperator,
      threshold_value: data.thresholdValue,
      check_frequency: data.checkFrequency,
      is_active: true,
    });

    return this.alertRepo.save(alert);
  }

  async list(orgId: string, page = 1, limit = 20): Promise<{ data: Alert[]; total: number }> {
    const [data, total] = await this.alertRepo.findAndCount({
      where: { org_id: orgId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findOne(orgId: string, alertId: string): Promise<Alert> {
    const alert = await this.alertRepo.findOne({
      where: { id: alertId, org_id: orgId },
    });
    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  async update(
    orgId: string,
    alertId: string,
    data: {
      name?: string;
      metricQuery?: string;
      conditionOperator?: ConditionOperator;
      thresholdValue?: number;
      checkFrequency?: CheckFrequency;
    },
  ): Promise<Alert> {
    const alert = await this.findOne(orgId, alertId);

    if (data.name !== undefined) alert.name = data.name;
    if (data.metricQuery !== undefined) {
      const validation = await this.sqlValidator.validate(data.metricQuery, orgId);
      if (!validation.isValid) {
        throw new HttpException(
          {
            error: 'INVALID_QUERY',
            message: `Invalid metric query: ${validation.errors.join('; ')}`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      alert.metric_query = validation.sanitizedSql;
    }
    if (data.conditionOperator !== undefined) alert.condition_operator = data.conditionOperator;
    if (data.thresholdValue !== undefined) alert.threshold_value = data.thresholdValue;
    if (data.checkFrequency !== undefined) alert.check_frequency = data.checkFrequency;

    return this.alertRepo.save(alert);
  }

  async remove(orgId: string, alertId: string): Promise<void> {
    const alert = await this.findOne(orgId, alertId);
    await this.alertRepo.remove(alert);
  }

  async toggle(orgId: string, alertId: string, isActive: boolean): Promise<Alert> {
    const alert = await this.findOne(orgId, alertId);

    // If activating, check limit
    if (isActive && !alert.is_active) {
      await this.enforceAlertLimit(orgId);
    }

    alert.is_active = isActive;
    return this.alertRepo.save(alert);
  }

  async test(
    orgId: string,
    alertId: string,
  ): Promise<{
    wouldTrigger: boolean;
    currentValue: number;
    threshold: number;
  }> {
    const alert = await this.findOne(orgId, alertId);
    const currentValue = await this.executeMetricQuery(alert.metric_query);

    return {
      wouldTrigger: this.evaluateCondition(
        currentValue,
        alert.condition_operator,
        Number(alert.threshold_value),
      ),
      currentValue,
      threshold: Number(alert.threshold_value),
    };
  }

  async getTriggerHistory(
    orgId: string,
    alertId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: AlertTrigger[]; total: number }> {
    await this.findOne(orgId, alertId);
    const [data, total] = await this.triggerRepo.findAndCount({
      where: { alert_id: alertId },
      order: { triggered_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  // --- Alert Checker (called by cron processor) ---

  async checkAlerts(): Promise<void> {
    const now = new Date();

    // Fetch active alerts with triggers pre-loaded (avoids N+1)
    const alerts = await this.alertRepo.find({
      where: { is_active: true },
      relations: ['triggers'],
    });

    for (const alert of alerts) {
      try {
        // Get the most recent trigger from pre-loaded relation
        const sortedTriggers = (alert.triggers || []).sort(
          (a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime(),
        );
        const lastTrigger = sortedTriggers[0];

        // Hourly alerts: only check once per hour
        if (alert.check_frequency === CheckFrequency.HOURLY && lastTrigger) {
          const timeSince = now.getTime() - new Date(lastTrigger.triggered_at).getTime();
          if (timeSince < 55 * 60 * 1000) continue; // Skip if checked less than 55 min ago
        }

        // Daily alerts: only check once per day
        if (alert.check_frequency === CheckFrequency.DAILY && lastTrigger) {
          const timeSince = now.getTime() - new Date(lastTrigger.triggered_at).getTime();
          if (timeSince < 23 * 60 * 60 * 1000) continue; // Skip if checked less than 23h ago
        }

        const currentValue = await this.executeMetricQuery(alert.metric_query);
        const triggered = this.evaluateCondition(
          currentValue,
          alert.condition_operator,
          Number(alert.threshold_value),
        );

        if (triggered) {
          await this.handleAlertTriggered(alert, currentValue);
        }
      } catch (error) {
        this.logger.error(`Alert check failed for ${alert.id}: ${error}`);
      }
    }
  }

  // --- Private helpers ---

  private async executeMetricQuery(query: string): Promise<number> {
    const result = await this.clickhouse.query<Record<string, unknown>>(query);
    if (result.length === 0) return 0;

    // Get first numeric value from first row
    const firstRow = result[0]!;
    const values = Object.values(firstRow);
    for (const val of values) {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    return 0;
  }

  private evaluateCondition(
    currentValue: number,
    operator: ConditionOperator,
    threshold: number,
  ): boolean {
    switch (operator) {
      case ConditionOperator.GT:
        return currentValue > threshold;
      case ConditionOperator.LT:
        return currentValue < threshold;
      case ConditionOperator.EQ:
        return currentValue === threshold;
      case ConditionOperator.GTE:
        return currentValue >= threshold;
      case ConditionOperator.LTE:
        return currentValue <= threshold;
      case ConditionOperator.CHANGE_PCT:
        // For change_pct, threshold represents percentage change
        // This would need a previous value to compare against
        return Math.abs(currentValue) > threshold;
      default:
        return false;
    }
  }

  private async handleAlertTriggered(alert: Alert, currentValue: number): Promise<void> {
    this.logger.log(
      `Alert triggered: ${alert.name} (${alert.id}) — value: ${currentValue}, threshold: ${alert.threshold_value}`,
    );

    // Create trigger record
    const trigger = this.triggerRepo.create({
      alert_id: alert.id,
      triggered_at: new Date(),
      metric_value: currentValue,
      threshold_value: alert.threshold_value,
      notified_via: ['in_app', 'email'],
    });
    await this.triggerRepo.save(trigger);

    // Notify all org members (load with user relation to avoid N+1)
    const members = await this.teamMemberRepo.find({
      where: { org_id: alert.org_id },
      relations: ['user'],
    });

    // Batch create in-app notifications
    const notifications = members.map((member) =>
      this.notificationRepo.create({
        user_id: member.user_id,
        org_id: alert.org_id,
        type: NotificationType.ALERT_TRIGGERED,
        title: `Alerta: ${alert.name}`,
        message: `Valoarea curenta (${currentValue}) a depasit pragul (${alert.threshold_value}).`,
        link_url: `/alerts`,
        metadata: {
          alertId: alert.id,
          currentValue,
          threshold: Number(alert.threshold_value),
          operator: alert.condition_operator,
        },
      }),
    );
    await this.notificationRepo.save(notifications);

    // WebSocket notification
    this.notificationsGateway.emitAlertTriggered(alert.org_id, {
      alertId: alert.id,
      value: currentValue,
      threshold: Number(alert.threshold_value),
    });

    // Email notifications in parallel (user already loaded via relation)
    const emailResults = await Promise.allSettled(
      members
        .filter((member) => member.user?.email)
        .map((member) =>
          this.emailService.sendAlertTriggered(
            member.user.email,
            alert.name,
            currentValue,
            Number(alert.threshold_value),
          ),
        ),
    );
    const failed = emailResults.filter((r) => r.status === 'rejected');
    if (failed.length) {
      this.logger.warn(`${failed.length} alert email(s) failed to send for alert ${alert.id}`);
    }
  }

  private async enforceAlertLimit(orgId: string): Promise<void> {
    const activeCount = await this.alertRepo.count({
      where: { org_id: orgId, is_active: true },
    });

    let maxAlerts = 3; // Default: Starter

    try {
      const subscription = await this.subscriptionRepo.findOne({
        where: { org_id: orgId },
        relations: ['plan'],
      });

      if (subscription?.plan) {
        maxAlerts = subscription.plan.limits.max_alerts;
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch plan for org ${orgId}: ${error}`);
    }

    // -1 means unlimited
    if (maxAlerts !== -1 && activeCount >= maxAlerts) {
      throw new HttpException(
        {
          error: 'ALERT_LIMIT_REACHED',
          message: `Ai atins limita de ${maxAlerts} alerte active. Upgradeaza planul.`,
          activeCount,
          limit: maxAlerts,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }
}
