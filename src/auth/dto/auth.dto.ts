import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Public self-registration only */
export const PUBLIC_SIGNUP_ROLES: Role[] = [Role.EXPEDITEUR, Role.LIVREUR];

export class SignUpDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @ApiProperty({ description: 'Min 8 chars, at least one letter and one digit' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: 'Password must include at least one letter and one digit',
  })
  password!: string;

  @ApiProperty({ example: '20123456' })
  @IsString()
  @Matches(/^[0-9]{8}$/, { message: 'Phone must be 8 digits' })
  phone!: string;

  @ApiProperty({ enum: PUBLIC_SIGNUP_ROLES })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  governorate!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  address!: string;

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((o: SignUpDto) => o.role === Role.EXPEDITEUR)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  productTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shopName?: string;
}

export class SignInDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}
