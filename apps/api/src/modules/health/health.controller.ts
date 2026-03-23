import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';
import { cacheRedis } from '../../config/redis.config';
import { ClickHouseService } from '../clickhouse/clickhouse.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly clickhouse: ClickHouseService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    const [redisStatus, postgresStatus, clickhouseStatus] = await Promise.all([
      this.checkRedis(),
      this.checkPostgres(),
      this.checkClickHouse(),
    ]);

    const allConnected =
      redisStatus === 'connected' &&
      postgresStatus === 'connected' &&
      clickhouseStatus === 'connected';

    return {
      data: {
        status: allConnected ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          redis: redisStatus,
          postgres: postgresStatus,
          clickhouse: clickhouseStatus,
        },
      },
    };
  }

  private async checkRedis(): Promise<string> {
    try {
      const pong = await cacheRedis.ping();
      return pong === 'PONG' ? 'connected' : 'error';
    } catch {
      return 'error';
    }
  }

  private async checkPostgres(): Promise<string> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'connected';
    } catch {
      return 'error';
    }
  }

  private async checkClickHouse(): Promise<string> {
    try {
      const result = await this.clickhouse.healthCheck();
      return result.ok ? 'connected' : 'error';
    } catch {
      return 'error';
    }
  }
}
