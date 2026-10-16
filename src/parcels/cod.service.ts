import { Injectable } from '@nestjs/common';
import { ParcelStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CashService } from '../cash/cash.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

const DELIVERED: ParcelStatus[] = [
  ParcelStatus.LIVRES,
  ParcelStatus.LIVRES_PAYES,
];

@Injectable()
export class CodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cash: CashService,
  ) {}

  async list() {
    const rows = await this.prisma.parcel.findMany({
      where: { status: { in: DELIVERED } },
      orderBy: [
        { codSettledAt: { sort: 'asc', nulls: 'first' } },
        { updatedAt: 'desc' },
      ],
      select: {
        id: true,
        code: true,
        recipientName: true,
        city: true,
        price: true,
        status: true,
        codSettledAt: true,
        codSettledBy: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
      },
    });

    const items = rows.map((r) => ({ ...r, price: Number(r.price) }));
    const open = items.filter((i) => !i.codSettledAt);
    const settled = items.filter((i) => i.codSettledAt);
    const sum = (list: typeof items) =>
      Math.round(list.reduce((s, i) => s + i.price, 0) * 1000) / 1000;

    return {
      items,
      summary: {
        openAmount: sum(open),
        openCount: open.length,
        settledAmount: sum(settled),
        settledCount: settled.length,
      },
    };
  }

  async settle(user: AuthUser, parcelIds: number[]) {
    const eligible = await this.prisma.parcel.findMany({
      where: {
        id: { in: parcelIds },
        status: { in: DELIVERED },
        codSettledAt: null,
      },
      select: { id: true, price: true, driverId: true },
    });
    const ids = eligible.map((p) => p.id);
    if (ids.length === 0) return { settled: 0 };

    const amount =
      Math.round(eligible.reduce((s, p) => s + Number(p.price), 0) * 1000) /
      1000;
    const livreurId = eligible.find((p) => p.driverId)?.driverId ?? null;

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.parcel.updateMany({
        where: { id: { in: ids } },
        data: { codSettledAt: now, codSettledById: user.id },
      }),
      this.prisma.parcelEvent.createMany({
        data: ids.map((parcelId) => ({
          parcelId,
          label: 'Montant COD encaissé',
          actorId: user.id,
          createdAt: now,
        })),
      }),
    ]);

    await this.cash.creditCodSettlement({
      actorId: user.id,
      amount,
      parcelIds: ids,
      livreurId,
    });

    return { settled: ids.length, amount };
  }
}
