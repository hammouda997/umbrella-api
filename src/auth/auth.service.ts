import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { ApprovalStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ForgotPasswordDto,
  PUBLIC_SIGNUP_ROLES,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
  SubmitKycDto,
} from './dto/auth.dto';

type KycTokenPayload = {
  sub: number;
  purpose: 'signup_kyc';
};

export const PORTAL_BY_ROLE: Record<Role, string> = {
  SUPER_ADMIN: '/super-admin',
  ADMIN: '/admin',
  EXPERT_COMPTABLE: '/expert-comptable',
  CHEF_AGENCE: '/chef-agence',
  SUPPORT: '/support',
  PICKUP: '/pickup',
  MAGASINIER: '/magasinier',
  FINANCE: '/finance',
  EXPEDITEUR: '/expediteur',
  LIVREUR: '/livreur',
  CLIENT: '/client',
};

const PENDING_MESSAGE =
  'Votre compte est en cours de vérification. Patientez jusqu’à l’approbation de notre équipe.';
const REJECTED_MESSAGE =
  'Compte refusé — contactez le support Umbrella Express.';

type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  agencyId: number | null;
  approvalStatus?: ApprovalStatus;
  productTypes?: string[];
  parcelInputDefs?: unknown;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignUpDto) {
    if (!PUBLIC_SIGNUP_ROLES.includes(dto.role)) {
      throw new BadRequestException(
        'Public signup allows EXPEDITEUR only',
      );
    }

    const phone = dto.phone?.trim() ?? '';
    if (!/^[0-9]{8}$/.test(phone)) {
      throw new BadRequestException('Téléphone : 8 chiffres');
    }

    const governorate = dto.governorate.trim();
    const city = dto.city.trim();
    const address = dto.address.trim();
    if (!governorate || !city || address.length < 3) {
      throw new BadRequestException('Adresse incomplète');
    }

    let productTypes: string[] = [];
    let productNotes: string | null = null;
    let shopName: string | null = null;
    if (dto.role === Role.EXPEDITEUR) {
      productTypes = (dto.productTypes ?? [])
        .map((t) => t.trim())
        .filter(Boolean);
      if (productTypes.length === 0) {
        throw new BadRequestException('Choisissez au moins un type de produit');
      }
      if (productTypes.includes('Autre')) {
        const notes = dto.productNotes?.trim() ?? '';
        if (notes.length < 2) {
          throw new BadRequestException('Précisez le type de produit');
        }
        productNotes = notes;
      } else {
        productNotes = dto.productNotes?.trim() || null;
      }
      shopName = dto.shopName?.trim() || dto.name.trim();
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already registered');

    const password = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.toLowerCase(),
        phone,
        password,
        role: Role.EXPEDITEUR,
        approvalStatus: ApprovalStatus.PENDING,
        governorate,
        city,
        address,
        shopName,
        productTypes,
        productNotes,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        approvalStatus: true,
        zoneId: true,
      },
    });

    const kycToken = await this.issueKycToken(user.id);

    return {
      pending: true as const,
      message: PENDING_MESSAGE,
      kycToken,
      kycRequired: true as const,
      user,
    };
  }

  async issueKycToken(userId: number) {
    return this.jwt.signAsync(
      { sub: userId, purpose: 'signup_kyc' } satisfies KycTokenPayload,
      {
        secret: this.config.getOrThrow('JWT_SECRET'),
        expiresIn: '7d',
      },
    );
  }

  async verifyKycToken(token: string): Promise<number> {
    let payload: KycTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<KycTokenPayload>(token, {
        secret: this.config.getOrThrow('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Jeton de vérification invalide ou expiré');
    }
    if (payload.purpose !== 'signup_kyc' || !payload.sub) {
      throw new UnauthorizedException('Jeton de vérification invalide');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        approvalStatus: true,
        kycSubmittedAt: true,
      },
    });
    if (!user || user.role !== Role.EXPEDITEUR) {
      throw new UnauthorizedException('Compte introuvable');
    }
    if (user.approvalStatus === ApprovalStatus.REJECTED) {
      throw new ForbiddenException(REJECTED_MESSAGE);
    }
    return user.id;
  }

  async submitKyc(token: string, dto: SubmitKycDto) {
    const userId = await this.verifyKycToken(token);
    const cinFrontUrl = this.assertUploadPath(dto.cinFrontUrl);
    const cinBackUrl = this.assertUploadPath(dto.cinBackUrl);
    const selfieWithCinUrl = this.assertUploadPath(dto.selfieWithCinUrl);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        cinFrontUrl,
        cinBackUrl,
        selfieWithCinUrl,
        kycSubmittedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        approvalStatus: true,
        kycSubmittedAt: true,
      },
    });

    return {
      ok: true as const,
      message:
        'Pièces d’identité reçues. Votre compte reste en vérification jusqu’à validation.',
      user: updated,
    };
  }

  async getKycStatus(token: string) {
    const userId = await this.verifyKycToken(token);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        approvalStatus: true,
        cinFrontUrl: true,
        cinBackUrl: true,
        selfieWithCinUrl: true,
        kycSubmittedAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('Compte introuvable');
    return {
      ...user,
      kycComplete: Boolean(
        user.cinFrontUrl && user.cinBackUrl && user.selfieWithCinUrl,
      ),
    };
  }

  private assertUploadPath(raw: string) {
    const value = raw.trim();
    if (!value.startsWith('/uploads/')) {
      throw new BadRequestException('URL de document invalide');
    }
    if (value.includes('..') || value.length > 400) {
      throw new BadRequestException('URL de document invalide');
    }
    return value;
  }

  async signin(dto: SignInDto) {
    const login = dto.email.trim();
    const phoneLogin = /^[0-9]{8}$/.test(login);
    const user = phoneLogin
      ? await this.prisma.user.findFirst({
          where: {
            role: Role.CLIENT,
            OR: [
              { phone: login },
              { email: `c${login}@client.umbrella.tn` },
            ],
            isActive: true,
          },
        })
      : await this.prisma.user.findUnique({
          where: { email: login.toLowerCase() },
        });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (user.approvalStatus === ApprovalStatus.PENDING) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'ACCOUNT_PENDING',
        message: PENDING_MESSAGE,
      });
    }
    if (user.approvalStatus === ApprovalStatus.REJECTED) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'ACCOUNT_REJECTED',
        message: REJECTED_MESSAGE,
      });
    }

    const publicUser: PublicUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      agencyId: user.agencyId,
      approvalStatus: user.approvalStatus,
      productTypes: user.productTypes ?? [],
      parcelInputDefs: user.parcelInputDefs ?? [],
    };
    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.role,
      user.agencyId,
    );
    return {
      user: publicUser,
      portal: PORTAL_BY_ROLE[user.role],
      ...tokens,
    };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        agencyId: true,
        approvalStatus: true,
        zoneId: true,
        governorate: true,
        city: true,
        address: true,
        productTypes: true,
        parcelInputDefs: true,
        productNotes: true,
        shopName: true,
        createdAt: true,
        agency: { select: { id: true, name: true, governorate: true } },
        homeZone: { select: { id: true, name: true, governorate: true } },
      },
    });
    if (!user) return null;
    return { ...user, portal: PORTAL_BY_ROLE[user.role] };
  }

  async refresh(refreshToken: string) {
    let payload: {
      sub: number;
      email: string;
      role: Role;
      agencyId?: number | null;
    };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (
      !user?.refreshToken ||
      !user.isActive ||
      user.approvalStatus !== ApprovalStatus.APPROVED
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const match = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!match) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.role,
      user.agencyId,
    );
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        agencyId: user.agencyId,
        approvalStatus: user.approvalStatus,
        productTypes: user.productTypes ?? [],
        parcelInputDefs: user.parcelInputDefs ?? [],
      },
      portal: PORTAL_BY_ROLE[user.role],
      ...tokens,
    };
  }

  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const generic = {
      ok: true as const,
      message:
        'Si un compte existe pour cet email, un lien de réinitialisation a été préparé.',
    };

    if (!user || !user.isActive) {
      this.logger.log(`forgot-password no-op email=${email}`);
      return generic;
    }

    const rawToken = randomBytes(32).toString('hex');
    const hashed = createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashed,
        passwordResetExpires: expires,
      },
    });

    this.logger.log(
      `forgot-password email=${email} inbox=${this.config.get('CONTACT_INBOX') ?? 'unset'} expires=${expires.toISOString()}`,
    );

    const isProd =
      this.config.get<string>('NODE_ENV')?.toLowerCase() === 'production';
    if (!isProd) {
      return {
        ...generic,
        /** Dev only — never returned in production. */
        resetToken: rawToken,
      };
    }
    return generic;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashed = createHash('sha256').update(dto.token.trim()).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: hashed,
        passwordResetExpires: { gt: new Date() },
        isActive: true,
      },
    });
    if (!user) {
      throw new BadRequestException(
        'Lien de réinitialisation invalide ou expiré',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(dto.password, 12),
        passwordResetToken: null,
        passwordResetExpires: null,
        refreshToken: null,
      },
    });

    return {
      ok: true as const,
      message: 'Mot de passe mis à jour — vous pouvez vous connecter.',
    };
  }

  private async issueTokens(
    userId: number,
    email: string,
    role: Role,
    agencyId: number | null,
  ) {
    const payload = { sub: userId, email, role, agencyId };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow('JWT_SECRET'),
      expiresIn: '1h',
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashed },
    });

    return { accessToken, refreshToken };
  }
}
