import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateTicketDto, UpdateTicketStatusDto } from './dto/ticket.dto';

const STAFF: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

const TICKET_INCLUDE = {
  parcel: { select: { id: true, code: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, dto: CreateTicketDto) {
    if (dto.parcelId) {
      const parcel = await this.prisma.parcel.findUnique({
        where: { id: dto.parcelId },
        select: { id: true },
      });
      if (!parcel) throw new BadRequestException('Colis introuvable');
    }
    return this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        parcelId: dto.parcelId,
        createdById: user.id,
      },
      include: TICKET_INCLUDE,
    });
  }

  list(user: AuthUser) {
    return this.prisma.ticket.findMany({
      where: STAFF.includes(user.role) ? {} : { createdById: user.id },
      orderBy: { createdAt: 'desc' },
      include: TICKET_INCLUDE,
    });
  }

  async updateStatus(user: AuthUser, id: number, dto: UpdateTicketStatusDto) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!STAFF.includes(user.role) && ticket.createdById !== user.id) {
      throw new ForbiddenException();
    }
    if (!STAFF.includes(user.role) && dto.status !== TicketStatus.FERME) {
      throw new ForbiddenException('Only staff can resolve tickets');
    }
    return this.prisma.ticket.update({
      where: { id },
      data: { status: dto.status },
      include: TICKET_INCLUDE,
    });
  }
}
