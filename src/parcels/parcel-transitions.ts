import { ParcelStatus, Role } from '@prisma/client';
import { PARCEL_STATUS_LABEL } from './parcel-view';

/** Allowed from → to transitions for ops / scan workflows. */
const TRANSITIONS: Record<ParcelStatus, readonly ParcelStatus[]> = {
  [ParcelStatus.EN_ATTENTE]: [
    ParcelStatus.A_ENLEVER,
    ParcelStatus.ENLEVES,
    ParcelStatus.AU_DEPOT,
    ParcelStatus.RETOUR_EXPEDITEURS,
    ParcelStatus.NON_SERIEUX,
    ParcelStatus.SAISIE_DOUANE,
  ],
  [ParcelStatus.A_ENLEVER]: [
    ParcelStatus.ENLEVES,
    ParcelStatus.AU_DEPOT,
    ParcelStatus.RETOUR_EXPEDITEURS,
    ParcelStatus.NON_SERIEUX,
  ],
  [ParcelStatus.ENLEVES]: [ParcelStatus.AU_DEPOT, ParcelStatus.RETOUR_DEPOT],
  [ParcelStatus.AU_DEPOT]: [
    ParcelStatus.EXPEDIE_DESTINATION,
    ParcelStatus.ARRIVE_DESTINATION,
    ParcelStatus.AFFECTE_LIVREUR,
    ParcelStatus.RETOUR_DEPOT,
    ParcelStatus.RETOUR_INTER_AGENCE,
    ParcelStatus.RETOUR_EXPEDITEURS,
    ParcelStatus.SAISIE_DOUANE,
  ],
  [ParcelStatus.EXPEDIE_DESTINATION]: [
    ParcelStatus.ARRIVE_DESTINATION,
    ParcelStatus.RETOUR_DEPOT,
  ],
  [ParcelStatus.ARRIVE_DESTINATION]: [
    ParcelStatus.AFFECTE_LIVREUR,
    ParcelStatus.RETOUR_DEPOT,
    ParcelStatus.RETOUR_INTER_AGENCE,
  ],
  [ParcelStatus.AFFECTE_LIVREUR]: [
    ParcelStatus.EN_COURS,
    ParcelStatus.RETOUR_DEPOT,
    ParcelStatus.LIVRAISON_ANNULEE,
  ],
  [ParcelStatus.RETOUR_DEPOT]: [
    ParcelStatus.AU_DEPOT,
    ParcelStatus.ARRIVE_DESTINATION,
    ParcelStatus.AFFECTE_LIVREUR,
    ParcelStatus.RETOUR_EXPEDITEURS,
    ParcelStatus.RETOUR_INTER_AGENCE,
    ParcelStatus.RETOUR_DEFINITIF,
    ParcelStatus.RETOUR_RECU,
  ],
  [ParcelStatus.EN_COURS]: [
    ParcelStatus.LIVRES,
    ParcelStatus.LIVRAISON_ANNULEE,
    ParcelStatus.A_VERIFIER,
    ParcelStatus.ECHANGES,
    ParcelStatus.RETOUR_DEPOT,
    ParcelStatus.NON_SERIEUX,
  ],
  [ParcelStatus.A_VERIFIER]: [
    ParcelStatus.EN_COURS,
    ParcelStatus.LIVRES,
    ParcelStatus.LIVRAISON_ANNULEE,
    ParcelStatus.ECHANGES,
    ParcelStatus.RETOUR_DEPOT,
    ParcelStatus.NON_SERIEUX,
  ],
  [ParcelStatus.LIVRES]: [
    ParcelStatus.LIVRES_PAYES,
    ParcelStatus.REMBOURSES,
    ParcelStatus.RETOUR_DEPOT,
  ],
  [ParcelStatus.LIVRES_PAYES]: [ParcelStatus.REMBOURSES],
  [ParcelStatus.ECHANGES]: [
    ParcelStatus.LIVRES,
    ParcelStatus.EN_COURS,
    ParcelStatus.RETOUR_DEPOT,
  ],
  [ParcelStatus.REMBOURSES]: [],
  [ParcelStatus.LIVRAISON_ANNULEE]: [
    ParcelStatus.RETOUR_DEPOT,
    ParcelStatus.RETOUR_EXPEDITEURS,
  ],
  [ParcelStatus.RETOUR_DEFINITIF]: [ParcelStatus.REMBOURSES],
  [ParcelStatus.RETOUR_INTER_AGENCE]: [
    ParcelStatus.RETOUR_DEPOT,
    ParcelStatus.RETOUR_RECU,
    ParcelStatus.RETOUR_DEFINITIF,
  ],
  [ParcelStatus.RETOUR_EXPEDITEURS]: [
    ParcelStatus.RETOUR_RECU,
    ParcelStatus.RETOUR_DEFINITIF,
  ],
  [ParcelStatus.RETOUR_RECU]: [
    ParcelStatus.REMBOURSES,
    ParcelStatus.RETOUR_DEFINITIF,
  ],
  [ParcelStatus.SAISIE_DOUANE]: [
    ParcelStatus.RETOUR_DEFINITIF,
    ParcelStatus.REMBOURSES,
  ],
  [ParcelStatus.NON_SERIEUX]: [
    ParcelStatus.EN_ATTENTE,
    ParcelStatus.A_ENLEVER,
    ParcelStatus.RETOUR_EXPEDITEURS,
  ],
  [ParcelStatus.SUPPRIME]: [],
};

