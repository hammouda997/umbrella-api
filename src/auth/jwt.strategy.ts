import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ApprovalStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type JwtPayload = {
  sub: number;
  email: string;
  role: Role;
  agencyId?: number | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        agencyId: true,
        isActive: true,
        approvalStatus: true,
      },
    });

    if (
      !user ||
      !user.isActive ||
      user.approvalStatus !== ApprovalStatus.APPROVED
    ) {
      throw new UnauthorizedException('Session invalide ou compte inactif');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId ?? null,
    };
  }
}
