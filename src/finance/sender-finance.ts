/** Default Tunisian last-mile fees when sender does not override. */
export const DEFAULT_DELIVERY_FEE = 7;
export const DEFAULT_RETURN_FEE = 7;
export const DEFAULT_VERSEMENT_HOLD_HOURS = 48;

const RETURN_STATUSES = new Set([
  'LIVRAISON_ANNULEE',
  'RETOUR_DEPOT',
  'RETOUR_DEFINITIF',
  'RETOUR_INTER_AGENCE',
  'RETOUR_EXPEDITEURS',
  'RETOUR_RECU',
]);

const DELIVERED_STATUSES = new Set(['LIVRES', 'LIVRES_PAYES']);
const OPEN_DELIVERED = new Set(['LIVRES']);

const PIPELINE_PAYMENT_STATUSES = new Set([
  'EN_DEMANDE',
  'VALIDE_FINANCE',
  'VALIDE_CHEF',
  'VALIDE_EXPERT',
  'APPROUVE',
  'AWAITING_DECHARGE',
]);

const LOCKED_PAYMENT_STATUSES = new Set([
  'EN_DEMANDE',
  'VALIDE_FINANCE',
  'VALIDE_CHEF',
  'VALIDE_EXPERT',
  'APPROUVE',
  'AWAITING_DECHARGE',
  'PAYE',
]);

export type ParcelMoneyInput = {
  id?: number;
  price: number;
  unitSalePrice?: number | null;
  unitCost?: number | null;
  deliveryFee?: number | null;
  returnFee?: number | null;
  status: string;
  deliveredAt?: string | Date | null;
};

export type PaymentMoneyInput = {
  amount: number;
  status: string;
  items?: Array<{ parcelId: number; amount: number }>;
};

export type SenderFinanceOptions = {
  holdHours?: number;
  now?: Date;
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

export function unitCostOf(p: ParcelMoneyInput): number {
  return Math.max(0, n(p.unitCost));
}

export function deliveryFeeOf(p: ParcelMoneyInput): number {
  return Math.max(0, n(p.deliveryFee));
}

export function returnFeeOf(p: ParcelMoneyInput): number {
  return Math.max(0, n(p.returnFee));
}

export function netPayoutOf(p: ParcelMoneyInput): number {
  return roundMoney(Math.max(0, n(p.price) - deliveryFeeOf(p)));
}

export function parcelProfitOf(p: ParcelMoneyInput): number | null {
  if (DELIVERED_STATUSES.has(p.status)) {
    return roundMoney(salePriceOf(p) - deliveryFeeOf(p) - unitCostOf(p));
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

export function isHoldElapsed(
  deliveredAt: string | Date | null | undefined,
  holdHours: number,
  now: Date = new Date(),
): boolean {
  if (!deliveredAt) return false;
  const at = deliveredAt instanceof Date ? deliveredAt : new Date(deliveredAt);
  if (Number.isNaN(at.getTime())) return false;
  const ms = holdHours * 60 * 60 * 1000;
  return now.getTime() - at.getTime() >= ms;
}

function lockedParcelIds(payments: PaymentMoneyInput[]): Set<number> {
  const ids = new Set<number>();
  for (const pay of payments) {
    if (!LOCKED_PAYMENT_STATUSES.has(pay.status)) continue;
    for (const item of pay.items ?? []) {
      ids.add(item.parcelId);
    }
  }
  return ids;
}

export function summarizeSenderFinance(
  parcels: ParcelMoneyInput[],
  payments: PaymentMoneyInput[],
  options: SenderFinanceOptions = {},
) {
  const holdHours = Math.max(
    1,
    options.holdHours ?? DEFAULT_VERSEMENT_HOLD_HOURS,
  );
  const now = options.now ?? new Date();

  let encaisse = 0;
  let fraisLivraison = 0;
  let fraisRetours = 0;
  let profit = 0;
  let ventes = 0;
  let deliveredCount = 0;
  let returnCount = 0;
  let holdLocked = 0;
  let holdReady = 0;

  const locked = lockedParcelIds(payments);

  for (const p of parcels) {
    if (DELIVERED_STATUSES.has(p.status)) {
      deliveredCount += 1;
      encaisse += netPayoutOf(p);
      fraisLivraison += deliveryFeeOf(p);
      ventes += salePriceOf(p);
      profit += parcelProfitOf(p) ?? 0;

      if (
        OPEN_DELIVERED.has(p.status) &&
        (p.id == null || !locked.has(p.id))
      ) {
        const net = netPayoutOf(p);
        if (isHoldElapsed(p.deliveredAt, holdHours, now)) {
          holdReady += net;
        } else {
          holdLocked += net;
        }
      }
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
        p.status === 'APPROUVE' ||
        p.status === 'AWAITING_DECHARGE',
    )
    .reduce((s, p) => s + n(p.amount), 0);
  const verse = payments
    .filter((p) => p.status === 'PAYE')
    .reduce((s, p) => s + n(p.amount), 0);
  const enPipeline = enDemande + aVerser;

  const disponible = holdReady;
  const indisponible = holdLocked + enPipeline;

  return {
    disponible: roundMoney(Math.max(0, disponible)),
    indisponible: roundMoney(Math.max(0, indisponible)),
    holdLocked: roundMoney(holdLocked),
    holdReady: roundMoney(holdReady),
    holdHours,
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
