import { IsBoolean } from 'class-validator';

export class ToggleAlertDto {
  @IsBoolean()
  isActive: boolean;
}
