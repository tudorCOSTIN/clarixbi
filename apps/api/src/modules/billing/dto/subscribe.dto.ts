import { IsEnum, IsUUID } from 'class-validator';
import { BillingPeriod } from '../entities/subscription.entity';

export class SubscribeDto {
  @IsUUID()
  planId: string;

  @IsEnum(BillingPeriod)
  billingPeriod: BillingPeriod;
}

export class ChangePlanDto {
  @IsUUID()
  planId: string;
}
