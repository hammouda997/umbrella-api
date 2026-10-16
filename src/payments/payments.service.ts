import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CashMovementType,
  CashRegisterKind,
  ParcelStatus,
  PaymentRequestStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { isGlobalStaff } from '../common/agency-roles';
import {
  CreatePaymentRequestDto,
  UpdatePaymentStatusDto,
} from './dto/payment.dto';

/** Petits paiements < 5k TND — skip expert. */
export const SMALL_PAYMENT_MAX = 5000;
/** Budget stress: solde dépense ≤ 50k → mode expert 24h. */
export const BUDGET_STRESS_MAX = 50_000;
const BATCH_HOURS = 24;

const STAFF: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.EXPERT_COMPTABLE,
  Role.CHEF_AGENCE,
  Role.FINANCE,
];
const PAYABLE: ParcelStatus[] = [
  ParcelStatus.LIVRES,
  ParcelStatus.LIVRES_PAYES,
];
const ACTIVE_REQUEST: PaymentRequestStatus[] = [
  PaymentRequestStatus.EN_DEMANDE,
  PaymentRequestStatus.VALIDE_FINANCE,
  PaymentRequestStatus.VALIDE_CHEF,
  PaymentRequestStatus.VALIDE_EXPERT,
  PaymentRequestStatus.APPROUVE,
  PaymentRequestStatus.PAYE,
];

const PAYMENT_INCLUDE = {
  items: { include: { parcel: { select: { id: true, code: true, agencyId: true } } } },
  sender: { select: { id: true, name: true, email: true, agencyId: true } },
} satisfies Prisma.PaymentRequestInclude;

type PaymentWithItems = Prisma.PaymentRequestGetPayload<{
  include: typeof PAYMENT_INCLUDE;
}>;

type PaymentHistoryEntry = {
  at: string;
  status: PaymentRequestStatus;
  label: string;
  actorName?: string | null;
};

const HISTORY_LABEL: Partial<Record<PaymentRequestStatus, string>> = {
  EN_DEMANDE: 'Demande créée',
  VALIDE_FINANCE: 'Validé finance',
  VALIDE_CHEF: 'Validé chef d’agence',
  VALIDE_EXPERT: 'Validé expert',
  APPROUVE: 'Validé finance',
  PAYE: 'Versé',
  REJETE: 'Rejeté',
};

function parseHistory(raw: unknown): PaymentHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is PaymentHistoryEntry =>
      Boolean(e) &&
      typeof e === 'object' &&
      typeof (e as PaymentHistoryEntry).at === 'string' &&
      typeof (e as PaymentHistoryEntry).status === 'string',
  );
}

function historyForPayment(
  payment: PaymentWithItems,
): PaymentHistoryEntry[] {
  const stored = parseHistory(payment.statusHistory);
  if (stored.length) return stored;
  const status = normalizeStatus(payment.status);
  const entries: PaymentHistoryEntry[] = [
    {
      at: payment.createdAt.toISOString(),
      status: PaymentRequestStatus.EN_DEMANDE,
      label: HISTORY_LABEL.EN_DEMANDE ?? 'Demande créée',
      actorName: payment.sender?.name ?? null,
    },
  ];
  if (status !== PaymentRequestStatus.EN_DEMANDE) {
    entries.push({
      at: payment.updatedAt.toISOString(),
      status,
      label: HISTORY_LABEL[status] ?? status,
      actorName: null,
    });
  }
  return entries;
}

function appendHistory(
  payment: PaymentWithItems,
  status: PaymentRequestStatus,
  actorName: string,
): PaymentHistoryEntry[] {
  const prior = historyForPayment(payment).filter(
    (e) =>
      !(
        e.status === status &&
        e.at === payment.updatedAt.toISOString()
      ),
  );
  return [
    ...prior,
    {
      at: new Date().toISOString(),
      status,
      label: HISTORY_LABEL[status] ?? status,
      actorName,
    },
  ];
}

function toPaymentView(
  payment: PaymentWithItems,
  extras?: { requiresExpert?: boolean; budgetStress?: boolean },
) {
  const amount = Number(payment.amount);
  return {
    ...payment,
    amount,
    items: payment.items.map((i) => ({ ...i, amount: Number(i.amount) })),
    history: historyForPayment(payment),
    isSmall: amount < SMALL_PAYMENT_MAX,
    requiresExpert: extras?.requiresExpert ?? amount >= SMALL_PAYMENT_MAX,
    budgetStress: extras?.budgetStress ?? false,
  };
}

