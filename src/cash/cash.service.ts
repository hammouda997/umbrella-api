import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CashMovementType,
  CashRegisterKind,
  LivreurDepositStatus,
  ParcelStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { isGlobalStaff } from '../common/agency-roles';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCashMovementDto,
  CreateLivreurDepositDto,
  RejectLivreurDepositDto,
} from './dto/cash.dto';

const MONEY_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.EXPERT_COMPTABLE,
  Role.CHEF_AGENCE,
  Role.FINANCE,
];

const DEPOSIT_REVIEWERS: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.EXPERT_COMPTABLE,
  Role.CHEF_AGENCE,
  Role.MAGASINIER,
];

const DELIVERED: ParcelStatus[] = [
  ParcelStatus.LIVRES,
  ParcelStatus.LIVRES_PAYES,
];

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  private assertMoney(user: AuthUser) {
    if (!MONEY_ROLES.includes(user.role)) throw new ForbiddenException();
  }

  private isNetworkWide(user: AuthUser) {
    return isGlobalStaff(user.role) || user.role === Role.EXPERT_COMPTABLE;
  }

  async ensureRegisters() {
    const cod = await this.prisma.cashRegister.findFirst({
      where: { kind: CashRegisterKind.COD, agencyId: null },
    });
    if (!cod) {
      await this.prisma.cashRegister.create({
        data: {
          kind: CashRegisterKind.COD,
          name: 'Caisse COD — globale livreurs',
          agencyId: null,
        },
      });
    }

    const agencies = await this.prisma.agency.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
    for (const agency of agencies) {
      const existing = await this.prisma.cashRegister.findFirst({
        where: { kind: CashRegisterKind.DEPENSE, agencyId: agency.id },
      });
      if (!existing) {
        await this.prisma.cashRegister.create({
          data: {
            kind: CashRegisterKind.DEPENSE,
            name: `Caisse dépense — ${agency.name}`,
            agencyId: agency.id,
          },
        });
      }
    }
  }

  async listRegisters(user: AuthUser) {
    this.assertMoney(user);
    await this.ensureRegisters();

    const where: Prisma.CashRegisterWhereInput = { isActive: true };
    if (!this.isNetworkWide(user)) {
      if (!user.agencyId) return [];
      where.OR = [
        { kind: CashRegisterKind.COD, agencyId: null },
        { kind: CashRegisterKind.DEPENSE, agencyId: user.agencyId },
      ];
    }

    const rows = await this.prisma.cashRegister.findMany({
      where,
      orderBy: [{ kind: 'asc' }, { agencyId: 'asc' }],
      include: {
        agency: { select: { id: true, name: true, governorate: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      agencyId: r.agencyId,
      agency: r.agency,
      balance: Number(r.balance),
      isActive: r.isActive,
      updatedAt: r.updatedAt,
      budgetStress: r.kind === CashRegisterKind.DEPENSE && Number(r.balance) <= 50_000,
    }));
  }

  async getRegister(user: AuthUser, id: number) {
    this.assertMoney(user);
    const register = await this.prisma.cashRegister.findUnique({
      where: { id },
      include: {
        agency: { select: { id: true, name: true, governorate: true } },
      },
    });
    if (!register) throw new NotFoundException('Caisse introuvable');
    this.assertCanAccess(user, register);

    const movements = await this.prisma.cashMovement.findMany({
      where: { registerId: id },
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: {
        actor: { select: { id: true, name: true } },
      },
    });

    return {
      id: register.id,
      kind: register.kind,
      name: register.name,
      agencyId: register.agencyId,
      agency: register.agency,
      balance: Number(register.balance),
      budgetStress:
        register.kind === CashRegisterKind.DEPENSE &&
        Number(register.balance) <= 50_000,
      movements: movements.map((m) => ({
        id: m.id,
        type: m.type,
        amount: Number(m.amount),
        label: m.label,
        note: m.note,
        receiptUrl: m.receiptUrl,
        invoiceRef: m.invoiceRef,
        depositId: m.depositId,
        actor: m.actor,
        parcelId: m.parcelId,
        livreurId: m.livreurId,
        createdAt: m.createdAt,
      })),
    };
  }

  private assertCanAccess(
    user: AuthUser,
    register: { kind: CashRegisterKind; agencyId: number | null },
  ) {
    if (this.isNetworkWide(user)) return;
    if (register.kind === CashRegisterKind.COD) return;
    if (register.agencyId && register.agencyId === user.agencyId) return;
    throw new ForbiddenException('Caisse hors de votre périmètre');
  }

  async addMovement(
    user: AuthUser,
    registerId: number,
    dto: CreateCashMovementDto,
  ) {
    this.assertMoney(user);
    const register = await this.prisma.cashRegister.findUnique({
      where: { id: registerId },
    });
    if (!register || !register.isActive) {
      throw new NotFoundException('Caisse introuvable');
    }
    this.assertCanAccess(user, register);

    if (
      register.kind === CashRegisterKind.DEPENSE &&
      dto.type === CashMovementType.IN
    ) {
      if (!this.isNetworkWide(user) && user.role !== Role.CHEF_AGENCE) {
        throw new ForbiddenException(
          'Seul le chef d’agence / expert peut alimenter la caisse dépense',
        );
      }
    }

    if (
      register.kind === CashRegisterKind.COD &&
      dto.type === CashMovementType.OUT
    ) {
      if (!this.isNetworkWide(user)) {
        throw new ForbiddenException(
          'Seul l’expert comptable peut sortir de la caisse COD globale',
        );
      }
    }

    if (dto.invoiceRef?.trim()) {
      if (
        register.kind !== CashRegisterKind.DEPENSE ||
        dto.type !== CashMovementType.OUT
      ) {
        throw new BadRequestException(
          'Les factures expert se déduisent de la caisse dépense (sortie)',
        );
      }
      if (
        user.role !== Role.EXPERT_COMPTABLE &&
        !isGlobalStaff(user.role)
      ) {
        throw new ForbiddenException(
          'Seul l’expert comptable peut enregistrer une facture',
        );
      }
      if (!dto.receiptUrl?.trim()) {
        throw new BadRequestException(
          'Scan / PDF de la facture obligatoire (upload)',
        );
      }
    }

    const amount = new Prisma.Decimal(dto.amount);
    const delta = dto.type === CashMovementType.IN ? amount : amount.mul(-1);
    const invoiceRef = dto.invoiceRef?.trim() || null;
    const label = invoiceRef
      ? `Facture ${invoiceRef} — ${dto.label.trim()}`
      : dto.label.trim();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cashRegister.update({
        where: { id: registerId },
        data: { balance: { increment: delta } },
      });
      if (Number(updated.balance) < -0.0005) {
        throw new BadRequestException('Solde insuffisant');
      }
      const movement = await tx.cashMovement.create({
        data: {
          registerId,
          type: dto.type,
          amount,
          label,
          note: dto.note?.trim() || null,
          invoiceRef,
          receiptUrl: dto.receiptUrl?.trim() || null,
          actorId: user.id,
          livreurId: dto.livreurId ?? null,
        },
      });
      return {
        id: movement.id,
        balance: Number(updated.balance),
        type: movement.type,
        amount: Number(movement.amount),
        invoiceRef: movement.invoiceRef,
      };
    });
  }

  async creditCodSettlement(opts: {
    actorId: number;
    amount: number;
    parcelIds: number[];
    livreurId?: number | null;
    depositId?: number | null;
    receiptUrl?: string | null;
  }) {
    if (opts.amount <= 0 || opts.parcelIds.length === 0) return;
    await this.ensureRegisters();
    const register = await this.prisma.cashRegister.findFirst({
      where: { kind: CashRegisterKind.COD, agencyId: null, isActive: true },
    });
    if (!register) return;

    const amount = new Prisma.Decimal(opts.amount);
    await this.prisma.$transaction(async (tx) => {
      await tx.cashRegister.update({
        where: { id: register.id },
        data: { balance: { increment: amount } },
      });
      await tx.cashMovement.create({
        data: {
          registerId: register.id,
          type: CashMovementType.IN,
          amount,
          label: `Encaissement COD · ${opts.parcelIds.length} colis`,
          note: `Parcels: ${opts.parcelIds.join(', ')}`,
          actorId: opts.actorId,
          livreurId: opts.livreurId ?? null,
          parcelId: opts.parcelIds[0] ?? null,
          depositId: opts.depositId ?? null,
          receiptUrl: opts.receiptUrl ?? null,
        },
      });
    });
  }

  async livreurOpenCod(user: AuthUser) {
    if (user.role !== Role.LIVREUR && !MONEY_ROLES.includes(user.role) && user.role !== Role.MAGASINIER) {
      throw new ForbiddenException();
    }
    const livreurId = user.role === Role.LIVREUR ? user.id : undefined;
    const parcels = await this.prisma.parcel.findMany({
      where: {
        status: { in: DELIVERED },
        codSettledAt: null,
        ...(livreurId ? { driverId: livreurId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        code: true,
        recipientName: true,
        city: true,
        price: true,
        driverId: true,
        agencyId: true,
        status: true,
      },
    });
    const items = parcels.map((p) => ({ ...p, price: Number(p.price) }));
    const expectedAmount = round3(items.reduce((s, p) => s + p.price, 0));
    return {
      items,
      expectedAmount,
      openCount: items.length,
    };
  }

  async createDeposit(user: AuthUser, dto: CreateLivreurDepositDto) {
    if (user.role !== Role.LIVREUR) throw new ForbiddenException();

    const openParcels = await this.prisma.parcel.findMany({
      where: {
        driverId: user.id,
        status: { in: DELIVERED },
        codSettledAt: null,
      },
      select: { id: true, price: true, agencyId: true },
    });
    if (openParcels.length === 0) {
      throw new BadRequestException('Aucun COD ouvert à verser');
    }

    const parcelIds = [...new Set(dto.parcelIds)].sort((a, b) => a - b);
    const openIds = openParcels.map((p) => p.id).sort((a, b) => a - b);
    if (
      parcelIds.length !== openIds.length ||
      parcelIds.some((id, i) => id !== openIds[i])
    ) {
      throw new BadRequestException(
        'Le versement doit couvrir tout le float COD (solde à zéro) — manque non',
      );
    }

    const pending = await this.prisma.livreurDeposit.findFirst({
      where: {
        livreurId: user.id,
        status: LivreurDepositStatus.PENDING,
      },
    });
    if (pending) {
      throw new BadRequestException(
        'Un versement est déjà en attente de validation magasinier',
      );
    }

    const expectedAmount = round3(
      openParcels.reduce((s, p) => s + Number(p.price), 0),
    );
    const amount = round3(dto.amount);
    if (Math.abs(amount - expectedAmount) > 0.0005) {
      throw new BadRequestException(
        `Manque non : montant attendu ${expectedAmount} TND (float à zéro requis)`,
      );
    }
    const parcels = openParcels;

    const agencyId =
      user.agencyId ?? parcels.find((p) => p.agencyId)?.agencyId ?? null;

    const created = await this.prisma.livreurDeposit.create({
      data: {
        livreurId: user.id,
        agencyId,
        amount,
        expectedAmount,
        receiptUrl: dto.receiptUrl.trim(),
        runsheetParcelIds: parcelIds,
        status: LivreurDepositStatus.PENDING,
      },
      include: {
        livreur: { select: { id: true, name: true, email: true } },
        agency: { select: { id: true, name: true } },
      },
    });

    return this.toDepositView(created);
  }

  async listDeposits(user: AuthUser, status?: LivreurDepositStatus) {
    const allowed = [
      ...DEPOSIT_REVIEWERS,
      Role.FINANCE,
      Role.LIVREUR,
    ];
    if (!allowed.includes(user.role)) throw new ForbiddenException();

    const where: Prisma.LivreurDepositWhereInput = {};
    if (status) where.status = status;

    if (user.role === Role.LIVREUR) {
      where.livreurId = user.id;
    } else if (
      !this.isNetworkWide(user) &&
      user.role !== Role.MAGASINIER &&
      user.agencyId
    ) {
      where.agencyId = user.agencyId;
    } else if (user.role === Role.MAGASINIER && user.agencyId) {
      where.OR = [{ agencyId: user.agencyId }, { agencyId: null }];
    }

    const rows = await this.prisma.livreurDeposit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        livreur: { select: { id: true, name: true, email: true } },
        agency: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    return rows.map((r) => this.toDepositView(r));
  }

  async acceptDeposit(user: AuthUser, id: number) {
    if (!DEPOSIT_REVIEWERS.includes(user.role)) throw new ForbiddenException();

    const deposit = await this.prisma.livreurDeposit.findUnique({
      where: { id },
    });
    if (!deposit) throw new NotFoundException('Versement introuvable');
    if (deposit.status !== LivreurDepositStatus.PENDING) {
      throw new BadRequestException('Versement déjà traité');
    }

    const parcels = await this.prisma.parcel.findMany({
      where: {
        id: { in: deposit.runsheetParcelIds },
        driverId: deposit.livreurId,
        status: { in: DELIVERED },
        codSettledAt: null,
      },
      select: { id: true, price: true },
    });

    if (parcels.length !== deposit.runsheetParcelIds.length) {
      throw new BadRequestException(
        'Runsheet incomplet — marchandises / argent non réglés (manque non)',
      );
    }

    const expected = round3(parcels.reduce((s, p) => s + Number(p.price), 0));
    if (
      Math.abs(expected - Number(deposit.expectedAmount)) > 0.0005 ||
      Math.abs(expected - Number(deposit.amount)) > 0.0005
    ) {
      throw new BadRequestException(
        'Solde livreur non à zéro — refus (manque non)',
      );
    }

    const remaining = await this.prisma.parcel.count({
      where: {
        driverId: deposit.livreurId,
        status: { in: DELIVERED },
        codSettledAt: null,
        id: { notIn: deposit.runsheetParcelIds },
      },
    });
    if (remaining > 0) {
      throw new BadRequestException(
        `Float COD non à zéro : ${remaining} colis encore ouverts`,
      );
    }

    const now = new Date();
    const ids = parcels.map((p) => p.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.livreurDeposit.update({
        where: { id },
        data: {
          status: LivreurDepositStatus.ACCEPTED,
          reviewedById: user.id,
          reviewedAt: now,
        },
      });
      await tx.parcel.updateMany({
        where: { id: { in: ids } },
        data: { codSettledAt: now, codSettledById: user.id },
      });
      await tx.parcelEvent.createMany({
        data: ids.map((parcelId) => ({
          parcelId,
          label: 'Versement COD validé (solde zéro)',
          actorId: user.id,
          createdAt: now,
        })),
      });
    });

    await this.creditCodSettlement({
      actorId: user.id,
      amount: Number(deposit.amount),
      parcelIds: ids,
      livreurId: deposit.livreurId,
      depositId: deposit.id,
      receiptUrl: deposit.receiptUrl,
    });

    return this.getDeposit(user, id);
  }

  async rejectDeposit(
    user: AuthUser,
    id: number,
    dto: RejectLivreurDepositDto,
  ) {
    if (!DEPOSIT_REVIEWERS.includes(user.role)) throw new ForbiddenException();
    const deposit = await this.prisma.livreurDeposit.findUnique({
      where: { id },
    });
    if (!deposit) throw new NotFoundException('Versement introuvable');
    if (deposit.status !== LivreurDepositStatus.PENDING) {
      throw new BadRequestException('Versement déjà traité');
    }

    await this.prisma.livreurDeposit.update({
      where: { id },
      data: {
        status: LivreurDepositStatus.REJECTED,
        reviewedById: user.id,
        reviewedAt: new Date(),
        rejectReason: dto.reason?.trim() || 'Rejeté',
      },
    });
    return this.getDeposit(user, id);
  }

  async getDeposit(user: AuthUser, id: number) {
    const deposit = await this.prisma.livreurDeposit.findUnique({
      where: { id },
      include: {
        livreur: { select: { id: true, name: true, email: true } },
        agency: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    if (!deposit) throw new NotFoundException('Versement introuvable');
    if (
      user.role === Role.LIVREUR &&
      deposit.livreurId !== user.id
    ) {
      throw new ForbiddenException();
    }
    return this.toDepositView(deposit);
  }

  private toDepositView(d: {
    id: number;
    livreurId: number;
    agencyId: number | null;
    amount: Prisma.Decimal | number;
    expectedAmount: Prisma.Decimal | number;
    receiptUrl: string;
    status: LivreurDepositStatus;
    runsheetParcelIds: number[];
    rejectReason: string | null;
    reviewedById: number | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    livreur?: { id: number; name: string; email: string } | null;
    agency?: { id: number; name: string } | null;
    reviewedBy?: { id: number; name: string } | null;
  }) {
    return {
      id: d.id,
      livreurId: d.livreurId,
      livreur: d.livreur ?? null,
      agencyId: d.agencyId,
      agency: d.agency ?? null,
      amount: Number(d.amount),
      expectedAmount: Number(d.expectedAmount),
      receiptUrl: d.receiptUrl,
      status: d.status,
      runsheetParcelIds: d.runsheetParcelIds,
      parcelCount: d.runsheetParcelIds.length,
      rejectReason: d.rejectReason,
      reviewedBy: d.reviewedBy ?? null,
      reviewedAt: d.reviewedAt,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      balanceCleared:
        Math.abs(Number(d.amount) - Number(d.expectedAmount)) < 0.0005,
    };
  }
}
