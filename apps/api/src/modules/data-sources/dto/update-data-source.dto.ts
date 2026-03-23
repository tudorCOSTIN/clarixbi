import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateDataSourceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  sync_interval_minutes?: number;
}
