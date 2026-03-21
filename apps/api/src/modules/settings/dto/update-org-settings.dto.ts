import { IsOptional, IsString, IsEnum } from 'class-validator';
import { DefaultLanguage } from '../../organizations/entities/organization.entity';

export class UpdateOrgSettingsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  default_timezone?: string;

  @IsOptional()
  @IsEnum(DefaultLanguage)
  default_language?: DefaultLanguage;
}
