import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsGenerateProcessor } from './reports-generate.processor';
import { ReportsEmailProcessor } from './reports-email.processor';
import { Report } from './entities/report.entity';
import { ReportSchedule } from './entities/report-schedule.entity';
import { Dashboard } from '../dashboards/entities/dashboard.entity';
import { Widget } from '../widgets/entities/widget.entity';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, ReportSchedule, Dashboard, Widget]),
    AuthModule,
    BillingModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsGenerateProcessor, ReportsEmailProcessor],
  exports: [ReportsService],
})
export class ReportsModule {}
