import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamMember } from './entities/team-member.entity';
import { TeamsService } from './teams.service';
import { TeamsController, InviteAcceptController } from './teams.controller';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [TypeOrmModule.forFeature([TeamMember]), BillingModule],
  controllers: [TeamsController, InviteAcceptController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
