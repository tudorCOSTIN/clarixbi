import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { DataSourceType } from '../entities/data-source.entity';

export class CreateDataSourceDto {
  @IsEnum(DataSourceType)
  type: DataSourceType;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  credentials: Record<string, string>;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}
