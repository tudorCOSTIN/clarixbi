import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiRateLimitService } from './ai-rate-limit.service';
import { ClaudeClientService } from './claude-client.service';
import { SqlValidatorService } from './sql-validator.service';
import { AIConversation } from './entities/ai-conversation.entity';
import { AIMessage } from './entities/ai-message.entity';
import { AuditLog } from '../admin/entities/audit-log.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { Subscription } from '../billing/entities/subscription.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AIConversation,
      AIMessage,
      AuditLog,
      TeamMember,
      Subscription,
      Notification,
    ]),
    NotificationsModule,
  ],
  controllers: [AiController],
  providers: [AiService, AiRateLimitService, ClaudeClientService, SqlValidatorService],
  exports: [AiService, AiRateLimitService, SqlValidatorService],
})
export class AiModule {}
