import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { CreateTicketDto, UpdateTicketStatusDto } from './dto/ticket.dto';

const STAFF_RESOLVE: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.SUPPORT,
];

const STAFF_LIST_ALL: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.SUPPORT,
];

const PARCEL_TICKET_CREATORS: Role[] = [
  Role.EXPEDITEUR,
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.SUPPORT,
];

/** Still with sender — tickets colis métier not allowed yet. */
const PRE_SORTIE: ParcelStatus[] = [
  ParcelStatus.EN_ATTENTE,
  ParcelStatus.NON_SERIEUX,
];

/** Settled / wired — window closed. */
const POST_VIRE: ParcelStatus[] = [
  ParcelStatus.LIVRES_PAYES,
  ParcelStatus.REMBOURSES,
  ParcelStatus.SUPPRIME,
];

const KIND_TITLE: Record<TicketKind, string> = {
  [TicketKind.GENERAL]: 'Demande support',
  [TicketKind.CHANGEMENT_PRIX]: 'Changement de prix',
  [TicketKind.RELANCE]: 'Relance colis',
};

const TICKET_INCLUDE = {
  parcel: {
    select: {
      id: true,
      code: true,
      price: true,
      status: true,
      senderId: true,
    },
  },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(
    ticket: Prisma.TicketGetPayload<{ include: typeof TICKET_INCLUDE }>,
  ) {
    return {
      ...ticket,
      requestedPrice:
        ticket.requestedPrice != null
          ? Number(ticket.requestedPrice)
          : null,
      parcel: ticket.parcel
        ? {
            id: ticket.parcel.id,
            code: ticket.parcel.code,
            price: Number(ticket.parcel.price),
            status: ticket.parcel.status,
          }
        : null,
    };
  }

  private async assertParcelTicketWindow(
    parcelId: number,
    user: AuthUser,
  ) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: parcelId },
      select: {
        id: true,
        code: true,
        status: true,
        senderId: true,
        price: true,
        codSettledAt: true,
      },
    });
    if (!parcel) throw new BadRequestException('Colis introuvable');

    if (
      user.role === Role.EXPEDITEUR &&
      parcel.senderId !== user.id
    ) {
      throw new ForbiddenException('Ce colis ne vous appartient pas');
    }

    if (PRE_SORTIE.includes(parcel.status)) {
      throw new BadRequestException(
        'Ticket colis disponible seulement après sortie chez l’expéditeur',
      );
    }
    if (POST_VIRE.includes(parcel.status) || parcel.codSettledAt) {
      throw new BadRequestException(
        'Ticket colis fermé — colis déjà viré / soldé',
      );
    }

    const paid = await this.prisma.paymentItem.findFirst({
      where: {
        parcelId,
        paymentRequest: { status: PaymentRequestStatus.PAYE },
      },
      select: { id: true },
    });
    if (paid) {
      throw new BadRequestException(
        'Ticket colis fermé — colis déjà inclus dans un virement',
      );
    }

    return parcel;
  }

  async create(user: AuthUser, dto: CreateTicketDto) {
    const kind = dto.kind ?? TicketKind.GENERAL;

    if (kind === TicketKind.GENERAL) {
      if (dto.parcelId) {
        const parcel = await this.prisma.parcel.findUnique({
          where: { id: dto.parcelId },
          select: { id: true, senderId: true },
        });
        if (!parcel) throw new BadRequestException('Colis introuvable');
        if (
          user.role === Role.EXPEDITEUR &&
          parcel.senderId !== user.id
        ) {
          throw new ForbiddenException();
        }
      }
      const title = dto.title?.trim();
      if (!title || title.length < 3) {
        throw new BadRequestException('Sujet trop court');
      }
      const created = await this.prisma.ticket.create({
        data: {
          kind: TicketKind.GENERAL,
          title,
          description: dto.description?.trim() || null,
          parcelId: dto.parcelId,
          createdById: user.id,
        },
        include: TICKET_INCLUDE,
      });
      return this.toView(created);
    }

    if (!PARCEL_TICKET_CREATORS.includes(user.role)) {
      throw new ForbiddenException();
    }
    if (!dto.parcelId) {
      throw new BadRequestException('Un colis est requis pour ce type de ticket');
    }

    const parcel = await this.assertParcelTicketWindow(dto.parcelId, user);

    if (kind === TicketKind.CHANGEMENT_PRIX) {
      if (dto.requestedPrice == null || !(dto.requestedPrice > 0)) {
        throw new BadRequestException('Nouveau prix requis');
      }
      if (Number(parcel.price) === dto.requestedPrice) {
        throw new BadRequestException('Le nouveau prix est identique à l’actuel');
      }
    }

    const openSame = await this.prisma.ticket.findFirst({
      where: {
        parcelId: parcel.id,
        kind,
        status: TicketStatus.EN_COURS,
      },
      select: { id: true },
    });
    if (openSame) {
      throw new BadRequestException(
        `Un ticket « ${KIND_TITLE[kind]} » est déjà ouvert sur ce colis (#${openSame.id})`,
      );
    }

    const title =
      dto.title?.trim() ||
      `${KIND_TITLE[kind]}${parcel.code ? ` · ${parcel.code}` : ''}`;

    const created = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          kind,
          title,
          description: dto.description?.trim() || null,
          parcelId: parcel.id,
          createdById: user.id,
          requestedPrice:
            kind === TicketKind.CHANGEMENT_PRIX
              ? dto.requestedPrice
              : null,
        },
        include: TICKET_INCLUDE,
      });

      if (kind === TicketKind.RELANCE) {
        await tx.parcelEvent.create({
          data: {
            parcelId: parcel.id,
            label: 'Relance colis',
            comment:
              dto.description?.trim() ||
              `Ticket #${ticket.id} — livreur et magasinier notifiés`,
            actorId: user.id,
          },
        });
      }

      return ticket;
    });
    return this.toView(created);
  }

  async list(user: AuthUser) {
    const rows = await this.prisma.ticket.findMany({
      where: STAFF_LIST_ALL.includes(user.role)
        ? {}
        : { createdById: user.id },
      orderBy: { createdAt: 'desc' },
      include: TICKET_INCLUDE,
    });
    return rows.map((row) => this.toView(row));
  }

  async updateStatus(
    user: AuthUser,
    id: number,
    dto: UpdateTicketStatusDto,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { parcel: { select: { id: true, price: true, code: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isStaff = STAFF_RESOLVE.includes(user.role);
    if (!isStaff && ticket.createdById !== user.id) {
      throw new ForbiddenException();
    }
    if (!isStaff && dto.status !== TicketStatus.FERME) {
      throw new ForbiddenException('Only staff can resolve tickets');
    }

    if (
      dto.status === TicketStatus.RESOLU &&
      ticket.kind === TicketKind.CHANGEMENT_PRIX &&
      ticket.requestedPrice != null &&
      ticket.parcelId &&
      isStaff
    ) {
      const newPrice = ticket.requestedPrice;
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.parcel.update({
          where: { id: ticket.parcelId! },
          data: { price: newPrice },
        });
        await tx.parcelEvent.create({
          data: {
            parcelId: ticket.parcelId!,
            label: 'Prix modifié (ticket)',
            comment: `Ticket #${ticket.id} · ${Number(ticket.parcel?.price ?? 0)} → ${Number(newPrice)} TND`,
            actorId: user.id,
          },
        });
        return tx.ticket.update({
          where: { id },
          data: { status: TicketStatus.RESOLU },
          include: TICKET_INCLUDE,
        });
      });
      return this.toView(updated);
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status: dto.status },
      include: TICKET_INCLUDE,
    });
    return this.toView(updated);
  }
}
