import { IsString, IsIn, IsArray, IsEmail, ArrayMinSize, IsOptional } from 'class-validator';

export class ScheduleReportDto {
  @IsString()
  @IsIn(['daily', 'weekly', 'monthly'])
  frequency: 'daily' | 'weekly' | 'monthly';

  @IsArray()
  @IsEmail({}, { each: true })
  @ArrayMinSize(1)
  recipients: string[];

  @IsOptional()
  @IsString()
  timezone?: string;
}