const LIVREUR_TARGETS = new Set<ParcelStatus>([
  ParcelStatus.ENLEVES,
  ParcelStatus.AU_DEPOT,
  ParcelStatus.AFFECTE_LIVREUR,
  ParcelStatus.EN_COURS,
  ParcelStatus.A_VERIFIER,
  ParcelStatus.LIVRES,
  ParcelStatus.LIVRES_PAYES,
  ParcelStatus.ECHANGES,
  ParcelStatus.LIVRAISON_ANNULEE,
  ParcelStatus.RETOUR_DEPOT,
  ParcelStatus.RETOUR_EXPEDITEURS,
  ParcelStatus.NON_SERIEUX,
]);

const PICKUP_TARGETS = new Set<ParcelStatus>([
  ParcelStatus.A_ENLEVER,
  ParcelStatus.ENLEVES,
  ParcelStatus.AU_DEPOT,
]);

const MAGASINIER_TARGETS = new Set<ParcelStatus>([
  ParcelStatus.ENLEVES,
  ParcelStatus.AU_DEPOT,
  ParcelStatus.EXPEDIE_DESTINATION,
  ParcelStatus.ARRIVE_DESTINATION,
  ParcelStatus.AFFECTE_LIVREUR,
  ParcelStatus.EN_COURS,
  ParcelStatus.LIVRAISON_ANNULEE,
  ParcelStatus.RETOUR_DEPOT,
  ParcelStatus.RETOUR_INTER_AGENCE,
  ParcelStatus.RETOUR_EXPEDITEURS,
  ParcelStatus.RETOUR_RECU,
]);

const SUPPORT_TARGETS = new Set<ParcelStatus>([
  ParcelStatus.LIVRAISON_ANNULEE,
  ParcelStatus.RETOUR_DEPOT,
  ParcelStatus.RETOUR_INTER_AGENCE,
  ParcelStatus.RETOUR_EXPEDITEURS,
  ParcelStatus.RETOUR_RECU,
  ParcelStatus.RETOUR_DEFINITIF,
]);

/** Expéditeur may only pass return verification → RETOUR_RECU. */
export const EXPEDITEUR_VERIFY_FROM = new Set<ParcelStatus>([
  ParcelStatus.RETOUR_EXPEDITEURS,
  ParcelStatus.RETOUR_DEPOT,
  ParcelStatus.RETOUR_INTER_AGENCE,
]);

const COMMENT_REQUIRED = new Set<ParcelStatus>([
  ParcelStatus.A_VERIFIER,
  ParcelStatus.LIVRAISON_ANNULEE,
  ParcelStatus.RETOUR_DEPOT,
  ParcelStatus.RETOUR_EXPEDITEURS,
  ParcelStatus.RETOUR_DEFINITIF,
  ParcelStatus.RETOUR_INTER_AGENCE,
  ParcelStatus.NON_SERIEUX,
  ParcelStatus.ECHANGES,
  ParcelStatus.SAISIE_DOUANE,
  ParcelStatus.REMBOURSES,
]);

