import { Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BulkUpsertDeliveryRoutesDto,
  UpsertDeliveryRouteDto,
} from './dto/delivery-route.dto';

@Injectable()
export class DeliveryRoutesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.deliveryRoute.findMany({
      orderBy: { governorate: 'asc' },
    });
  }

  async resolveMode(governorate: string): Promise<DeliveryMode> {
    const hit = await this.prisma.deliveryRoute.findFirst({
      where: {
        governorate: { equals: governorate.trim(), mode: 'insensitive' },
      },
    });
    return hit?.mode ?? DeliveryMode.EXTERNAL;
  }

  async upsertOne(dto: UpsertDeliveryRouteDto) {
    const governorate = dto.governorate.trim();
    return this.prisma.deliveryRoute.upsert({
      where: { governorate },
      create: { governorate, mode: dto.mode },
      update: { mode: dto.mode },
    });
  }

  async upsertMany(dto: BulkUpsertDeliveryRoutesDto) {
    const results = [];
    for (const route of dto.routes) {
      results.push(await this.upsertOne(route));
    }
    return results;
  }

  async remove(governorate: string) {
    const hit = await this.prisma.deliveryRoute.findFirst({
      where: {
        governorate: { equals: governorate.trim(), mode: 'insensitive' },
      },
    });
    if (!hit) throw new NotFoundException('Route introuvable');
    await this.prisma.deliveryRoute.delete({ where: { id: hit.id } });
    return { deleted: true, governorate: hit.governorate };
  }
}
