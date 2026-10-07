import { IsArray, IsEnum, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DeliveryMode } from '@prisma/client';

export class UpsertDeliveryRouteDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  governorate!: string;

  @ApiProperty({ enum: DeliveryMode })
  @IsEnum(DeliveryMode)
  mode!: DeliveryMode;
}

export class BulkUpsertDeliveryRoutesDto {
  @ApiProperty({ type: [UpsertDeliveryRouteDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertDeliveryRouteDto)
  routes!: UpsertDeliveryRouteDto[];
}
