import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemoSeedService } from './demo-seed.service';
import { Dashboard } from '../dashboards/entities/dashboard.entity';
import { Widget } from '../widgets/entities/widget.entity';
import { DataSourceEntity } from '../data-sources/entities/data-source.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dashboard, Widget, DataSourceEntity, Organization]),
    ClickHouseModule,
  ],
  providers: [DemoSeedService],
  exports: [DemoSeedService],
})
export class DemoSeedModule {}
