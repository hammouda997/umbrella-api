export const STATUS_CATEGORY_ICONS = [
  'package',
  'clock',
  'truck',
  'check',
  'return',
  'coins',
  'alert',
] as const;

export type StatusCategoryIcon = (typeof STATUS_CATEGORY_ICONS)[number];

export const TOTAL_CATEGORY_KEY = 'TOTAL';

export type StatusCategorySeed = {
  key: string;
  label: string;
  color: string;
  icon: StatusCategoryIcon;
  sortOrder: number;
};

/** Default KPI cards seeded when the table is empty. */
export const DEFAULT_STATUS_CATEGORIES: StatusCategorySeed[] = [
  {
    key: TOTAL_CATEGORY_KEY,
    label: 'Total',
    color: '#E11D48',
    icon: 'package',
    sortOrder: 0,
  },
  {
    key: 'EN_ATTENTE',
    label: 'En attente',
    color: '#00875A',
    icon: 'clock',
    sortOrder: 1,
  },
  {
    key: 'AU_DEPOT',
    label: 'Au dépôt',
    color: '#0EA5E9',
    icon: 'truck',
    sortOrder: 2,
  },
  {
    key: 'EN_COURS',
    label: 'En cours',
    color: '#0065FF',
    icon: 'truck',
    sortOrder: 3,
  },
  {
    key: 'A_VERIFIER',
    label: 'À vérifier',
    color: '#EC4899',
    icon: 'alert',
    sortOrder: 4,
  },
  {
    key: 'LIVRES',
    label: 'Livrés',
    color: '#6554C0',
    icon: 'check',
    sortOrder: 5,
  },
  {
    key: 'LIVRES_PAYES',
    label: 'Livrés payés',
    color: '#14B8A6',
    icon: 'coins',
    sortOrder: 6,
  },
  {
    key: 'RETOUR_DEPOT',
    label: 'Retour dépôt',
    color: '#FFAB00',
    icon: 'return',
    sortOrder: 7,
  },
];

export const ALLOWED_CATEGORY_KEYS = new Set<string>([
  TOTAL_CATEGORY_KEY,
  'NON_SERIEUX',
  'EN_ATTENTE',
  'A_ENLEVER',
  'ENLEVES',
  'AU_DEPOT',
  'RETOUR_DEPOT',
  'EN_COURS',
  'A_VERIFIER',
  'LIVRES',
  'LIVRES_PAYES',
  'ECHANGES',
  'REMBOURSES',
  'RETOUR_DEFINITIF',
  'RETOUR_INTER_AGENCE',
  'RETOUR_EXPEDITEURS',
  'RETOUR_RECU',
  'SAISIE_DOUANE',
]);
