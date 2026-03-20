import { IsString, IsUUID, IsEnum, IsNumber } from 'class-validator';
import { ConditionOperator, CheckFrequency } from '../entities/alert.entity';

export class CreateAlertDto {
  @IsString()
  name: string;

  @IsUUID()
  dataSourceId: string;

  @IsString()
  metricQuery: string;

  @IsEnum(ConditionOperator)
  conditionOperator: ConditionOperator;

  @IsNumber()
  thresholdValue: number;

  @IsEnum(CheckFrequency)
  checkFrequency: CheckFrequency;
}
