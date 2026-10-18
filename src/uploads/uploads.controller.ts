import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import { Roles } from '../common/decorators/auth.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '@prisma/client';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const KINDS = new Set([
  'facture',
  'decharge',
  'cin',
  'cin-front',
  'cin-back',
  'selfie-cin',
  'receipt',
  'other',
]);

function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

function sanitizeKind(raw: unknown): string {
  const k = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return KINDS.has(k) ? k : 'other';
}

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('uploads')
export class UploadsController {
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.EXPERT_COMPTABLE,
    Role.CHEF_AGENCE,
    Role.FINANCE,
    Role.MAGASINIER,
    Role.PICKUP,
    Role.LIVREUR,
    Role.EXPEDITEUR,
  )
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: [
      'facture',
      'decharge',
      'cin',
      'cin-front',
      'cin-back',
      'selfie-cin',
      'receipt',
      'other',
    ],
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
          const kind = sanitizeKind(req.query?.kind);
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
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('kind') kindQuery?: string,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    const kind = sanitizeKind(kindQuery);
    return {
      url: `/uploads/${file.filename}`,
      kind,
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}