/** Statuses where statusReason should stay visible on lists / filters. */
export const REASON_VISIBLE_STATUSES: ParcelStatus[] = [
  ParcelStatus.A_VERIFIER,
  ParcelStatus.LIVRAISON_ANNULEE,
  ParcelStatus.RETOUR_DEPOT,
  ParcelStatus.RETOUR_INTER_AGENCE,
  ParcelStatus.RETOUR_EXPEDITEURS,
  ParcelStatus.RETOUR_RECU,
  ParcelStatus.RETOUR_DEFINITIF,
  ParcelStatus.NON_SERIEUX,
];

export const RETURN_STATUSES: ParcelStatus[] = [
  ParcelStatus.LIVRAISON_ANNULEE,
  ParcelStatus.RETOUR_DEPOT,
  ParcelStatus.RETOUR_DEFINITIF,
  ParcelStatus.RETOUR_INTER_AGENCE,
  ParcelStatus.RETOUR_EXPEDITEURS,
  ParcelStatus.RETOUR_RECU,
];

export function allowedTargets(from: ParcelStatus): readonly ParcelStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(
  from: ParcelStatus,
  to: ParcelStatus,
  role: Role,
): { ok: true } | { ok: false; reason: string } {
  if (from === to) return { ok: true };
  if (to === ParcelStatus.SUPPRIME) {
    return { ok: false, reason: 'Use DELETE to remove a parcel' };
  }
  if (from === ParcelStatus.SUPPRIME) {
    return { ok: false, reason: 'Parcel is deleted' };
  }

  const targets = TRANSITIONS[from] ?? [];
  if (!targets.includes(to)) {
    const a = PARCEL_STATUS_LABEL[from] ?? from;
    const b = PARCEL_STATUS_LABEL[to] ?? to;
    return {
      ok: false,
      reason: `Impossible : ${a} → ${b}`,
    };
  }

  if (role === Role.LIVREUR && !LIVREUR_TARGETS.has(to)) {
    return {
      ok: false,
      reason: `Action réservée au dépôt (${PARCEL_STATUS_LABEL[to]})`,
    };
  }

  if (role === Role.PICKUP && !PICKUP_TARGETS.has(to)) {
    return {
      ok: false,
      reason: `Pickup : transition non autorisée vers ${PARCEL_STATUS_LABEL[to]}`,
    };
  }

  if (role === Role.MAGASINIER && !MAGASINIER_TARGETS.has(to)) {
    return {
      ok: false,
      reason: `Magasinier : transition non autorisée vers ${PARCEL_STATUS_LABEL[to]}`,
    };
  }

  if (role === Role.SUPPORT && !SUPPORT_TARGETS.has(to)) {
    return {
      ok: false,
      reason: `Support : seuls les retours peuvent être vérifiés`,
    };
  }

  if (role === Role.EXPEDITEUR) {
    if (to !== ParcelStatus.RETOUR_RECU) {
      return {
        ok: false,
        reason:
          'Expéditeur : seule la validation du retour (passer la vérification) est autorisée',
      };
    }
    if (!EXPEDITEUR_VERIFY_FROM.has(from)) {
      return {
        ok: false,
        reason: 'Ce colis n’est pas en attente de vérification retour',
      };
    }
  }

  return { ok: true };
}

export function requiresComment(
  to: ParcelStatus,
  from: ParcelStatus,
  role?: Role,
): boolean {
  if (from === to) return false;
  if (COMMENT_REQUIRED.has(to)) return true;
  // Support must explain cancel cause when closing return verification.
  if (to === ParcelStatus.RETOUR_RECU && role === Role.SUPPORT) return true;
  return false;
}

export function keepsStatusReason(status: ParcelStatus): boolean {
  return REASON_VISIBLE_STATUSES.includes(status);
}
