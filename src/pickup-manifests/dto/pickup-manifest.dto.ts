import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class ClosePickupManifestDto {
  @ApiProperty({ description: 'Photo / scan décharge cachetée' })
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  dechargeUrl!: string;

  @ApiProperty({ description: 'Photo CIN pickupeur' })
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  cinUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  note?: string;
}
