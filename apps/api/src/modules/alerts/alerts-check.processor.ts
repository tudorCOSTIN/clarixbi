import { Injectable, Logger } from '@nestjs/common';
import { Worker } from 'bullmq';
import { AlertsService } from './alerts.service';

@Injectable()
export class AlertsCheckProcessor {
  private readonly logger = new Logger(AlertsCheckProcessor.name);
  private worker: Worker | null = null;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private alertsService: AlertsService) {
    this.initWorker();
    this.startPeriodicCheck();
  }

  private initWorker() {
    const redisUrl = process.env['REDIS_URL'];
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }
    const parsed = new URL(redisUrl);

    this.worker = new Worker(
      'alerts-check',
      async () => {
        this.logger.log('Running alert checks...');
        await this.alertsService.checkAlerts();
        return { checked: true };
      },
      {
        connection: {
          host: parsed.hostname || 'localhost',
          port: parseInt(parsed.port || '6379', 10),
          password: parsed.password || undefined,
          maxRetriesPerRequest: null,
        },
        concurrency: 1,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Alert check completed: ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Alert check failed: ${job?.id} - ${err.message}`);
    });
  }

  private startPeriodicCheck() {
    // Check every 5 minutes
    this.checkInterval = setInterval(
      async () => {
        try {
          const { alertsCheckQueue } = await import('../sync/queues.config');
          await alertsCheckQueue.add(
            'periodic-check',
            {},
            {
              jobId: `alert-check-${Date.now()}`,
            },
          );
        } catch (error) {
          this.logger.error(`Failed to queue alert check: ${error}`);
        }
      },
      5 * 60 * 1000, // 5 minutes
    );

    // Initial check after 15 seconds
    setTimeout(async () => {
      try {
        const { alertsCheckQueue } = await import('../sync/queues.config');
        await alertsCheckQueue.add('initial-check', {});
      } catch (error) {
        this.logger.error(`Failed to queue initial alert check: ${error}`);
      }
    }, 15_000);
  }
}
