import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const VERSEMENT_HOLD_HOURS_KEY = 'versementHoldHours';
export const DEFAULT_VERSEMENT_HOLD_HOURS = 48;

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getVersementHoldHours(): Promise<number> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: VERSEMENT_HOLD_HOURS_KEY },
    });
    if (!row) return DEFAULT_VERSEMENT_HOLD_HOURS;
    const n = Number(row.value);
    if (!Number.isFinite(n) || n < 1) return DEFAULT_VERSEMENT_HOLD_HOURS;
    return Math.min(720, Math.floor(n));
  }

  async getPlatform() {
    const versementHoldHours = await this.getVersementHoldHours();
    return { versementHoldHours };
  }

  async updatePlatform(dto: { versementHoldHours: number }) {
    const hours = Number(dto.versementHoldHours);
    if (!Number.isFinite(hours) || hours < 1 || hours > 720) {
      throw new BadRequestException(
        'Délai de versement invalide (1–720 heures)',
      );
    }
    const value = String(Math.floor(hours));
    await this.prisma.platformSetting.upsert({
      where: { key: VERSEMENT_HOLD_HOURS_KEY },
      create: { key: VERSEMENT_HOLD_HOURS_KEY, value },
      update: { value },
    });
    return this.getPlatform();
  }
}
