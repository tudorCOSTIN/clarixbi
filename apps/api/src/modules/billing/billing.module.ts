import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { Plan } from './entities/plan.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { AuthModule } from '../auth/auth.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { PlanLimitGuard } from './guards/plan-limit.guard';
import { User } from '../users/entities/user.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Subscription, Plan, TeamMember, User]),
    forwardRef(() => AuthModule),
    EmailModule,
  ],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, PlanLimitGuard],
  exports: [BillingService, PlanLimitGuard],
})
export class BillingModule {}
