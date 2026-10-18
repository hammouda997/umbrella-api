import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ParcelStatus,
  PickupManifestKind,
  PickupManifestStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  PARCEL_LIST_INCLUDE,
  toParcelListView,
} from '../parcels/parcel-view';
import {
  ClosePickupManifestDto,
  CreatePickupManifestDto,
} from './dto/pickup-manifest.dto';

const MAX_MANIFEST_SIZE = 20;

const MANIFEST_INCLUDE = {
  sender: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      parcel: { include: PARCEL_LIST_INCLUDE },
    },
  },
} satisfies Prisma.PickupManifestInclude;

const OPS_CREATE: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.CHEF_AGENCE,
  Role.MAGASINIER,
  Role.PICKUP,
];

const OPS_READ: Role[] = [
  ...OPS_CREATE,
  Role.SUPPORT,
  Role.LIVREUR,
];

const KIND_STATUS: Record<PickupManifestKind, ParcelStatus> = {
  [PickupManifestKind.EN_ATTENTE]: ParcelStatus.EN_ATTENTE,
  [PickupManifestKind.PRE_ENLEVEMENT]: ParcelStatus.A_ENLEVER,
};

const KIND_PREFIX: Record<PickupManifestKind, string> = {
  [PickupManifestKind.EN_ATTENTE]: 'UMB-MAT',
  [PickupManifestKind.PRE_ENLEVEMENT]: 'UMB-MPR',
};

const KIND_LABEL: Record<PickupManifestKind, string> = {
  [PickupManifestKind.EN_ATTENTE]: 'En attente de collecte',
  [PickupManifestKind.PRE_ENLEVEMENT]: 'pré-enlèvement',
};

