import { IsString, IsUUID, IsOptional, IsArray, ArrayMinSize } from 'class-validator';

export class CreateReportDto {
  @IsString()
  name: string;

  @IsUUID()
  dashboardId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  widgetIds: string[];

  @IsOptional()
  @IsString()
  description?: string;
}
