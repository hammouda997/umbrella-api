import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, type SenderStockItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  AdjustStockQtyDto,
  CreateStockItemDto,
  UpdateStockItemDto,
} from './dto/stock.dto';
import { roundMoney } from '../finance/sender-finance';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  private assertSender(user: AuthUser) {
    if (user.role !== Role.EXPEDITEUR) {
      throw new ForbiddenException('Stock réservé aux expéditeurs');
    }
  }

  private normalizeVariant(variant?: string | null): string {
    return (variant ?? '').trim();
  }

  private toView(item: SenderStockItem) {
    const unitCost = Number(item.unitCost);
    const quantity = item.quantity;
    const defaultSalePrice =
      item.defaultSalePrice != null ? Number(item.defaultSalePrice) : null;
    return {
      id: item.id,
      senderId: item.senderId,
      name: item.name,
      variant: item.variant,
      size: item.size,
      sku: item.sku,
      quantity,
      unitCost,
      defaultSalePrice,
      lowStockAt: item.lowStockAt,
      stockValue: roundMoney(quantity * unitCost),
      lowStock:
        item.lowStockAt != null ? quantity <= item.lowStockAt : false,
      notes: item.notes,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  async list(user: AuthUser) {
    this.assertSender(user);
    const items = await this.prisma.senderStockItem.findMany({
      where: { senderId: user.id, isActive: true },
      orderBy: [{ name: 'asc' }, { variant: 'asc' }],
    });
    const rows = items.map((i) => this.toView(i));
    const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
    const stockValue = roundMoney(rows.reduce((s, r) => s + r.stockValue, 0));
    return {
      items: rows,
      summary: { totalQty, stockValue, skuCount: rows.length },
    };
  }

  async create(user: AuthUser, dto: CreateStockItemDto) {
    this.assertSender(user);
    const name = dto.name.trim();
    const variant = this.normalizeVariant(dto.variant);
    if (!name) throw new BadRequestException('Nom produit requis');

    const existing = await this.prisma.senderStockItem.findFirst({
      where: {
        senderId: user.id,
        isActive: true,
        name: { equals: name, mode: 'insensitive' },
        variant: { equals: variant, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Cet article (nom + variante) existe déjà — modifiez-le ou ajustez la quantité',
      );
    }

    const created = await this.prisma.senderStockItem.create({
      data: {
        senderId: user.id,
        name,
        variant,
        size: dto.size?.trim() || null,
        sku: dto.sku?.trim() || null,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        defaultSalePrice:
          dto.defaultSalePrice !== undefined ? dto.defaultSalePrice : null,
        lowStockAt: dto.lowStockAt !== undefined ? dto.lowStockAt : null,
        notes: dto.notes?.trim() || null,
      },
    });
    return this.toView(created);
  }

  private async getOwned(user: AuthUser, id: number) {
    this.assertSender(user);
    const item = await this.prisma.senderStockItem.findUnique({
      where: { id },
    });
    if (!item || !item.isActive) {
      throw new NotFoundException('Article introuvable');
    }
    if (item.senderId !== user.id) throw new ForbiddenException();
    return item;
  }

  async update(user: AuthUser, id: number, dto: UpdateStockItemDto) {
    const item = await this.getOwned(user, id);
    const name = dto.name !== undefined ? dto.name.trim() : item.name;
    const variant =
      dto.variant !== undefined
        ? this.normalizeVariant(dto.variant)
        : item.variant;
    if (!name) throw new BadRequestException('Nom produit requis');

    if (name !== item.name || variant !== item.variant) {
      const clash = await this.prisma.senderStockItem.findFirst({
        where: {
          senderId: user.id,
          isActive: true,
          id: { not: id },
          name: { equals: name, mode: 'insensitive' },
          variant: { equals: variant, mode: 'insensitive' },
        },
      });
      if (clash) {
        throw new BadRequestException(
          'Un autre article a déjà ce nom + variante',
        );
      }
    }

    const updated = await this.prisma.senderStockItem.update({
      where: { id },
      data: {
        name,
        variant,
        ...(dto.size !== undefined
          ? { size: dto.size?.trim() || null }
          : {}),
        ...(dto.sku !== undefined ? { sku: dto.sku?.trim() || null } : {}),
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.unitCost !== undefined ? { unitCost: dto.unitCost } : {}),
        ...(dto.defaultSalePrice !== undefined
          ? { defaultSalePrice: dto.defaultSalePrice }
          : {}),
        ...(dto.lowStockAt !== undefined
          ? { lowStockAt: dto.lowStockAt }
          : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes?.trim() || null }
          : {}),
      },
    });
    return this.toView(updated);
  }

  async adjust(user: AuthUser, id: number, dto: AdjustStockQtyDto) {
    const item = await this.getOwned(user, id);
    if (!Number.isFinite(dto.delta) || dto.delta === 0) {
      throw new BadRequestException('Delta invalide');
    }
    const next = item.quantity + dto.delta;
    if (next < 0) {
      throw new BadRequestException(
        `Stock insuffisant (disponible : ${item.quantity})`,
      );
    }
    const updated = await this.prisma.senderStockItem.update({
      where: { id },
      data: { quantity: next },
    });
    return this.toView(updated);
  }

  async remove(user: AuthUser, id: number) {
    await this.getOwned(user, id);
    await this.prisma.senderStockItem.update({
      where: { id },
      data: { isActive: false },
    });
    return { id, deleted: true };
  }

  async consumeForParcel(
    tx: TxClient,
    senderId: number,
    stockItemId: number,
    qty: number,
  ): Promise<number> {
    const item = await tx.senderStockItem.findUnique({
      where: { id: stockItemId },
    });
    if (!item || !item.isActive || item.senderId !== senderId) {
      throw new BadRequestException('Article stock introuvable');
    }
    const take = Math.max(1, qty);
    if (item.quantity < take) {
      throw new BadRequestException(
        `Stock insuffisant pour « ${item.name}${item.variant ? ` / ${item.variant}` : ''} » (dispo ${item.quantity})`,
      );
    }
    await tx.senderStockItem.update({
      where: { id: stockItemId },
      data: { quantity: item.quantity - take },
    });
    return Number(item.unitCost);
  }

  async restockForParcel(
    tx: TxClient,
    stockItemId: number | null | undefined,
    qty: number,
  ) {
    if (stockItemId == null) return;
    const item = await tx.senderStockItem.findUnique({
      where: { id: stockItemId },
      select: { id: true, quantity: true, isActive: true },
    });
    if (!item || !item.isActive) return;
    await tx.senderStockItem.update({
      where: { id: stockItemId },
      data: { quantity: item.quantity + Math.max(1, qty) },
    });
  }
}
