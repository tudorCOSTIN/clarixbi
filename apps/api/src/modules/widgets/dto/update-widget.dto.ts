import { IsString, IsEnum, IsOptional, IsObject, IsUUID, MaxLength } from 'class-validator';
import { WidgetType } from '../entities/widget.entity';

export class UpdateWidgetDto {
  @IsOptional()
  @IsEnum(WidgetType)
  type?: WidgetType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  query_sql?: string;

  @IsOptional()
  @IsObject()
  position?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  data_source_id?: string;
}
