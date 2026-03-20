import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ConditionOperator, CheckFrequency } from '../entities/alert.entity';

export class UpdateAlertDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  metricQuery?: string;

  @IsOptional()
  @IsEnum(ConditionOperator)
  conditionOperator?: ConditionOperator;

  @IsOptional()
  @IsNumber()
  thresholdValue?: number;

  @IsOptional()
  @IsEnum(CheckFrequency)
  checkFrequency?: CheckFrequency;
}
