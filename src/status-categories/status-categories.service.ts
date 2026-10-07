import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStatusCategoryDto,
  UpdateStatusCategoryDto,
} from './dto/status-category.dto';
import {
  ALLOWED_CATEGORY_KEYS,
  DEFAULT_STATUS_CATEGORIES,
} from './status-category.defaults';

@Injectable()
export class StatusCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    await this.ensureDefaults();
    return this.prisma.statusCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async create(dto: CreateStatusCategoryDto) {
    this.assertKey(dto.key);
    const existing = await this.prisma.statusCategory.findUnique({
      where: { key: dto.key },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Category ${dto.key} already exists`);
    }

    const sortOrder =
      dto.sortOrder ?? (await this.prisma.statusCategory.count());

    return this.prisma.statusCategory.create({
      data: {
        key: dto.key,
        label: dto.label.trim(),
        color: dto.color.toUpperCase(),
        icon: dto.icon,
        sortOrder,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: number, dto: UpdateStatusCategoryDto) {
    const current = await this.ensureExists(id);

    if (dto.key && dto.key !== current.key) {
      this.assertKey(dto.key);
      const clash = await this.prisma.statusCategory.findUnique({
        where: { key: dto.key },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException(`Category ${dto.key} already exists`);
      }
    }

    return this.prisma.statusCategory.update({
      where: { id },
      data: {
        key: dto.key,
        label: dto.label?.trim(),
        color: dto.color?.toUpperCase(),
        icon: dto.icon,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    await this.prisma.statusCategory.delete({ where: { id } });
    return { id, deleted: true };
  }

  private assertKey(key: string) {
    if (!ALLOWED_CATEGORY_KEYS.has(key)) {
      throw new BadRequestException(`Invalid category key: ${key}`);
    }
  }

  private async ensureExists(id: number) {
    const row = await this.prisma.statusCategory.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Category not found');
    return row;
  }

  private async ensureDefaults() {
    const count = await this.prisma.statusCategory.count();
    if (count > 0) return;
    await this.prisma.statusCategory.createMany({
      data: DEFAULT_STATUS_CATEGORIES.map((row) => ({
        key: row.key,
        label: row.label,
        color: row.color,
        icon: row.icon,
        sortOrder: row.sortOrder,
        isActive: true,
      })),
    });
  }
}
