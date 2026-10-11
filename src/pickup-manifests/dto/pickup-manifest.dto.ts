import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PickupManifestKind } from '@prisma/client';

export class CreatePickupManifestDto {
  @ApiProperty({ enum: PickupManifestKind })
  @IsEnum(PickupManifestKind)
  kind!: PickupManifestKind;

  @ApiProperty({ type: [Number], maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  parcelIds!: number[];
}
