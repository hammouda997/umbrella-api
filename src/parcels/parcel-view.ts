import { Prisma, ParcelStatus } from '@prisma/client';

export const PARCEL_STATUS_LABEL: Record<ParcelStatus, string> = {
  NON_SERIEUX: 'Non sérieux',
  EN_ATTENTE: 'En attente de collecte',
  A_ENLEVER: 'En attente de collecte',
  ENLEVES: 'Colis récupéré',
  AU_DEPOT: 'Arrivé au dépôt',
  EXPEDIE_DESTINATION: 'Expédié vers le dépôt de destination',
  ARRIVE_DESTINATION: 'Arrivé au dépôt de destination',
  AFFECTE_LIVREUR: 'Affecté à un livreur',
  RETOUR_DEPOT: 'Retour en agence',
  EN_COURS: 'En cours de livraison',
  A_VERIFIER: 'À vérifier',
  LIVRES: 'Livré',
  LIVRES_PAYES: 'Livré payé',
  ECHANGES: 'Échange',
  REMBOURSES: 'Remboursé',
  LIVRAISON_ANNULEE: 'Livraison annulée',
  RETOUR_DEFINITIF: 'Retour définitif',
  RETOUR_INTER_AGENCE: 'Retour inter-agence',
  RETOUR_EXPEDITEURS: 'En transit vers l’expéditeur',
  RETOUR_RECU: 'Retour livré à l’expéditeur',
  SAISIE_DOUANE: 'Saisie par la douane',
  SUPPRIME: 'Supprimé',
};

export const PARCEL_LIST_INCLUDE = {
  sender: { select: { id: true, name: true, email: true, phone: true } },
  driver: { select: { id: true, name: true, phone: true } },
  zone: { select: { id: true, name: true } },
  agency: { select: { id: true, name: true, governorate: true } },
} satisfies Prisma.ParcelInclude;

export const PARCEL_DETAIL_INCLUDE = {
  ...PARCEL_LIST_INCLUDE,
  events: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      label: true,
      comment: true,
      status: true,
      createdAt: true,
      actor: { select: { id: true, name: true, role: true } },
    },
  },
} satisfies Prisma.ParcelInclude;

type ParcelWithList = Prisma.ParcelGetPayload<{
  include: typeof PARCEL_LIST_INCLUDE;
}>;
type ParcelWithDetail = Prisma.ParcelGetPayload<{
  include: typeof PARCEL_DETAIL_INCLUDE;
}>;

export type TimelineEntry = {
  at: Date;
  label: string;
  comment: string | null;
  status: ParcelStatus | null;
  actor: string | null;
};

function baseView<T extends ParcelWithList>(parcel: T) {
  const { navexRaw, ...rest } = parcel;
  void navexRaw;
  return { ...rest, price: Number(parcel.price) };
}

export function toParcelListView(parcel: ParcelWithList) {
  return baseView(parcel);
}

export function toParcelDetailView(parcel: ParcelWithDetail) {
  const { events, ...rest } = baseView(parcel);
  const timeline: TimelineEntry[] = events.map((e) => ({
    at: e.createdAt,
    label: e.comment ? `${e.label} — ${e.comment}` : e.label,
    comment: e.comment,
    status: e.status,
    actor: e.actor?.name ?? null,
  }));
  return { ...rest, timeline };
}
