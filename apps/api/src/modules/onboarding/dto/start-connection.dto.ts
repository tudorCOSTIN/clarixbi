import { IsString, IsNotEmpty } from 'class-validator';

export class StartConnectionDto {
  @IsString()
  @IsNotEmpty()
  sourceType: string;
}
