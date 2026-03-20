import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { Plan } from './entities/plan.entity';
import { BillingService } from './billing.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, Plan])],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
