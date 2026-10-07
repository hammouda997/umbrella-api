import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateZoneDto, UpdateZoneDto } from './dto/zone.dto';

const STAFF: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: number, dto: CreateZoneDto) {
    return this.prisma.zone.create({
      data: {
        name: dto.name,
        governorate: dto.governorate,
        centerLat: dto.centerLat,
        centerLng: dto.centerLng,
        radiusKm: dto.radiusKm,
        createdById: userId,
      },
    });
  }

  async list(user: AuthUser) {
    const zones = await this.prisma.zone.findMany({
      where: STAFF.includes(user.role)
        ? {}
        : user.role === Role.LIVREUR
          ? {
              OR: [{ isActive: true }, { createdById: user.id }],
            }
          : { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { parcels: true, drivers: true } } },
    });
    return zones.map(({ _count, ...zone }) => ({
      ...zone,
      parcelCount: _count.parcels,
      livreurCount: _count.drivers,
    }));
  }

  /** Find or create a fleet zone keyed by gouvernorat (livreur autosplit). */
  async ensureZoneForGovernorate(governorate: string): Promise<number> {
    const name = governorate.trim();
    if (!name) throw new NotFoundException('Governorate required');

    const existing = await this.prisma.zone.findFirst({
      where: {
        isActive: true,
        governorate: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await this.prisma.zone.create({
      data: {
        name: `Zone ${name}`,
        governorate: name,
        isActive: true,
        radiusKm: 20,
      },
      select: { id: true },
    });
    return created.id;
  }

  async update(user: AuthUser, id: number, dto: UpdateZoneDto) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });
    if (!zone) throw new NotFoundException('Zone not found');
    if (
      user.role === Role.LIVREUR &&
      zone.createdById !== user.id
    ) {
      throw new ForbiddenException('Vous ne pouvez modifier que vos zones');
    }
    return this.prisma.zone.update({
      where: { id },
      data: {
        name: dto.name,
        governorate: dto.governorate,
        centerLat: dto.centerLat,
        centerLng: dto.centerLng,
        radiusKm: dto.radiusKm,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    await this.prisma.$transaction([
      this.prisma.parcel.updateMany({
        where: { zoneId: id },
        data: { zoneId: null },
      }),
      this.prisma.user.updateMany({
        where: { zoneId: id },
        data: { zoneId: null },
      }),
      this.prisma.zone.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }

  private async ensureExists(id: number) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!zone) throw new NotFoundException('Zone not found');
  }
}
