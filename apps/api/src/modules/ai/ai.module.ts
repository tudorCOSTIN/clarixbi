import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ClaudeClientService } from './claude-client.service';
import { SqlValidatorService } from './sql-validator.service';
import { AIConversation } from './entities/ai-conversation.entity';
import { AIMessage } from './entities/ai-message.entity';
import { AuditLog } from '../admin/entities/audit-log.entity';
import { TeamMember } from '../teams/entities/team-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AIConversation, AIMessage, AuditLog, TeamMember])],
  controllers: [AiController],
  providers: [AiService, ClaudeClientService, SqlValidatorService],
  exports: [AiService],
})
export class AiModule {}
