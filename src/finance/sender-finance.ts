/** Default Tunisian last-mile fees when sender does not override. */
export const DEFAULT_DELIVERY_FEE = 7;
export const DEFAULT_RETURN_FEE = 7;

const RETURN_STATUSES = new Set([
  'LIVRAISON_ANNULEE',
  'RETOUR_DEPOT',
  'RETOUR_DEFINITIF',
  'RETOUR_INTER_AGENCE',
  'RETOUR_EXPEDITEURS',
  'RETOUR_RECU',
]);

const DELIVERED_STATUSES = new Set(['LIVRES', 'LIVRES_PAYES']);

const PIPELINE_PAYMENT_STATUSES = new Set([
  'EN_DEMANDE',
  'VALIDE_FINANCE',
  'VALIDE_CHEF',
  'VALIDE_EXPERT',
  'APPROUVE',
]);

export type ParcelMoneyInput = {
  price: number;
  unitSalePrice?: number | null;
  deliveryFee?: number | null;
  returnFee?: number | null;
  status: string;
};

function n(value: number | null | undefined, fallback = 0): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return value;
}

export function roundMoney(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function salePriceOf(p: ParcelMoneyInput): number {
  const sale = p.unitSalePrice;
  if (sale != null && Number.isFinite(sale) && sale >= 0) return sale;
  return n(p.price);
}

export function deliveryFeeOf(p: ParcelMoneyInput): number {
  return Math.max(0, n(p.deliveryFee));
}

export function returnFeeOf(p: ParcelMoneyInput): number {
  return Math.max(0, n(p.returnFee));
}

/** Net COD payout for a delivered parcel (COD − livraison). */
export function netPayoutOf(p: ParcelMoneyInput): number {
  return roundMoney(Math.max(0, n(p.price) - deliveryFeeOf(p)));
}

/**
 * Merchant P&L for a closed parcel:
 * - delivered: vente − base (COD) − livraison
 * - returned: −(livraison + retour)
 * - otherwise: null (still in pipeline)
 */
export function parcelProfitOf(p: ParcelMoneyInput): number | null {
  if (DELIVERED_STATUSES.has(p.status)) {
    return roundMoney(salePriceOf(p) - n(p.price) - deliveryFeeOf(p));
  }
  if (RETURN_STATUSES.has(p.status)) {
    return roundMoney(-(deliveryFeeOf(p) + returnFeeOf(p)));
  }
  return null;
}

export function isDeliveredStatus(status: string): boolean {
  return DELIVERED_STATUSES.has(status);
}

export function isReturnStatus(status: string): boolean {
  return RETURN_STATUSES.has(status);
}

export function isPipelinePaymentStatus(status: string): boolean {
  return PIPELINE_PAYMENT_STATUSES.has(status);
}

export function summarizeSenderFinance(
  parcels: ParcelMoneyInput[],
  payments: Array<{ amount: number; status: string }>,
) {
  let encaisse = 0;
  let fraisLivraison = 0;
  let fraisRetours = 0;
  let profit = 0;
  let ventes = 0;
  let deliveredCount = 0;
  let returnCount = 0;

  for (const p of parcels) {
    if (DELIVERED_STATUSES.has(p.status)) {
      deliveredCount += 1;
      encaisse += netPayoutOf(p);
      fraisLivraison += deliveryFeeOf(p);
      ventes += salePriceOf(p);
      profit += parcelProfitOf(p) ?? 0;
    } else if (RETURN_STATUSES.has(p.status)) {
      returnCount += 1;
      fraisLivraison += deliveryFeeOf(p);
      fraisRetours += returnFeeOf(p);
      profit += parcelProfitOf(p) ?? 0;
    }
  }

  const enDemande = payments
    .filter((p) => p.status === 'EN_DEMANDE')
    .reduce((s, p) => s + n(p.amount), 0);
  const aVerser = payments
    .filter(
      (p) =>
        p.status === 'VALIDE_FINANCE' ||
        p.status === 'VALIDE_CHEF' ||
        p.status === 'VALIDE_EXPERT' ||
        p.status === 'APPROUVE',
    )
    .reduce((s, p) => s + n(p.amount), 0);
  const verse = payments
    .filter((p) => p.status === 'PAYE')
    .reduce((s, p) => s + n(p.amount), 0);
  const enPipeline = enDemande + aVerser;
  const disponible = Math.max(0, roundMoney(encaisse - enPipeline - verse));

  return {
    disponible: roundMoney(disponible),
    enDemande: roundMoney(enDemande),
    aVerser: roundMoney(aVerser),
    enPipeline: roundMoney(enPipeline),
    verse: roundMoney(verse),
    encaisse: roundMoney(encaisse),
    retoursMontant: roundMoney(
      parcels
        .filter((p) => RETURN_STATUSES.has(p.status))
        .reduce((s, p) => s + n(p.price), 0),
    ),
    retoursFrais: roundMoney(fraisRetours),
    fraisLivraison: roundMoney(fraisLivraison),
    profit: roundMoney(profit),
    ventes: roundMoney(ventes),
    deliveredCount,
    returnCount,
  };
}