function normalizeStatus(status: PaymentRequestStatus): PaymentRequestStatus {
  if (status === PaymentRequestStatus.APPROUVE) {
    return PaymentRequestStatus.VALIDE_FINANCE;
  }
  return status;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, dto: CreatePaymentRequestDto) {
    if (![...STAFF, Role.EXPEDITEUR].includes(user.role)) {
      throw new ForbiddenException();
    }
    const parcelIds = [...new Set(dto.parcelIds)];

    const parcels = await this.prisma.parcel.findMany({
      where: {
        id: { in: parcelIds },
        status: { in: PAYABLE },
        paymentItems: {
          none: { paymentRequest: { status: { in: ACTIVE_REQUEST } } },
        },
        ...(user.role === Role.EXPEDITEUR ? { senderId: user.id } : {}),
      },
    });

    if (parcels.length !== parcelIds.length) {
      throw new BadRequestException(
        'Certains colis sont introuvables, non livrés ou déjà dans une demande',
      );
    }
    const senders = new Set(parcels.map((p) => p.senderId));
    if (senders.size > 1) {
      throw new BadRequestException(
        'Une demande ne peut concerner qu’un seul expéditeur',
      );
    }

    const amount = parcels.reduce((sum, p) => sum + Number(p.price), 0);
    const at = new Date().toISOString();
    const created = await this.prisma.paymentRequest.create({
      data: {
        amount,
        note: dto.note,
        senderId: parcels[0].senderId,
        statusHistory: [
          {
            at,
            status: PaymentRequestStatus.EN_DEMANDE,
            label: HISTORY_LABEL.EN_DEMANDE ?? 'Demande créée',
            actorName: user.email,
          },
        ],
        items: {
          create: parcels.map((p) => ({ parcelId: p.id, amount: p.price })),
        },
      },
      include: PAYMENT_INCLUDE,
    });
    return toPaymentView(created);
  }

  async list(user: AuthUser) {
    const rows = await this.prisma.paymentRequest.findMany({
      where: STAFF.includes(user.role) ? {} : { senderId: user.id },
      orderBy: { createdAt: 'desc' },
      include: PAYMENT_INCLUDE,
    });
    const stressMap = await this.agencyStressMap(rows);
    return rows.map((r) => {
      const agencyId = this.paymentAgencyId(r);
      const budgetStress = agencyId ? (stressMap.get(agencyId) ?? false) : false;
      const amount = Number(r.amount);
      return toPaymentView(r, {
        budgetStress,
        requiresExpert: amount >= SMALL_PAYMENT_MAX || budgetStress,
      });
    });
  }

  private paymentAgencyId(payment: PaymentWithItems): number | null {
    return (
      payment.sender.agencyId ??
      payment.items.find((i) => i.parcel.agencyId)?.parcel.agencyId ??
      null
    );
  }

  private async agencyStressMap(rows: PaymentWithItems[]) {
    const agencyIds = [
      ...new Set(
        rows
          .map((r) => this.paymentAgencyId(r))
          .filter((id): id is number => id != null),
      ),
    ];
    const map = new Map<number, boolean>();
    if (agencyIds.length === 0) return map;

    const registers = await this.prisma.cashRegister.findMany({
      where: {
        kind: CashRegisterKind.DEPENSE,
        agencyId: { in: agencyIds },
        isActive: true,
      },
      select: { agencyId: true, balance: true },
    });
    for (const r of registers) {
      if (r.agencyId != null) {
        map.set(r.agencyId, Number(r.balance) <= BUDGET_STRESS_MAX);
      }
    }
    return map;
  }

  private async isBudgetStress(agencyId: number | null): Promise<boolean> {
    if (!agencyId) return false;
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        kind: CashRegisterKind.DEPENSE,
        agencyId,
        isActive: true,
      },
    });
    return register ? Number(register.balance) <= BUDGET_STRESS_MAX : false;
  }

  private async ensureExpertBatchDeadline(agencyId: number | null) {
    if (!agencyId) return null;
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });
    if (!agency) return null;
    if (agency.expertBatchDeadlineAt) return agency.expertBatchDeadlineAt;
    const deadline = new Date(Date.now() + BATCH_HOURS * 60 * 60 * 1000);
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: { expertBatchDeadlineAt: deadline },
    });
    return deadline;
  }

  async updateStatus(user: AuthUser, id: number, dto: UpdatePaymentStatusDto) {
    if (!STAFF.includes(user.role)) throw new ForbiddenException();
    const existing = await this.prisma.paymentRequest.findUnique({
      where: { id },
      include: PAYMENT_INCLUDE,
    });
    if (!existing) throw new NotFoundException('Payment request not found');

    const current = normalizeStatus(existing.status);
    const target = normalizeStatus(dto.status);
    const amount = Number(existing.amount);
    const agencyId = this.paymentAgencyId(existing);
    const budgetStress = await this.isBudgetStress(agencyId);
    const requiresExpert = amount >= SMALL_PAYMENT_MAX || budgetStress;

    if (target === PaymentRequestStatus.REJETE) {
      if (
        current === PaymentRequestStatus.PAYE ||
        current === PaymentRequestStatus.REJETE
      ) {
        throw new BadRequestException('Demande déjà clôturée');
      }
      return this.applyStatus(user, id, PaymentRequestStatus.REJETE, dto.amount);
    }

    this.assertTransition(user, current, target, requiresExpert);

    if (budgetStress && target !== PaymentRequestStatus.PAYE) {
      await this.ensureExpertBatchDeadline(agencyId);
    }

    if (target === PaymentRequestStatus.PAYE) {
      return this.payRequest(user, existing, dto.amount, agencyId);
    }

    return this.applyStatus(user, id, target, dto.amount);
  }

  private assertTransition(
    user: AuthUser,
    current: PaymentRequestStatus,
    target: PaymentRequestStatus,
    requiresExpert: boolean,
  ) {
    const role = user.role;
    const global = isGlobalStaff(role) || role === Role.EXPERT_COMPTABLE;

    const allowed: Partial<
      Record<PaymentRequestStatus, PaymentRequestStatus[]>
    > = {
      EN_DEMANDE: [PaymentRequestStatus.VALIDE_FINANCE],
      VALIDE_FINANCE: [PaymentRequestStatus.VALIDE_CHEF],
      VALIDE_CHEF: requiresExpert
        ? [PaymentRequestStatus.VALIDE_EXPERT]
        : [PaymentRequestStatus.PAYE],
      VALIDE_EXPERT: [PaymentRequestStatus.PAYE],
    };

    const next = allowed[current] ?? [];
    if (!next.includes(target)) {
      throw new BadRequestException(
        `Transition ${current} → ${target} impossible`,
      );
    }

    if (target === PaymentRequestStatus.VALIDE_FINANCE) {
      if (role !== Role.FINANCE && !global) {
        throw new ForbiddenException('Validation finance requise');
      }
    }
    if (target === PaymentRequestStatus.VALIDE_CHEF) {
      if (role !== Role.CHEF_AGENCE && !global) {
        throw new ForbiddenException('Validation chef d’agence requise');
      }
    }
    if (target === PaymentRequestStatus.VALIDE_EXPERT) {
      if (role !== Role.EXPERT_COMPTABLE && !isGlobalStaff(role)) {
        throw new ForbiddenException('Validation expert comptable requise');
      }
    }
    if (target === PaymentRequestStatus.PAYE) {
      if (requiresExpert) {
        if (
          current !== PaymentRequestStatus.VALIDE_EXPERT &&
          role !== Role.EXPERT_COMPTABLE &&
          !isGlobalStaff(role)
        ) {
          throw new ForbiddenException('Seul l’expert peut verser ce paiement');
        }
      } else if (
        role !== Role.CHEF_AGENCE &&
        role !== Role.FINANCE &&
        role !== Role.EXPERT_COMPTABLE &&
        !isGlobalStaff(role)
      ) {
        throw new ForbiddenException('Versement non autorisé');
      }
    }
  }

  private async applyStatus(
    user: AuthUser,
    id: number,
    status: PaymentRequestStatus,
    amount?: number,
  ) {
    const existing = await this.prisma.paymentRequest.findUnique({
      where: { id },
      include: PAYMENT_INCLUDE,
    });
    if (!existing) throw new NotFoundException('Payment request not found');
    const statusHistory = appendHistory(existing, status, user.email);
    const payment = await this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status,
        statusHistory,
        ...(amount !== undefined ? { amount } : {}),
      },
      include: PAYMENT_INCLUDE,
    });
    return toPaymentView(payment);
  }

  private async payRequest(
    user: AuthUser,
    existing: PaymentWithItems,
    amountOverride: number | undefined,
    agencyId: number | null,
  ) {
    const parcelIds = existing.items.map((i) => i.parcel.id);
    const payAmount = amountOverride ?? Number(existing.amount);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (agencyId) {
        const register = await tx.cashRegister.findFirst({
          where: {
            kind: CashRegisterKind.DEPENSE,
            agencyId,
            isActive: true,
          },
        });
        if (register) {
          const next = Number(register.balance) - payAmount;
          if (next < -0.0005) {
            throw new BadRequestException(
              'Solde caisse dépense insuffisant pour ce versement',
            );
          }
          await tx.cashRegister.update({
            where: { id: register.id },
            data: { balance: { decrement: payAmount } },
          });
          await tx.cashMovement.create({
            data: {
              registerId: register.id,
              type: CashMovementType.OUT,
              amount: payAmount,
              label: `Paiement expéditeur #${existing.id}`,
              note: existing.sender.name,
              actorId: user.id,
            },
          });
        }
      }

      const payment = await tx.paymentRequest.update({
        where: { id: existing.id },
        data: {
          status: PaymentRequestStatus.PAYE,
          statusHistory: appendHistory(
            existing,
            PaymentRequestStatus.PAYE,
            user.email,
          ),
          ...(amountOverride !== undefined ? { amount: amountOverride } : {}),
        },
        include: PAYMENT_INCLUDE,
      });
      if (parcelIds.length) {
        await tx.parcel.updateMany({
          where: { id: { in: parcelIds } },
          data: { status: ParcelStatus.LIVRES_PAYES },
        });
        await tx.parcelEvent.createMany({
          data: parcelIds.map((parcelId) => ({
            parcelId,
            label: 'Livré payé',
            status: ParcelStatus.LIVRES_PAYES,
            comment: `Paiement #${existing.id} versé`,
            actorId: user.id,
          })),
        });
      }
      return payment;
    });
    return toPaymentView(updated);
  }

  /** Expert batch: pay max small-first within 24h under budget stress. */
  async expertBatchPay(user: AuthUser, agencyId?: number) {
    if (
      user.role !== Role.EXPERT_COMPTABLE &&
      !isGlobalStaff(user.role)
    ) {
      throw new ForbiddenException();
    }

    const agencies = await this.prisma.agency.findMany({
      where: agencyId ? { id: agencyId } : { isActive: true },
      select: { id: true, expertBatchDeadlineAt: true },
    });

    const paid: number[] = [];
    for (const agency of agencies) {
      const register = await this.prisma.cashRegister.findFirst({
        where: {
          kind: CashRegisterKind.DEPENSE,
          agencyId: agency.id,
          isActive: true,
        },
      });
      if (!register || Number(register.balance) > BUDGET_STRESS_MAX) continue;

      const deadline =
        agency.expertBatchDeadlineAt ??
        (await this.ensureExpertBatchDeadline(agency.id));
      if (deadline && deadline.getTime() < Date.now()) {
        continue;
      }

      let balance = Number(register.balance);
      const pending = await this.prisma.paymentRequest.findMany({
        where: {
          status: {
            in: [
              PaymentRequestStatus.VALIDE_CHEF,
              PaymentRequestStatus.VALIDE_EXPERT,
              PaymentRequestStatus.VALIDE_FINANCE,
            ],
          },
          OR: [
            { sender: { agencyId: agency.id } },
            { items: { some: { parcel: { agencyId: agency.id } } } },
          ],
        },
        orderBy: { amount: 'asc' },
        include: PAYMENT_INCLUDE,
      });

      for (const row of pending) {
        const amount = Number(row.amount);
        if (amount > balance) continue;
        const status = normalizeStatus(row.status);
        if (
          status === PaymentRequestStatus.VALIDE_FINANCE ||
          status === PaymentRequestStatus.VALIDE_CHEF
        ) {
          await this.prisma.paymentRequest.update({
            where: { id: row.id },
            data: { status: PaymentRequestStatus.VALIDE_EXPERT },
          });
          row.status = PaymentRequestStatus.VALIDE_EXPERT;
        }
        await this.payRequest(user, { ...row, status: PaymentRequestStatus.VALIDE_EXPERT }, undefined, agency.id);
        balance -= amount;
        paid.push(row.id);
      }
    }

    return { paidCount: paid.length, paymentIds: paid };
  }

  async budgetStatus(user: AuthUser) {
    if (!STAFF.includes(user.role)) throw new ForbiddenException();
    await this.prisma.cashRegister.findMany({
      where: { kind: CashRegisterKind.DEPENSE, isActive: true },
    });
    const agencies = await this.prisma.agency.findMany({
      where:
        isGlobalStaff(user.role) || user.role === Role.EXPERT_COMPTABLE
          ? { isActive: true }
          : user.agencyId
            ? { id: user.agencyId }
            : { id: -1 },
      include: {
        cashRegisters: {
          where: { kind: CashRegisterKind.DEPENSE, isActive: true },
          take: 1,
        },
      },
    });
    return agencies.map((a) => {
      const balance = Number(a.cashRegisters[0]?.balance ?? 0);
      return {
        agencyId: a.id,
        name: a.name,
        balance,
        budgetStress: balance <= BUDGET_STRESS_MAX,
        expertBatchDeadlineAt: a.expertBatchDeadlineAt,
        smallPaymentMax: SMALL_PAYMENT_MAX,
        budgetStressMax: BUDGET_STRESS_MAX,
      };
    });
  }
}
