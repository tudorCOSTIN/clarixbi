import { IsOptional, IsString, IsEnum, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PreferredLanguage } from '../entities/user.entity';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  avatar_url?: string;

  @ApiPropertyOptional({ enum: PreferredLanguage })
  @IsOptional()
  @IsEnum(PreferredLanguage)
  preferred_language?: PreferredLanguage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preferred_timezone?: string;
}
