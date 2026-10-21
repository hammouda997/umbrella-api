import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateStockItemDto {
  @ApiProperty({ example: 'T-shirt' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Noir', description: 'Variante (couleur…)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  variant?: string;

  @ApiPropertyOptional({ example: 'M', description: 'Taille' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  size?: string;

  @ApiPropertyOptional({ example: 'TS-NOIR-M', description: 'Référence SKU' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sku?: string;

  @ApiProperty({ example: 300 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;

  @ApiProperty({ example: 50, description: 'Prix d’achat unitaire (DT)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiPropertyOptional({
    example: 98,
    description: 'Prix de vente cible (DT) — estimation marge',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultSalePrice?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Alerte quand quantité ≤ ce seuil',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockAt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateStockItemDto extends PartialType(CreateStockItemDto) {}

export class AdjustStockQtyDto {
  @ApiProperty({
    description: 'Delta (+ entrée / − sortie). Ex. +10 ou −2',
    example: 10,
  })
  @Type(() => Number)
  @IsInt()
  delta!: number;
}
