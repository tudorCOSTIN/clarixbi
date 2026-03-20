import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardShare } from './entities/dashboard-share.entity';
import { Widget } from '../widgets/entities/widget.entity';
import { DashboardsController } from './dashboards.controller';
import { SharedDashboardController } from './shared-dashboard.controller';
import { DashboardsService } from './dashboards.service';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';

@Module({
  imports: [TypeOrmModule.forFeature([Dashboard, DashboardShare, Widget]), ClickHouseModule],
  controllers: [DashboardsController, SharedDashboardController],
  providers: [DashboardsService],
  exports: [DashboardsService],
})
export class DashboardsModule {}
