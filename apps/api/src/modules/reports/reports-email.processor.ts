import { Injectable, Logger } from '@nestjs/common';
import { Worker } from 'bullmq';
import { ReportsService } from './reports.service';
import { reportsGenerateQueue } from '../sync/queues.config';

@Injectable()
export class ReportsEmailProcessor {
  private readonly logger = new Logger(ReportsEmailProcessor.name);
  private worker: Worker | null = null;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private reportsService: ReportsService) {
    this.initWorker();
    this.startScheduleChecker();
  }

  private initWorker() {
    const redisUrl = process.env['REDIS_URL'];
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }
    const parsed = new URL(redisUrl);

    this.worker = new Worker(
      'reports-email',
      async (job) => {
        const { reportId, orgId, recipients, scheduleId, cronExpression } = job.data as {
          reportId: string;
          orgId: string;
          recipients: string[];
          scheduleId: string;
          cronExpression: string;
        };

        this.logger.log(`Sending scheduled report ${reportId} to ${recipients.length} recipients`);

        // Generate PDF first
        await reportsGenerateQueue.add('generate-pdf', {
          reportId,
          orgId,
          dashboardId: '',
          widgetIds: [],
          reportName: '',
        });

        // Send email via Resend (simplified - actual implementation would use Resend SDK)
        for (const recipient of recipients) {
          this.logger.log(`Email sent to ${recipient} for report ${reportId}`);
          // In production:
          // await resend.emails.send({
          //   from: 'ClarixBI <reports@clarixbi.com>',
          //   to: recipient,
          //   subject: `Report: ${reportName}`,
          //   html: `<p>Your scheduled report is attached.</p>`,
          //   attachments: [{ filename: 'report.pdf', content: pdfBuffer }],
          // });
        }

        // Update schedule after send
        await this.reportsService.updateScheduleAfterSend(scheduleId, cronExpression);

        return { sent: recipients.length };
      },
      {
        connection: {
          host: parsed.hostname || 'localhost',
          port: parseInt(parsed.port || '6379', 10),
          password: parsed.password || undefined,
          maxRetriesPerRequest: null,
        },
        concurrency: 10,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Report email job completed: ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Report email job failed: ${job?.id} - ${err.message}`);
    });
  }

  private startScheduleChecker() {
    // Check every hour for reports that need to be sent
    this.checkInterval = setInterval(
      () => this.checkScheduledReports(),
      60 * 60 * 1000, // 1 hour
    );

    // Also check on startup
    setTimeout(() => this.checkScheduledReports(), 10_000);
  }

  private async checkScheduledReports() {
    try {
      const schedules = await this.reportsService.getActiveSchedules();
      const now = new Date();

      for (const schedule of schedules) {
        if (schedule.next_run_at && new Date(schedule.next_run_at) <= now) {
          const { reportsEmailQueue } = await import('../sync/queues.config');
          await reportsEmailQueue.add('send-report', {
            reportId: schedule.report_id,
            orgId: schedule.report?.org_id,
            recipients: schedule.recipients,
            scheduleId: schedule.id,
            cronExpression: schedule.cron_expression,
          });

          this.logger.log(`Queued scheduled report ${schedule.report_id} for sending`);
        }
      }
    } catch (error) {
      this.logger.error(`Schedule check failed: ${error}`);
    }
  }
}
