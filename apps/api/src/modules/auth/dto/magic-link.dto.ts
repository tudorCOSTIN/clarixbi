import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MagicLinkDto {
  @ApiProperty({ description: 'User email for magic link login' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
