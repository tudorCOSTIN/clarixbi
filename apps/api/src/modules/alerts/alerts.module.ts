import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsCheckProcessor } from './alerts-check.processor';
import { Alert } from './entities/alert.entity';
import { AlertTrigger } from './entities/alert-trigger.entity';
import { Subscription } from '../billing/entities/subscription.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, AlertTrigger, Subscription, Notification, TeamMember]),
    NotificationsModule,
    AiModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsCheckProcessor],
  exports: [AlertsService],
})
export class AlertsModule {}
