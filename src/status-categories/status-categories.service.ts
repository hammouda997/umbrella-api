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
  JOURNEY_STEP_KEYS,
} from './status-category.defaults';

const JOURNEY_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente de collecte',
  ENLEVES: 'Colis récupéré',
  AU_DEPOT: 'Arrivé au dépôt',
  EXPEDIE_DESTINATION: 'Expédié vers le dépôt de destination',
  ARRIVE_DESTINATION: 'Arrivé au dépôt de destination',
  AFFECTE_LIVREUR: 'Affecté à un livreur',
  EN_COURS: 'En cours de livraison',
  LIVRES: 'Livré',
  LIVRAISON_ANNULEE: 'Livraison annulée',
  RETOUR_DEPOT: 'Retour en agence',
  RETOUR_EXPEDITEURS: 'En transit vers l’expéditeur',
  RETOUR_RECU: 'Retour livré à l’expéditeur',
};

@Injectable()
export class StatusCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    await this.ensureDefaults();
    await this.ensureJourneySteps();
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
        showInJourney: dto.showInJourney ?? true,
        visibleRoles: dto.visibleRoles ?? [],
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
        showInJourney: dto.showInJourney,
        visibleRoles: dto.visibleRoles,
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
        ...row,
        isActive: true,
        showInJourney: true,
        visibleRoles: [],
      })),
    });
  }

  /** Ensure every canonical parcours step exists so Super Admin can manage it. */
  private async ensureJourneySteps() {
    const existing = await this.prisma.statusCategory.findMany({
      select: { key: true },
    });
    const have = new Set(existing.map((r) => r.key));
    let sortOrder = await this.prisma.statusCategory.count();

    for (const key of JOURNEY_STEP_KEYS) {
      if (have.has(key)) continue;
      await this.prisma.statusCategory.create({
        data: {
          key,
          label: JOURNEY_LABELS[key] ?? key,
          color: '#991211',
          icon: key.startsWith('RETOUR') || key === 'LIVRAISON_ANNULEE'
            ? 'return'
            : key === 'LIVRES'
              ? 'check'
              : 'truck',
          sortOrder: sortOrder++,
          isActive: false,
          showInJourney: true,
          visibleRoles: [],
        },
      });
      have.add(key);
    }
  }
}
