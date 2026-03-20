import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class UpdateReportDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  widgetIds?: string[];
}
