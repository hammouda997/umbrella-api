import { Injectable } from '@nestjs/common';
import {
  ParcelStatus,
  PaymentRequestStatus,
  Prisma,
  Role,
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

const STAFF: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];
const LIMIT = 15;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(user: AuthUser): Promise<NotificationItem[]> {
    const isStaff = STAFF.includes(user.role);
    const parcelScope = await this.parcelScope(user);

    const [events, tickets, payments] = await Promise.all([
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
      this.prisma.ticket.findMany({
        where: isStaff
          ? { status: TicketStatus.EN_COURS }
          : { createdById: user.id, status: { not: TicketStatus.EN_COURS } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
      isStaff || user.role === Role.EXPEDITEUR
        ? this.prisma.paymentRequest.findMany({
            where: isStaff
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
      ...tickets.map((t) => ({
        id: `ticket-${t.id}-${t.status}`,
        kind: 'ticket' as const,
        title: isStaff
          ? 'Ticket ouvert'
          : `Ticket ${t.status === TicketStatus.RESOLU ? 'résolu' : 'fermé'}`,
        body: t.title,
        at: t.updatedAt,
        targetId: t.id,
      })),
      ...payments.map((p) => ({
        id: `payment-${p.id}-${p.status}`,
        kind: 'payment' as const,
        title: isStaff
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

  private async parcelScope(
    user: AuthUser,
  ): Promise<Prisma.ParcelWhereInput | null> {
    const notDeleted = { status: { not: ParcelStatus.SUPPRIME } };
    if (STAFF.includes(user.role)) return notDeleted;
    if (user.role === Role.LIVREUR) return { ...notDeleted, driverId: user.id };
    if (user.role === Role.EXPEDITEUR)
      return { ...notDeleted, senderId: user.id };
    const me = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { phone: true },
    });
    return me?.phone ? { ...notDeleted, phone: me.phone } : null;
  }
}
