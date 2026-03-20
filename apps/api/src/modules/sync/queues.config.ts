import { Queue, QueueOptions } from 'bullmq';

const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';
const parsed = new URL(redisUrl);

const bullConnection = {
  host: parsed.hostname || 'localhost',
  port: parseInt(parsed.port || '6379', 10),
  password: parsed.password || undefined,
  maxRetriesPerRequest: null,
};

export interface QueueConfig {
  name: string;
  defaultJobOptions: QueueOptions['defaultJobOptions'];
  concurrency: number;
}

export const QUEUE_CONFIGS: QueueConfig[] = [
  {
    name: 'sync-smartbill',
    concurrency: 5,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  },
  {
    name: 'sync-woocommerce',
    concurrency: 5,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  },
  {
    name: 'sync-csv',
    concurrency: 2,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 50,
      removeOnFail: 200,
    },
  },
  {
    name: 'reports-generate',
    concurrency: 3,
    defaultJobOptions: {
      attempts: 2,
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  },
  {
    name: 'reports-email',
    concurrency: 10,
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  },
  {
    name: 'alerts-check',
    concurrency: 10,
    defaultJobOptions: {
      attempts: 2,
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  },
  {
    name: 'gdpr-hard-delete',
    concurrency: 1,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 50,
      removeOnFail: 500,
    },
  },
  {
    name: 'gdpr-export',
    concurrency: 2,
    defaultJobOptions: {
      attempts: 2,
      removeOnComplete: 50,
      removeOnFail: 500,
    },
  },
];

export const queues: Record<string, Queue> = {};

for (const config of QUEUE_CONFIGS) {
  queues[config.name] = new Queue(config.name, {
    connection: bullConnection,
    defaultJobOptions: config.defaultJobOptions,
  });
}

export const syncSmartbillQueue = queues['sync-smartbill']!;
export const syncWoocommerceQueue = queues['sync-woocommerce']!;
export const syncCsvQueue = queues['sync-csv']!;
export const reportsGenerateQueue = queues['reports-generate']!;
export const reportsEmailQueue = queues['reports-email']!;
export const alertsCheckQueue = queues['alerts-check']!;
export const gdprHardDeleteQueue = queues['gdpr-hard-delete']!;
export const gdprExportQueue = queues['gdpr-export']!;
