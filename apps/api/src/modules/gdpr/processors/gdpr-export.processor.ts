import { Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { GdprService } from '../gdpr.service';

interface ExportJobData {
  userId: string;
  requestId: string;
}

@Injectable()
export class GdprExportProcessor {
  private readonly logger = new Logger(GdprExportProcessor.name);
  private worker: Worker | null = null;

  constructor(private readonly gdprService: GdprService) {
    this.initWorker();
  }

  private initWorker() {
    const redisUrl = process.env['REDIS_URL']!;
    const parsed = new URL(redisUrl);

    this.worker = new Worker(
      'gdpr-export',
      async (job: Job<ExportJobData>) => {
        return this.process(job);
      },
      {
        connection: {
          host: parsed.hostname,
          port: parseInt(parsed.port || '6379', 10),
          password: parsed.password || undefined,
          maxRetriesPerRequest: null,
        },
        concurrency: 2,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`GDPR export completed: ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`GDPR export failed: ${job?.id} - ${err.message}`);
    });
  }

  private async process(job: Job<ExportJobData>): Promise<void> {
    const { userId, requestId } = job.data;
    this.logger.log(`Processing GDPR export for user ${userId}, request ${requestId}`);
    await this.gdprService.generateExport(userId, requestId);
  }
}
