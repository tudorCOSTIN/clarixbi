import { IsString, IsOptional } from 'class-validator';

export class StartSyncDto {
  @IsString()
  @IsOptional()
  dataset?: string;
}
