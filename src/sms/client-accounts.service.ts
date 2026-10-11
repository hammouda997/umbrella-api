import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApprovalStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from './sms.service';

export type ProvisionedClient = {
  id: number;
  phone: string;
  email: string;
  name: string;
  created: boolean;
  tempPassword: string | null;
};

@Injectable()
export class ClientAccountsService {
  private readonly logger = new Logger(ClientAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly config: ConfigService,
  ) {}

  clientEmailForPhone(phone: string): string {
    return `c${phone}@client.umbrella.tn`;
  }

  private tempPassword(): string {
    return randomBytes(4).toString('hex'); // 8 hex chars
  }

  async ensureClient(input: {
    phone: string;
    name: string;
    governorate?: string;
    city?: string;
    address?: string;
  }): Promise<ProvisionedClient> {
    const phone = input.phone.replace(/\D/g, '').slice(-8);
    if (!/^[0-9]{8}$/.test(phone)) {
      throw new Error('Invalid client phone');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        role: Role.CLIENT,
        OR: [{ phone }, { email: this.clientEmailForPhone(phone) }],
      },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
      },
    });

    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: input.name.trim() || existing.name,
          governorate: input.governorate?.trim() || undefined,
          city: input.city?.trim() || undefined,
          address: input.address?.trim() || undefined,
          approvalStatus: ApprovalStatus.APPROVED,
          isActive: true,
        },
      });
      return {
        id: existing.id,
        phone: existing.phone ?? phone,
        email: existing.email,
        name: existing.name,
        created: false,
        tempPassword: null,
      };
    }

    const plain = this.tempPassword();
    const email = this.clientEmailForPhone(phone);
    const user = await this.prisma.user.create({
      data: {
        name: input.name.trim() || `Client ${phone}`,
        email,
        phone,
        password: await bcrypt.hash(plain, 12),
        role: Role.CLIENT,
        approvalStatus: ApprovalStatus.APPROVED,
        isActive: true,
        governorate: input.governorate?.trim() || null,
        city: input.city?.trim() || null,
        address: input.address?.trim() || null,
      },
      select: { id: true, phone: true, email: true, name: true },
    });

    return {
      id: user.id,
      phone: user.phone ?? phone,
      email: user.email,
      name: user.name,
      created: true,
      tempPassword: plain,
    };
  }

  async notifyClientParcelCreated(opts: {
    phone: string;
    name: string;
    parcelCode: string;
    governorate?: string;
    city?: string;
    address?: string;
  }) {
    try {
      const client = await this.ensureClient(opts);
      const appUrl = (
        this.config.get<string>('WEB_APP_URL') || 'http://localhost:3010'
      ).replace(/\/$/, '');
      const trackUrl = `${appUrl}/track?code=${encodeURIComponent(opts.parcelCode)}`;
      const loginUrl = `${appUrl}/login`;

      const lines = [
        `Umbrella: colis ${opts.parcelCode} cree pour vous.`,
        `Suivi: ${trackUrl}`,
        `Espace client: ${loginUrl}`,
        `Identifiant: ${client.phone} (ou ${client.email})`,
      ];
      if (client.tempPassword) {
        lines.push(`Mot de passe temporaire: ${client.tempPassword}`);
        lines.push('Changez-le dans Parametres apres connexion.');
      } else {
        lines.push('Connectez-vous avec votre mot de passe client.');
      }

      await this.sms.send(client.phone, lines.join('\n'));
      return client;
    } catch (err) {
      this.logger.warn(`Client notify failed: ${String(err)}`);
      return null;
    }
  }

  async notifyLivreurAssigned(opts: {
    driverPhone: string | null | undefined;
    driverName: string;
    parcelCode: string;
    recipientName: string;
    city: string;
  }) {
    if (!opts.driverPhone) return;
    const appUrl = (
      this.config.get<string>('WEB_APP_URL') || 'http://localhost:3010'
    ).replace(/\/$/, '');
    const body = [
      `Umbrella: nouveau colis assigne ${opts.parcelCode}.`,
      `${opts.recipientName} — ${opts.city}`,
      `Ouvrir: ${appUrl}/livreur/parcels`,
    ].join('\n');
    await this.sms.send(opts.driverPhone, body);
  }
}
