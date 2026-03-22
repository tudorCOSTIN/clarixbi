import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { cacheRedis } from '../../config/redis.config';

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
    const [postgresStatus, clickhouseStatus, redisStatus] = await Promise.all([
      this.checkPostgres(),
      this.checkClickHouse(),
      this.checkRedis(),
    ]);

    const allUp = postgresStatus === 'up' && clickhouseStatus === 'up' && redisStatus === 'up';

    return {
      data: {
        status: allUp ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          postgres: postgresStatus,
          clickhouse: clickhouseStatus,
          redis: redisStatus,
        },
      },
    };
  }

  private async checkPostgres(): Promise<string> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkClickHouse(): Promise<string> {
    try {
      const result = await this.clickhouse.healthCheck();
      return result.ok ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<string> {
    try {
      const pong = await cacheRedis.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
