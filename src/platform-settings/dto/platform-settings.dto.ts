import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiProperty({ example: 48, minimum: 1, maximum: 720 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  versementHoldHours!: number;
}
