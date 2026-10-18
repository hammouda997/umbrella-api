export type ParcelInputDef = {
  id: string;
  label: string;
  required: boolean;
};

export type ParcelCustomInput = {
  id: string;
  label: string;
  value: string;
};

const MAX_DEFS = 12;
const MAX_LABEL = 60;
const MAX_VALUE = 120;

export function normalizeInputDefs(raw: unknown): ParcelInputDef[] {
  if (!Array.isArray(raw)) return [];
  const out: ParcelInputDef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? '').trim();
    const label = String(row.label ?? '').trim();
    if (!id || !label || label.length > MAX_LABEL) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label,
      required: Boolean(row.required),
    });
    if (out.length >= MAX_DEFS) break;
  }
  return out;
}

export function normalizeCustomInputs(raw: unknown): ParcelCustomInput[] {
  if (!Array.isArray(raw)) return [];
  const out: ParcelCustomInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? '').trim();
    const label = String(row.label ?? '').trim();
    const value = String(row.value ?? '').trim();
    if (!id || !label || !value) continue;
    out.push({
      id,
      label,
      value: value.slice(0, MAX_VALUE),
    });
  }
  return out;
}
