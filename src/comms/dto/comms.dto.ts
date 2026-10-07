import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CallStatus } from '@prisma/client';

export class CreateConversationDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  peerUserId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parcelId?: number;
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class MessagesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursor?: number;

  @ApiPropertyOptional({ default: 40 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}

export class DirectoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class CreateCallDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  conversationId!: number;
}

export class UpdateCallDto {
  @ApiProperty({ enum: CallStatus })
  @IsEnum(CallStatus)
  status!: CallStatus;
}
