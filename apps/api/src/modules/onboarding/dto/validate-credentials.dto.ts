import { IsString, IsNotEmpty, IsObject } from 'class-validator';

export class ValidateCredentialsDto {
  @IsString()
  @IsNotEmpty()
  sourceType: string;

  @IsObject()
  credentials: Record<string, string>;
}
