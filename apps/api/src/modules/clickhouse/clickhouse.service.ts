import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ClickHouseClient } from '@clickhouse/client';
import { createClickHouseClient } from '../../config/clickhouse.config';

@Injectable()
export class ClickHouseService implements OnModuleDestroy {
  private readonly logger = new Logger(ClickHouseService.name);
  private client: ClickHouseClient;

  constructor() {
    this.client = createClickHouseClient();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: Record<string, unknown>,
  ): Promise<T[]> {
    const result = await this.client.query({
      query: sql,
      query_params: params,
      format: 'JSONEachRow',
    });
    return result.json<T>();
  }

  async insert(table: string, rows: Record<string, unknown>[]): Promise<void> {
    if (rows.length === 0) return;

    await this.client.insert({
      table,
      values: rows,
      format: 'JSONEachRow',
    });

    this.logger.log(`Inserted ${rows.length} rows into ${table}`);
  }

  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      const result = await this.client.query({
        query: 'SELECT 1 AS ping',
        format: 'JSONEachRow',
      });
      const rows = await result.json<{ ping: number }>();
      return { ok: rows[0]?.ping === 1 };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`ClickHouse health check failed: ${message}`);
      return { ok: false, error: message };
    }
  }
}
