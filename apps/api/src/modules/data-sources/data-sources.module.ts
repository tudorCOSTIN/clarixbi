import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSourceEntity } from './entities/data-source.entity';
import { DataSourcesController } from './data-sources.controller';
import { DataSourcesService } from './data-sources.service';
import { SyncJob } from '../sync/entities/sync-job.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DataSourceEntity, SyncJob])],
  controllers: [DataSourcesController],
  providers: [DataSourcesService],
  exports: [DataSourcesService],
})
export class DataSourcesModule {}
