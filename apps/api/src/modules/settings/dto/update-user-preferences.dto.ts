import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { PreferredLanguage } from '../../users/entities/user.entity';

export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsEnum(PreferredLanguage)
  language?: PreferredLanguage;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  notifications_enabled?: boolean;
}
