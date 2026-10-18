import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ALLOWED_CATEGORY_KEYS,
  APP_ROLES_FOR_JOURNEY,
  STATUS_CATEGORY_ICONS,
} from '../status-category.defaults';

const KEY_LIST = [...ALLOWED_CATEGORY_KEYS];
const ICON_LIST = [...STATUS_CATEGORY_ICONS];
const ROLE_LIST = [...APP_ROLES_FOR_JOURNEY];

export class CreateStatusCategoryDto {
  @ApiProperty({ enum: KEY_LIST })
  @IsString()
  @IsIn(KEY_LIST)
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label!: string;

  @ApiProperty({ example: '#E11D48' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a hex value like #E11D48',
  })
  color!: string;

  @ApiProperty({ enum: ICON_LIST })
  @IsString()
  @IsIn(ICON_LIST)
  icon!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Include this status in the parcel parcours UI',
  })
  @IsOptional()
  @IsBoolean()
  showInJourney?: boolean;

  @ApiPropertyOptional({
    type: [String],
    enum: ROLE_LIST,
    description: 'Empty = all roles can see the step',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(ROLE_LIST, { each: true })
  visibleRoles?: string[];
}

export class UpdateStatusCategoryDto extends PartialType(
  CreateStatusCategoryDto,
) {
  @ApiPropertyOptional({ enum: KEY_LIST })
  @IsOptional()
  @IsString()
  @IsIn(KEY_LIST)
  key?: string;
}
