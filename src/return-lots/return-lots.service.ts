import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReturnLotStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { RETURN_STATUSES } from '../parcels/parcel-transitions';
import {
  PARCEL_LIST_INCLUDE,
  toParcelListView,
} from '../parcels/parcel-view';
import {
  CreateReturnLotDto,
  UpdateReturnLotDestinationDto,
} from './dto/return-lot.dto';

const MAX_LOT_SIZE = 20;

const LOT_INCLUDE = {
  sender: { select: { id: true, name: true, email: true } },
  destinationAgency: { select: { id: true, name: true, governorate: true } },
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      parcel: { include: PARCEL_LIST_INCLUDE },
    },
  },
} satisfies Prisma.ReturnLotInclude;

const OPS_READ: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.CHEF_AGENCE,
  Role.MAGASINIER,
  Role.SUPPORT,
  Role.PICKUP,
  Role.LIVREUR,
];

@Injectable()
export class ReturnLotsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateCode() {
    const n = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
    return `UMB-LOT-${n}`;
  }

  private normalizeCode(code: string): string {
    const normalized = code.trim().slice(0, 64);
    if (!normalized || !/^[A-Za-z0-9_-]+$/.test(normalized)) {
      throw new BadRequestException('Invalid lot code');
    }
    return normalized;
  }

  private toLotView(
    lot: Prisma.ReturnLotGetPayload<{ include: typeof LOT_INCLUDE }>,
  ) {
    const parcels = lot.items.map((item) => toParcelListView(item.parcel));
    return {
      kind: 'return_lot' as const,
      id: lot.id,
      code: lot.code,
      status: lot.status,
      senderId: lot.senderId,
      sender: lot.sender,
      destinationLabel: lot.destinationLabel,
      destinationAgencyId: lot.destinationAgencyId,
      destinationAgency: lot.destinationAgency,
      colisCount: parcels.length,
      itemCount: parcels.length,
      closedAt: lot.closedAt,
      createdAt: lot.createdAt,
      updatedAt: lot.updatedAt,
      parcels,
    };
  }

  private canReadLot(user: AuthUser, senderId: number) {
    if (user.role === Role.EXPEDITEUR) return user.id === senderId;
    return OPS_READ.includes(user.role);
  }

  async create(user: AuthUser, dto: CreateReturnLotDto) {
    if (user.role !== Role.EXPEDITEUR) throw new ForbiddenException();

    const parcelIds = [...new Set(dto.parcelIds)];
    if (parcelIds.length > MAX_LOT_SIZE) {
      throw new BadRequestException(`Maximum ${MAX_LOT_SIZE} colis par lot`);
    }

    const parcels = await this.prisma.parcel.findMany({
      where: {
        id: { in: parcelIds },
        senderId: user.id,
        status: { in: RETURN_STATUSES },
      },
      select: { id: true },
    });

    if (parcels.length !== parcelIds.length) {
      throw new BadRequestException(
        'Certains colis sont introuvables, hors retours, ou ne vous appartiennent pas',
      );
    }

    const alreadyInLot = await this.prisma.returnLotItem.findMany({
      where: {
        parcelId: { in: parcelIds },
        lot: { status: ReturnLotStatus.OPEN },
      },
      select: { parcelId: true },
    });
    if (alreadyInLot.length) {
      throw new BadRequestException(
        'Certains colis sont déjà dans un lot retour ouvert',
      );
    }

    let code = this.generateCode();
    for (let i = 0; i < 5; i += 1) {
      const clash = await this.prisma.returnLot.findUnique({ where: { code } });
      if (!clash) break;
      code = this.generateCode();
    }

    if (dto.destinationAgencyId) {
      const agency = await this.prisma.agency.findUnique({
        where: { id: dto.destinationAgencyId },
      });
      if (!agency) throw new BadRequestException('Agence destination introuvable');
    }

    const created = await this.prisma.returnLot.create({
      data: {
        code,
        senderId: user.id,
        destinationLabel: dto.destinationLabel?.trim() || null,
        destinationAgencyId: dto.destinationAgencyId ?? null,
        items: {
          create: parcelIds.map((parcelId, sortOrder) => ({
            parcelId,
            sortOrder,
          })),
        },
      },
      include: LOT_INCLUDE,
    });

    return this.toLotView(created);
  }

  async updateDestination(
    user: AuthUser,
    id: number,
    dto: UpdateReturnLotDestinationDto,
  ) {
    const ops: Role[] = [
      Role.SUPER_ADMIN,
      Role.ADMIN,
      Role.CHEF_AGENCE,
      Role.MAGASINIER,
      Role.EXPEDITEUR,
    ];
    if (!ops.includes(user.role)) throw new ForbiddenException();

    const lot = await this.prisma.returnLot.findUnique({ where: { id } });
    if (!lot) throw new NotFoundException('Lot introuvable');
    if (user.role === Role.EXPEDITEUR && lot.senderId !== user.id) {
      throw new ForbiddenException();
    }
    if (dto.destinationAgencyId) {
      const agency = await this.prisma.agency.findUnique({
        where: { id: dto.destinationAgencyId },
      });
      if (!agency) throw new BadRequestException('Agence destination introuvable');
    }

    const updated = await this.prisma.returnLot.update({
      where: { id },
      data: {
        ...(dto.destinationLabel !== undefined
          ? { destinationLabel: dto.destinationLabel?.trim() || null }
          : {}),
        ...(dto.destinationAgencyId !== undefined
          ? { destinationAgencyId: dto.destinationAgencyId }
          : {}),
      },
      include: LOT_INCLUDE,
    });
    return this.toLotView(updated);
  }

  async list(user: AuthUser) {
    const where: Prisma.ReturnLotWhereInput =
      user.role === Role.EXPEDITEUR
        ? { senderId: user.id }
        : OPS_READ.includes(user.role)
          ? {}
          : { id: -1 };

    const rows = await this.prisma.returnLot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: LOT_INCLUDE,
    });
    return rows.map((row) => this.toLotView(row));
  }

  async findOne(user: AuthUser, id: number) {
    const lot = await this.prisma.returnLot.findUnique({
      where: { id },
      include: LOT_INCLUDE,
    });
    if (!lot) throw new NotFoundException('Lot introuvable');
    if (!this.canReadLot(user, lot.senderId)) throw new ForbiddenException();
    return this.toLotView(lot);
  }

  async findByCode(user: AuthUser, code: string) {
    const normalized = this.normalizeCode(code);
    const lot = await this.prisma.returnLot.findFirst({
      where: {
        OR: [
          { code: normalized },
          { code: { equals: normalized, mode: 'insensitive' } },
        ],
      },
      include: LOT_INCLUDE,
    });
    if (!lot) throw new NotFoundException('Lot introuvable');
    if (!this.canReadLot(user, lot.senderId)) throw new ForbiddenException();
    return this.toLotView(lot);
  }

  /** Used by parcel scan/lookup — returns null if code is not a lot. */
  async resolveByCode(code: string) {
    try {
      const normalized = this.normalizeCode(code);
      return this.prisma.returnLot.findFirst({
        where: {
          OR: [
            { code: normalized },
            { code: { equals: normalized, mode: 'insensitive' } },
          ],
        },
        include: LOT_INCLUDE,
      });
    } catch {
      return null;
    }
  }

  toPublicView(
    lot: Prisma.ReturnLotGetPayload<{ include: typeof LOT_INCLUDE }>,
  ) {
    return this.toLotView(lot);
  }
}
