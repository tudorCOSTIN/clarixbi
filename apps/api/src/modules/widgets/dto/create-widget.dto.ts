import { IsString, IsEnum, IsOptional, IsObject, IsUUID, MaxLength } from 'class-validator';
import { WidgetType } from '../entities/widget.entity';

export class CreateWidgetDto {
  @IsEnum(WidgetType)
  type: WidgetType;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  position?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  data_source_id?: string;
}
