import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParcelStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { SupportBotChatDto } from './dto/support-bot.dto';

const STATUS_FR: Partial<Record<ParcelStatus, string>> = {
  EN_ATTENTE: 'En attente de collecte',
  A_ENLEVER: 'À enlever',
  ENLEVES: 'Enlevé',
  AU_DEPOT: 'Au dépôt',
  EN_COURS: 'En cours de livraison',
  LIVRES: 'Livré',
  LIVRES_PAYES: 'Livré payé / viré',
  RETOUR_DEFINITIF: 'Retour définitif',
  A_VERIFIER: 'À vérifier',
};

@Injectable()
export class SupportBotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async chat(user: AuthUser, dto: SupportBotChatDto) {
    const message = dto.message.trim();
    const reply = await this.ruleReply(user, message);
    if (reply) {
      return {
        reply,
        source: 'rules' as const,
        suggestions: this.suggestions(user.role),
      };
    }

    const llm = await this.optionalLlmReply(user, message, dto.history ?? []);
    if (llm) {
      return {
        reply: llm,
        source: 'llm' as const,
        suggestions: this.suggestions(user.role),
      };
    }

    return {
      reply: this.fallback(user.role),
      source: 'fallback' as const,
      suggestions: this.suggestions(user.role),
    };
  }

  private suggestions(role: Role): string[] {
    const base = [
      'Où est mon colis ?',
      'Comment ouvrir une relance ?',
      'Changement de prix',
    ];
    if (role === Role.EXPEDITEUR) {
      return [...base, 'Quand serai-je viré ?', 'Créer un ticket'];
    }
    if (role === Role.LIVREUR || role === Role.MAGASINIER) {
      return ['Voir une relance', 'Statuts colis', 'Scanner'];
    }
    return base;
  }

  private fallback(role: Role): string {
    return [
      `Bonjour — je suis l’assistant Umbrella (session ${role}).`,
      'Je peux retrouver un colis (code UMB-…), expliquer un statut, ou guider pour une relance / un changement de prix.',
      'Les tickets colis sont possibles après sortie chez l’expéditeur, jusqu’au virement.',
    ].join('\n');
  }

  private async ruleReply(
    user: AuthUser,
    message: string,
  ): Promise<string | null> {
    const lower = message.toLowerCase();

    if (
      /bonjour|salut|hello|hey|bonsoir/.test(lower) &&
      message.trim().split(/\s+/).length <= 4
    ) {
      return this.fallback(user.role);
    }

    const codeMatch = message.match(/\b(UMB-[A-Z0-9-]+)\b/i);
    if (codeMatch) {
      return this.lookupParcel(user, codeMatch[1]!.toUpperCase());
    }

    if (/relance/.test(lower)) {
      return [
        'Pour une **relance** :',
        '1. Ouvrez Tickets → type « Relance ».',
        '2. Choisissez un colis déjà sorti (pas EN_ATTENTE), avant virement.',
        '3. Le livreur assigné et le magasinier de l’agence sont notifiés.',
        'Astuce : depuis la fiche colis, bouton « Ticket colis ».',
      ].join('\n');
    }

    if (/prix|changement de prix|montant|cod/.test(lower)) {
      return [
        'Pour un **changement de prix** :',
        '1. Tickets → type « Changement de prix ».',
        '2. Colis éligible (après sortie, avant viré).',
        '3. Indiquez le nouveau montant — le support applique le prix à la résolution.',
      ].join('\n');
    }

    if (/vire|virement|paiement|solde|cod/.test(lower)) {
      return [
        'Le **virement** intervient après livraison payée (statut Livré payé) via Paiements.',
        'Tant que le colis n’est pas viré, vous pouvez encore ouvrir relance / changement de prix.',
        user.role === Role.EXPEDITEUR
          ? 'Voir le menu Paiements pour vos demandes.'
          : 'Les expéditeurs suivent ça dans Paiements.',
      ].join('\n');
    }

    if (/statut|statuts|parcours|étape/.test(lower)) {
      return [
        'Parcours typique : En attente → À enlever → Enlevé → Dépôt → En cours → Livré → Livré payé (viré).',
        'Donnez-moi un code colis (ex. UMB-COURS-001) pour le statut exact.',
      ].join('\n');
    }

    if (/ticket|support|signaler|aide/.test(lower)) {
      return [
        'Support tickets : Général, Relance, ou Changement de prix.',
        'Menu Tickets (ou Support pour le rôle support).',
        'Besoin d’un colis précis ? Envoyez son code.',
      ].join('\n');
    }

    if (
      /mes colis|où est|ou est|dernier colis|colis en cours/.test(lower)
    ) {
      return this.summarizeRecentParcels(user);
    }

    return null;
  }

  private async parcelScope(
    user: AuthUser,
  ): Promise<Prisma.ParcelWhereInput | null> {
    const notDeleted = { status: { not: ParcelStatus.SUPPRIME } };
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) {
      return notDeleted;
    }
    if (
      user.role === Role.CHEF_AGENCE ||
      user.role === Role.MAGASINIER ||
      user.role === Role.PICKUP ||
      user.role === Role.SUPPORT
    ) {
      const agencyId =
        user.agencyId ??
        (
          await this.prisma.user.findUnique({
            where: { id: user.id },
            select: { agencyId: true },
          })
        )?.agencyId;
      if (!agencyId) return null;
      return { ...notDeleted, agencyId };
    }
    if (user.role === Role.LIVREUR) {
      return { ...notDeleted, driverId: user.id };
    }
    if (user.role === Role.CLIENT) {
      const me = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { phone: true },
      });
      return me?.phone ? { ...notDeleted, phone: me.phone } : null;
    }
    return { ...notDeleted, senderId: user.id };
  }

  private async lookupParcel(user: AuthUser, code: string): Promise<string> {
    const scope = await this.parcelScope(user);
    if (!scope) {
      return 'Aucun périmètre colis pour votre compte.';
    }
    const parcel = await this.prisma.parcel.findFirst({
      where: {
        AND: [
          scope,
          {
            OR: [
              { code },
              { code: { equals: code, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        code: true,
        status: true,
        recipientName: true,
        city: true,
        price: true,
        driver: { select: { name: true } },
      },
    });
    if (!parcel) {
      return `Colis « ${code} » introuvable dans votre périmètre. Vérifiez le code ou vos droits.`;
    }
    const status =
      STATUS_FR[parcel.status] ?? parcel.status.replace(/_/g, ' ');
    return [
      `**${parcel.code ?? `#${parcel.id}`}** — ${parcel.recipientName} (${parcel.city})`,
      `Statut : ${status}`,
      `Montant : ${Number(parcel.price).toFixed(3)} TND`,
      parcel.driver?.name ? `Livreur : ${parcel.driver.name}` : 'Livreur : non assigné',
    ].join('\n');
  }

  private async summarizeRecentParcels(user: AuthUser): Promise<string> {
    const scope = await this.parcelScope(user);
    if (!scope) return 'Aucun colis visible pour votre compte.';
    const rows = await this.prisma.parcel.findMany({
      where: scope,
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { code: true, status: true, recipientName: true, city: true },
    });
    if (!rows.length) return 'Aucun colis récent.';
    const lines = rows.map((p) => {
      const st = STATUS_FR[p.status] ?? p.status;
      return `• ${p.code ?? '—'} — ${st} — ${p.recipientName} (${p.city})`;
    });
    return ['Derniers colis :', ...lines, '', 'Donnez un code pour le détail.'].join(
      '\n',
    );
  }

  private async optionalLlmReply(
    user: AuthUser,
    message: string,
    history: { role: string; content: string }[],
  ): Promise<string | null> {
    const key = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!key) return null;

    const system = [
      'Tu es l’assistant support Umbrella Express (logistique Tunisie).',
      `Utilisateur authentifié : ${user.email} (${user.role}).`,
      'Réponds en français, concis, utile. Pas de secrets ni d’invention de statuts.',
      'Oriente vers Tickets (relance / prix), Scanner, Paiements selon le rôle.',
      'Fenêtre tickets colis : après sortie expéditeur, jusqu’au virement.',
    ].join(' ');

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 400,
          messages: [
            { role: 'system', content: system },
            ...history.slice(-8).map((m) => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content.slice(0, 1500),
            })),
            { role: 'user', content: message },
          ],
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      return text || null;
    } catch {
      return null;
    }
  }
}
