import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReturnLotDto {
  @ApiProperty({ type: [Number], maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  parcelIds!: number[];

  @ApiPropertyOptional({ description: 'Destination manifeste retour' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  destinationLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destinationAgencyId?: number;
}

export class UpdateReturnLotDestinationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  destinationLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destinationAgencyId?: number;
}
