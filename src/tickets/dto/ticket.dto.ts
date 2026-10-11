import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketKind, TicketStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateTicketDto {
  @ApiPropertyOptional({ enum: TicketKind, default: TicketKind.GENERAL })
  @IsOptional()
  @IsEnum(TicketKind)
  kind?: TicketKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parcelId?: number;

  @ApiPropertyOptional({
    description: 'Nouveau montant (requis pour CHANGEMENT_PRIX)',
  })
  @ValidateIf(
    (o: CreateTicketDto) => o.kind === TicketKind.CHANGEMENT_PRIX,
  )
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  requestedPrice?: number;
}

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: TicketStatus })
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}
