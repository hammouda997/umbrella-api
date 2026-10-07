import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DeliveryMode, ParcelStatus } from '@prisma/client';
import { Type, Transform } from 'class-transformer';

export const DELIVERY_WINDOWS = [
  'matin',
  'apres-midi',
  'soir',
  'journee',
] as const;
export type DeliveryWindow = (typeof DELIVERY_WINDOWS)[number];

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === 'Oui';

export class CreateParcelDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  recipientName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone2?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  governorate!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  address!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  articleCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parcelCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  paymentMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  allowOpen?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  tryProduct?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  liabilityAcceptedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isExchange?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  exchangeNotes?: string;

  @ApiPropertyOptional({
    enum: DeliveryMode,
    description:
      'Omit to auto-resolve from DeliveryRoute for the governorate (default EXTERNAL)',
  })
  @IsOptional()
  @IsEnum(DeliveryMode)
  mode?: DeliveryMode;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  zoneId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ enum: DELIVERY_WINDOWS })
  @IsOptional()
  @IsIn(DELIVERY_WINDOWS)
  deliveryWindow?: DeliveryWindow;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  landmarkPhotoName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  addressQuality?: number;
}

export class UpdateParcelDto extends PartialType(CreateParcelDto) {}

export class AssignDriverDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  driverId!: number;
}

export class UpdateParcelStatusDto {
  @ApiProperty({ enum: ParcelStatus })
  @IsEnum(ParcelStatus)
  status!: ParcelStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiPropertyOptional({
    description: 'Client hint only; the actor is taken from the token',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  actor?: string;

  @ApiPropertyOptional({
    description: 'Livreur id when dispatching (EN_COURS)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  driverId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}

export class ScanParcelDto {
  @ApiProperty({
    description: 'Barcode / parcel code from HID scanner or keyboard',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  code!: string;

  @ApiPropertyOptional({
    enum: ParcelStatus,
    description: 'Omit for lookup-only scan (records a scan event)',
  })
  @IsOptional()
  @IsEnum(ParcelStatus)
  status?: ParcelStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiPropertyOptional({
    description: 'Livreur id when dispatching (EN_COURS)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  driverId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}

export class SwitchParcelModeDto {
  @ApiProperty({ enum: DeliveryMode })
  @IsEnum(DeliveryMode)
  mode!: DeliveryMode;
}
