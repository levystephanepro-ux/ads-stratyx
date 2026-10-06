// Petits utilitaires partagés par les scripts.
import { searchRaw, type AdsContext, type RawRow } from "@/lib/google-ads/client";
import type { ScriptRange } from "./types";

export const micros = (v: unknown) => Math.round((Number(v ?? 0) / 1_000_000) * 100) / 100;
export const num = (v: unknown) => Number(v ?? 0);
export const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
export const r2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

export function q(ctx: AdsContext, gaql: string): Promise<RawRow[]> {
  return searchRaw(ctx, gaql);
}

export function during(range: ScriptRange): string {
  return `segments.date BETWEEN '${range.since}' AND '${range.until}'`;
}

/** Période de même durée juste avant. */
export function previousRange(range: ScriptRange): ScriptRange {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const until = new Date(range.since + "T00:00:00Z");
  until.setUTCDate(until.getUTCDate() - 1);
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - (range.days - 1));
  return { since: iso(since), until: iso(until), days: range.days };
}

export function makeRange(days: number): ScriptRange {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const until = new Date();
  until.setUTCDate(until.getUTCDate() - 1); // la journée en cours est incomplète
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  return { since: iso(since), until: iso(until), days };
}

/** Somme par clé : additionne les champs numériques de lignes qui partagent une clé. */
export function groupSum<T extends Record<string, number>>(
  rows: RawRow[],
  key: (r: RawRow) => string,
  pick: (r: RawRow) => T,
): Map<string, { first: RawRow; sum: T }> {
  const out = new Map<string, { first: RawRow; sum: T }>();
  for (const r of rows) {
    const k = key(r);
    const v = pick(r);
    const cur = out.get(k);
    if (!cur) out.set(k, { first: r, sum: { ...v } });
    else for (const f of Object.keys(v) as (keyof T)[]) (cur.sum[f] as number) += v[f] as number;
  }
  return out;
}

export const MATCH_LABEL: Record<string, string> = { EXACT: "Exact", PHRASE: "Expression", BROAD: "Large" };
export const DEVICE_LABEL: Record<string, string> = {
  MOBILE: "Mobile", DESKTOP: "Ordinateur", TABLET: "Tablette", CONNECTED_TV: "TV", OTHER: "Autre",
};
export const DAY_LABEL: Record<string, string> = {
  MONDAY: "Lundi", TUESDAY: "Mardi", WEDNESDAY: "Mercredi", THURSDAY: "Jeudi",
  FRIDAY: "Vendredi", SATURDAY: "Samedi", SUNDAY: "Dimanche",
};
export const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

/** Coût, clics, conversions et dérivés pour une ligne de rapport. */
export function perf(m: { cost: number; clicks: number; impressions?: number; conversions: number }) {
  return {
    cost: r2(m.cost),
    clicks: m.clicks,
    ...(m.impressions !== undefined ? { impressions: m.impressions, ctr: r2(ratio(m.clicks, m.impressions)) } : {}),
    conversions: r2(m.conversions),
    cpa: r2(m.conversions > 0 ? m.cost / m.conversions : null),
    cvr: r2(ratio(m.conversions, m.clicks)),
  };
}

export const PERF_COLS = [
  { key: "cost", label: "Coût", type: "eur" as const },
  { key: "clicks", label: "Clics", type: "int" as const },
  { key: "conversions", label: "Conv.", type: "num" as const },
  { key: "cpa", label: "CPA", type: "eur" as const },
];
