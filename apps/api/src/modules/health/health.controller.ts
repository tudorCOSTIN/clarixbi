import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { cacheRedis } from '../../config/redis.config';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    let redisStatus = 'disconnected';
    try {
      const pong = await cacheRedis.ping();
      redisStatus = pong === 'PONG' ? 'connected' : 'error';
    } catch {
      redisStatus = 'error';
    }

    return {
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          redis: redisStatus,
        },
      },
    };
  }
}
