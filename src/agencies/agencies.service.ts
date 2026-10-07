import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgencyDto, UpdateAgencyDto } from './dto/agency.dto';

@Injectable()
export class AgenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.agency.findMany({
      orderBy: { governorate: 'asc' },
      include: { _count: { select: { users: true, parcels: true } } },
    });
    return rows.map(({ _count, ...agency }) => ({
      ...agency,
      userCount: _count.users,
      parcelCount: _count.parcels,
    }));
  }

  async create(dto: CreateAgencyDto) {
    const governorate = dto.governorate.trim();
    const clash = await this.prisma.agency.findUnique({
      where: { governorate },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(`Agency for ${governorate} already exists`);
    }
    return this.prisma.agency.create({
      data: {
        name: dto.name.trim(),
        governorate,
        isActive: true,
      },
    });
  }

  async update(id: number, dto: UpdateAgencyDto) {
    await this.ensureExists(id);
    if (dto.governorate) {
      const governorate = dto.governorate.trim();
      const clash = await this.prisma.agency.findFirst({
        where: { governorate, id: { not: id } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException(`Agency for ${governorate} already exists`);
      }
    }
    return this.prisma.agency.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        governorate: dto.governorate?.trim(),
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    await this.prisma.$transaction([
      this.prisma.parcel.updateMany({
        where: { agencyId: id },
        data: { agencyId: null },
      }),
      this.prisma.user.updateMany({
        where: { agencyId: id },
        data: { agencyId: null },
      }),
      this.prisma.agency.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }

  async resolveIdByGovernorate(governorate: string): Promise<number | null> {
    const agency = await this.prisma.agency.findFirst({
      where: {
        isActive: true,
        governorate: { equals: governorate.trim(), mode: 'insensitive' },
      },
      select: { id: true },
    });
    return agency?.id ?? null;
  }

  private async ensureExists(id: number) {
    const row = await this.prisma.agency.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Agency not found');
  }
}
