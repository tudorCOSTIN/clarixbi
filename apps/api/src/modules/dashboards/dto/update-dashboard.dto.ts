import { IsString, IsOptional, IsArray, MaxLength } from 'class-validator';

export class UpdateDashboardDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  layout?: Record<string, unknown>[];
}
