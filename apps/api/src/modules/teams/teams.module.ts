import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamMember } from './entities/team-member.entity';
import { TeamsService } from './teams.service';
import { TeamsController, InviteAcceptController } from './teams.controller';
import { BillingModule } from '../billing/billing.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([TeamMember]), BillingModule, EmailModule],
  controllers: [TeamsController, InviteAcceptController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
