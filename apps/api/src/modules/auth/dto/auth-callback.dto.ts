import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthCallbackDto {
  @ApiProperty({ description: 'Authorization code from Auth0' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'Redirect URI used in the authorize request (must match)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsUrl({ require_tld: false })
  redirect_uri?: string;
}
