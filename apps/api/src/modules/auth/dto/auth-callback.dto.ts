import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthCallbackDto {
  @ApiProperty({ description: 'Authorization code from Auth0' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
