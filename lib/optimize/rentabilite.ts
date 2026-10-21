// Rentabilité : stockage (marges, ventes signées) et lecture des leads par mois.
// Les calculs purs sont dans rentabilite-calc.ts.
import { getSetting, setSetting } from "@/lib/agent/store";
import { searchRaw } from "@/lib/google-ads/client";
import { isLive } from "@/lib/google-ads/config";
import { EXEMPLE, type RentaInput } from "./rentabilite-calc";

export * from "./rentabilite-calc";

export const roaKey = (customerId: string) => `roas_targets:${customerId}`;
export const salesKey = (customerId: string) => `ventes_signees:${customerId}`;

export async function readRenta(customerId: string): Promise<RentaInput | null> {
  try {
    const raw = await getSetting(roaKey(customerId));
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<RentaInput>;
    return { ...EXEMPLE, ...c, mode: c.mode === "lead" ? "lead" : "ecom" };
  } catch { return null; }
}
export async function saveRenta(customerId: string, v: RentaInput): Promise<void> {
  await setSetting(roaKey(customerId), JSON.stringify(v));
}

/** Ventes réellement signées, par mois (AAAA-MM), saisies à la main. */
export type Sales = Record<string, number>;

export async function readSales(customerId: string): Promise<Sales> {
  try {
    const raw = await getSetting(salesKey(customerId));
    const o = raw ? (JSON.parse(raw) as Sales) : {};
    return Object.fromEntries(Object.entries(o).filter(([k, v]) => /^\d{4}-\d{2}$/.test(k) && Number.isFinite(v) && v >= 0));
  } catch { return {}; }
}
export async function saveSales(customerId: string, s: Sales): Promise<void> {
  await setSetting(salesKey(customerId), JSON.stringify(s));
}

/** Les 6 derniers mois (le mois en cours en dernier), au format AAAA-MM. */
export function lastMonths(n = 6, now = new Date()): string[] {
  const out: string[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

/** Conversions (leads) Google Ads par mois sur les 6 derniers mois. */
export async function leadsByMonth(customerId: string, now = new Date()): Promise<Record<string, number>> {
  const months = lastMonths(6, now);
  if (!isLive()) return Object.fromEntries(months.map((m, i) => [m, 9 + ((i * 5) % 7)]));
  const since = `${months[0]}-01`;
  const until = now.toISOString().slice(0, 10);
  const rows = await searchRaw({ customerId }, `SELECT segments.month, metrics.conversions FROM customer WHERE segments.date BETWEEN '${since}' AND '${until}'`);
  const out: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
  for (const r of rows) {
    const m = String(r.segments?.month ?? "").slice(0, 7);
    if (m in out) out[m] += Number(r.metrics?.conversions ?? 0);
  }
  return out;
}

export interface EffectiveRate {
  /** taux prospect → client utilisé pour les calculs, en % */
  rate: number;
  measured: boolean;
  leads: number;
  signed: number;
  months: number;
}

/**
 * Taux mesuré = ventes signées ÷ leads, sur les mois où des ventes sont saisies
 * (mois en cours exclu : les devis n'y sont pas encore signés). Au moins 10 leads
 * pour que le taux compte ; sinon on garde le taux saisi.
 */
export function effectiveRate(inp: RentaInput, sales: Sales, leads: Record<string, number>, now = new Date()): EffectiveRate {
  const cur = now.toISOString().slice(0, 7);
  let l = 0, s = 0, n = 0;
  for (const [m, v] of Object.entries(sales)) {
    if (m === cur || !(m in leads)) continue;
    l += leads[m]; s += v; n++;
  }
  if (n > 0 && l >= 10) return { rate: Math.min(100, (s / l) * 100), measured: true, leads: l, signed: s, months: n };
  return { rate: inp.conv, measured: false, leads: l, signed: s, months: n };
}