@Injectable()
export class PickupManifestsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateCode(kind: PickupManifestKind) {
    const n = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
    return `${KIND_PREFIX[kind]}-${n}`;
  }

  private normalizeCode(code: string): string {
    const normalized = code.trim().slice(0, 64);
    if (!normalized || !/^[A-Za-z0-9_-]+$/.test(normalized)) {
      throw new BadRequestException('Invalid manifest code');
    }
    return normalized;
  }

  private toView(
    manifest: Prisma.PickupManifestGetPayload<{
      include: typeof MANIFEST_INCLUDE;
    }>,
  ) {
    const parcels = manifest.items.map((item) =>
      toParcelListView(item.parcel),
    );
    return {
      kind: 'pickup_manifest' as const,
      id: manifest.id,
      code: manifest.code,
      manifestKind: manifest.kind,
      status: manifest.status,
      senderId: manifest.senderId,
      sender: manifest.sender,
      createdById: manifest.createdById,
      createdBy: manifest.createdBy,
      dechargeUrl: manifest.dechargeUrl,
      cinUrl: manifest.cinUrl,
      itemCount: parcels.length,
      closedAt: manifest.closedAt,
      createdAt: manifest.createdAt,
      updatedAt: manifest.updatedAt,
      parcels,
    };
  }

  private canRead(user: AuthUser, senderId: number | null, createdById: number) {
    if (user.role === Role.EXPEDITEUR) {
      return senderId === user.id || createdById === user.id;
    }
    return OPS_READ.includes(user.role);
  }

  private canCreate(user: AuthUser, kind: PickupManifestKind) {
    if (user.role === Role.EXPEDITEUR) {
      return kind === PickupManifestKind.EN_ATTENTE;
    }
    return OPS_CREATE.includes(user.role);
  }

  async create(user: AuthUser, dto: CreatePickupManifestDto) {
    if (!this.canCreate(user, dto.kind)) throw new ForbiddenException();

    const parcelIds = [...new Set(dto.parcelIds)];
    if (parcelIds.length > MAX_MANIFEST_SIZE) {
      throw new BadRequestException(
        `Maximum ${MAX_MANIFEST_SIZE} colis par manifeste`,
      );
    }

    const requiredStatus = KIND_STATUS[dto.kind];
    const where: Prisma.ParcelWhereInput = {
      id: { in: parcelIds },
      status: requiredStatus,
    };
    if (user.role === Role.EXPEDITEUR) {
      where.senderId = user.id;
    }

    const parcels = await this.prisma.parcel.findMany({
      where,
      select: { id: true, senderId: true },
    });

    if (parcels.length !== parcelIds.length) {
      throw new BadRequestException(
        `Certains colis sont introuvables, hors statut « ${KIND_LABEL[dto.kind]} », ou hors périmètre`,
      );
    }

    const alreadyLinked = await this.prisma.pickupManifestItem.findMany({
      where: {
        parcelId: { in: parcelIds },
        manifest: { status: PickupManifestStatus.OPEN },
      },
      select: { parcelId: true },
    });
    if (alreadyLinked.length) {
      throw new BadRequestException(
        'Certains colis sont déjà dans un manifeste ouvert',
      );
    }

    const senderIds = [...new Set(parcels.map((p) => p.senderId))];
    const senderId =
      user.role === Role.EXPEDITEUR
        ? user.id
        : senderIds.length === 1
          ? senderIds[0]
          : null;

    let code = this.generateCode(dto.kind);
    for (let i = 0; i < 5; i += 1) {
      const clash = await this.prisma.pickupManifest.findUnique({
        where: { code },
      });
      if (!clash) break;
      code = this.generateCode(dto.kind);
    }

    const created = await this.prisma.pickupManifest.create({
      data: {
        code,
        kind: dto.kind,
        createdById: user.id,
        senderId,
        items: {
          create: parcelIds.map((parcelId, sortOrder) => ({
            parcelId,
            sortOrder,
          })),
        },
      },
      include: MANIFEST_INCLUDE,
    });

    return this.toView(created);
  }

  async list(user: AuthUser, kind?: PickupManifestKind) {
    const where: Prisma.PickupManifestWhereInput = {};
    if (kind) where.kind = kind;

    if (user.role === Role.EXPEDITEUR) {
      where.OR = [{ senderId: user.id }, { createdById: user.id }];
    } else if (!OPS_READ.includes(user.role)) {
      where.id = -1;
    }

    const rows = await this.prisma.pickupManifest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: MANIFEST_INCLUDE,
    });
    return rows.map((row) => this.toView(row));
  }

  async findOne(user: AuthUser, id: number) {
    const manifest = await this.prisma.pickupManifest.findUnique({
      where: { id },
      include: MANIFEST_INCLUDE,
    });
    if (!manifest) throw new NotFoundException('Manifeste introuvable');
    if (!this.canRead(user, manifest.senderId, manifest.createdById)) {
      throw new ForbiddenException();
    }
    return this.toView(manifest);
  }

  async findByCode(user: AuthUser, code: string) {
    const normalized = this.normalizeCode(code);
    const manifest = await this.prisma.pickupManifest.findFirst({
      where: {
        OR: [
          { code: normalized },
          { code: { equals: normalized, mode: 'insensitive' } },
        ],
      },
      include: MANIFEST_INCLUDE,
    });
    if (!manifest) throw new NotFoundException('Manifeste introuvable');
    if (!this.canRead(user, manifest.senderId, manifest.createdById)) {
      throw new ForbiddenException();
    }
    return this.toView(manifest);
  }

  /** Used by parcel scan/lookup — returns null if code is not a manifest. */
  async resolveByCode(code: string) {
    try {
      const normalized = this.normalizeCode(code);
      return this.prisma.pickupManifest.findFirst({
        where: {
          OR: [
            { code: normalized },
            { code: { equals: normalized, mode: 'insensitive' } },
          ],
        },
        include: MANIFEST_INCLUDE,
      });
    } catch {
      return null;
    }
  }

  toPublicView(
    manifest: Prisma.PickupManifestGetPayload<{
      include: typeof MANIFEST_INCLUDE;
    }>,
  ) {
    return this.toView(manifest);
  }

  async close(user: AuthUser, id: number, dto: ClosePickupManifestDto) {
    if (!OPS_CREATE.includes(user.role)) {
      throw new ForbiddenException();
    }
    const manifest = await this.prisma.pickupManifest.findUnique({
      where: { id },
      include: MANIFEST_INCLUDE,
    });
    if (!manifest) throw new NotFoundException('Manifeste introuvable');
    if (!this.canRead(user, manifest.senderId, manifest.createdById)) {
      throw new ForbiddenException();
    }
    if (manifest.status !== PickupManifestStatus.OPEN) {
      throw new BadRequestException('Manifeste déjà clôturé');
    }
    if (user.role === Role.PICKUP) {
      if (!dto.dechargeUrl?.trim() || !dto.cinUrl?.trim()) {
        throw new BadRequestException(
          'Décharge cachetée et CIN obligatoires pour clôturer',
        );
      }
    }

    const updated = await this.prisma.pickupManifest.update({
      where: { id },
      data: {
        status: PickupManifestStatus.CLOSED,
        closedAt: new Date(),
        dechargeUrl: dto.dechargeUrl.trim(),
        cinUrl: dto.cinUrl.trim(),
      },
      include: MANIFEST_INCLUDE,
    });
    return this.toView(updated);
  }
}
