import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
  SubmitKycDto,
} from './dto/auth.dto';
import { Public } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const KYC_KINDS = new Set(['cin-front', 'cin-back', 'selfie-cin', 'cin']);

function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

function bearerToken(authorization?: string): string {
  if (!authorization?.startsWith('Bearer ')) {
    throw new BadRequestException('Jeton de vérification requis');
  }
  return authorization.slice('Bearer '.length).trim();
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('signup')
  signup(@Body() dto: SignUpDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('kyc')
  kycStatus(@Headers('authorization') authorization?: string) {
    return this.auth.getKycStatus(bearerToken(authorization));
  }

  @Public()
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Post('kyc')
  submitKyc(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: SubmitKycDto,
  ) {
    return this.auth.submitKyc(bearerToken(authorization), dto);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('kyc/upload')
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: ['cin-front', 'cin-back', 'selfie-cin', 'cin'],
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (
          _req: Request,
          _file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void,
        ) => {
          ensureUploadDir();
          cb(null, UPLOAD_DIR);
        },
        filename: (
          req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const raw =
            typeof req.query?.kind === 'string'
              ? req.query.kind.trim().toLowerCase()
              : 'cin';
          const kind = KYC_KINDS.has(raw) ? raw : 'cin';
          const ext = extname(file.originalname).slice(0, 12) || '.bin';
          cb(
            null,
            `${kind}-${Date.now()}-${randomBytes(8).toString('hex')}${ext}`,
          );
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        const ok =
          file.mimetype.startsWith('image/') ||
          file.mimetype === 'application/pdf';
        if (!ok) {
          cb(new Error('Fichier image ou PDF requis'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async kycUpload(
    @Headers('authorization') authorization: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('kind') kindQuery?: string,
  ) {
    await this.auth.verifyKycToken(bearerToken(authorization));
    if (!file) throw new BadRequestException('Fichier requis');
    const raw = (kindQuery ?? 'cin').trim().toLowerCase();
    const kind = KYC_KINDS.has(raw) ? raw : 'cin';
    return {
      url: `/uploads/${file.filename}`,
      kind,
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('signin')
  signin(@Body() dto: SignInDto) {
    return this.auth.signin(dto);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: { id: number }) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @HttpCode(204)
  @Post('logout')
  logout(@CurrentUser() user: { id: number }) {
    return this.auth.logout(user.id);
  }
}
