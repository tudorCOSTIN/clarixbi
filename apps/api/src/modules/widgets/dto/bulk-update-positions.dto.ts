import { IsArray, ValidateNested, IsUUID, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class WidgetPositionDto {
  @IsUUID()
  id: string;

  @IsObject()
  position: Record<string, unknown>;
}

export class BulkUpdatePositionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WidgetPositionDto)
  widgets: WidgetPositionDto[];
}
