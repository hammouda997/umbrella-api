import { Injectable } from '@nestjs/common';
import {
  ParcelStatus,
  PaymentRequestStatus,
  Prisma,
  Role,
  TicketKind,
  TicketStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

export type NotificationKind = 'parcel' | 'ticket' | 'payment';

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: Date;
  targetId: number | null;
};

const GLOBAL_STAFF: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];
const AGENCY_ROLES: Role[] = [
  Role.CHEF_AGENCE,
  Role.MAGASINIER,
  Role.PICKUP,
  Role.SUPPORT,
];
const LIMIT = 15;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(user: AuthUser): Promise<NotificationItem[]> {
    const isGlobalStaff = GLOBAL_STAFF.includes(user.role);
    const parcelScope = await this.parcelScope(user);

    const [events, tickets, relances, payments] = await Promise.all([
      parcelScope
        ? this.prisma.parcelEvent.findMany({
            where: { parcel: parcelScope, NOT: { actorId: user.id } },
            orderBy: { createdAt: 'desc' },
            take: LIMIT,
            select: {
              id: true,
              label: true,
              comment: true,
              createdAt: true,
              parcel: { select: { id: true, code: true } },
            },
          })
        : Promise.resolve([]),
      this.listTicketUpdates(user, isGlobalStaff),
      this.listRelanceAlerts(user),
      isGlobalStaff || user.role === Role.EXPEDITEUR
        ? this.prisma.paymentRequest.findMany({
            where: isGlobalStaff
              ? { status: PaymentRequestStatus.EN_DEMANDE }
              : {
                  senderId: user.id,
                  status: { not: PaymentRequestStatus.EN_DEMANDE },
                },
            orderBy: { updatedAt: 'desc' },
            take: 5,
            select: { id: true, amount: true, status: true, updatedAt: true },
          })
        : Promise.resolve([]),
    ]);

    const items: NotificationItem[] = [
      ...events.map((e) => ({
        id: `event-${e.id}`,
        kind: 'parcel' as const,
        title: e.parcel.code ?? `Colis #${e.parcel.id}`,
        body: e.comment ? `${e.label} — ${e.comment}` : e.label,
        at: e.createdAt,
        targetId: e.parcel.id,
      })),
      ...tickets,
      ...relances,
      ...payments.map((p) => ({
        id: `payment-${p.id}-${p.status}`,
        kind: 'payment' as const,
        title: isGlobalStaff
          ? 'Demande de paiement'
          : `Paiement ${p.status.toLowerCase()}`,
        body: `#${p.id} · ${Number(p.amount).toFixed(3)} TND`,
        at: p.updatedAt,
        targetId: p.id,
      })),
    ];

    return items
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, LIMIT);
  }

  private async listTicketUpdates(
    user: AuthUser,
    isGlobalStaff: boolean,
  ): Promise<NotificationItem[]> {
    if (user.role === Role.SUPPORT || isGlobalStaff) {
      const rows = await this.prisma.ticket.findMany({
        where: { status: TicketStatus.EN_COURS },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, status: true, updatedAt: true },
      });
      return rows.map((t) => ({
        id: `ticket-${t.id}-${t.status}`,
        kind: 'ticket' as const,
        title: 'Ticket ouvert',
        body: t.title,
        at: t.updatedAt,
        targetId: t.id,
      }));
    }

    if (user.role === Role.EXPEDITEUR || user.role === Role.CLIENT) {
      const rows = await this.prisma.ticket.findMany({
        where: {
          createdById: user.id,
          status: { not: TicketStatus.EN_COURS },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, status: true, updatedAt: true },
      });
      return rows.map((t) => ({
        id: `ticket-${t.id}-${t.status}`,
        kind: 'ticket' as const,
        title: `Ticket ${t.status === TicketStatus.RESOLU ? 'résolu' : 'fermé'}`,
        body: t.title,
        at: t.updatedAt,
        targetId: t.id,
      }));
    }

    return [];
  }

  /** Relance tickets → notify assigned livreur + agency magasinier. */
  private async listRelanceAlerts(
    user: AuthUser,
  ): Promise<NotificationItem[]> {
    if (user.role !== Role.LIVREUR && user.role !== Role.MAGASINIER) {
      return [];
    }

    const parcelWhere: Prisma.ParcelWhereInput | null =
      user.role === Role.LIVREUR
        ? { driverId: user.id, status: { not: ParcelStatus.SUPPRIME } }
        : await this.agencyParcelWhere(user);

    if (!parcelWhere) return [];

    const rows = await this.prisma.ticket.findMany({
      where: {
        kind: TicketKind.RELANCE,
        status: TicketStatus.EN_COURS,
        parcel: parcelWhere,
        NOT: { createdById: user.id },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        parcel: { select: { id: true, code: true } },
      },
    });

    return rows.map((t) => ({
      id: `relance-${t.id}`,
      kind: 'ticket' as const,
      title: 'Relance colis',
      body: t.parcel?.code
        ? `${t.parcel.code} · ${t.description?.trim() || t.title}`
        : t.title,
      at: t.createdAt,
      targetId: t.parcel?.id ?? t.id,
    }));
  }

  private async agencyParcelWhere(
    user: AuthUser,
  ): Promise<Prisma.ParcelWhereInput | null> {
    const agencyId =
      user.agencyId ??
      (
        await this.prisma.user.findUnique({
          where: { id: user.id },
          select: { agencyId: true },
        })
      )?.agencyId;
    if (!agencyId) return null;
    return { agencyId, status: { not: ParcelStatus.SUPPRIME } };
  }

  private async parcelScope(
    user: AuthUser,
  ): Promise<Prisma.ParcelWhereInput | null> {
    const notDeleted = { status: { not: ParcelStatus.SUPPRIME } };
    if (GLOBAL_STAFF.includes(user.role) || user.role === Role.FINANCE) {
      return notDeleted;
    }
    if (AGENCY_ROLES.includes(user.role)) {
      return this.agencyParcelWhere(user);
    }
    if (user.role === Role.LIVREUR) {
      return { ...notDeleted, driverId: user.id };
    }
    if (user.role === Role.EXPEDITEUR) {
      return { ...notDeleted, senderId: user.id };
    }
    if (user.role === Role.CLIENT) {
      const me = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { phone: true },
      });
      return me?.phone ? { ...notDeleted, phone: me.phone } : null;
    }
    return null;
  }
}
