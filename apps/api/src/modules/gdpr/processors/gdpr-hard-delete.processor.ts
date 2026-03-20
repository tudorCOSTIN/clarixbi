import { Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { GdprService } from '../gdpr.service';

interface HardDeleteJobData {
  userId: string;
  requestId: string;
}

@Injectable()
export class GdprHardDeleteProcessor {
  private readonly logger = new Logger(GdprHardDeleteProcessor.name);
  private worker: Worker | null = null;

  constructor(private readonly gdprService: GdprService) {
    this.initWorker();
  }

  private initWorker() {
    const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';
    const parsed = new URL(redisUrl);

    this.worker = new Worker(
      'gdpr-hard-delete',
      async (job: Job<HardDeleteJobData>) => {
        return this.process(job);
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
      this.logger.log(`GDPR hard delete completed: ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`GDPR hard delete failed: ${job?.id} - ${err.message}`);
    });
  }

  private async process(job: Job<HardDeleteJobData>): Promise<void> {
    const { userId, requestId } = job.data;
    this.logger.log(`Processing GDPR hard delete for user ${userId}, request ${requestId}`);
    await this.gdprService.executeHardDelete(userId, requestId);
  }
}
