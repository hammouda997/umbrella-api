import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CashRegisterKind, CashMovementType } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCashMovementDto {
  @ApiProperty({ enum: CashMovementType })
  @IsEnum(CashMovementType)
  type!: CashMovementType;

  @ApiProperty({ example: 50 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  amount!: number;

  @ApiProperty({ example: 'Frais carburant' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  note?: string;

  @ApiPropertyOptional({ description: 'Livreur lié (caisse COD)' })
  @IsOptional()
  @IsNumber()
  livreurId?: number;

  @ApiPropertyOptional({ description: 'Réf. facture expert (sortie DEPENSE)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptUrl?: string;
}

export class EnsureCashRegistersDto {
  @ApiPropertyOptional({ enum: CashRegisterKind })
  @IsOptional()
  @IsEnum(CashRegisterKind)
  kind?: CashRegisterKind;
}

export class CreateLivreurDepositDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsNumber({}, { each: true })
  parcelIds!: number[];

  @ApiProperty({ example: 120.5 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  amount!: number;

  @ApiProperty({ example: '/uploads/receipt.jpg' })
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  receiptUrl!: string;
}

export class RejectLivreurDepositDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  reason?: string;
}
