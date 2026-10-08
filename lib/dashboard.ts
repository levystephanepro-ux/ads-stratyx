// Tableau de bord : chiffres de la période vs période précédente (jour par
// jour), part d'impressions (Search) et position, appareils, rythme de dépense
// du mois. Sans IA.
import { searchRaw, type AdsContext, type RawRow } from "@/lib/google-ads/client";
import { getSetting, setSetting } from "@/lib/agent/store";
import { previous, periodRange, type Range } from "@/lib/reports/periods";

export interface Kpis { cost: number; clicks: number; impressions: number; conv: number; value: number }
const Z = (): Kpis => ({ cost: 0, clicks: 0, impressions: 0, conv: 0, value: 0 });
const K = (r: RawRow): Kpis => ({
  cost: Number(r.metrics?.costMicros ?? 0) / 1e6, clicks: Number(r.metrics?.clicks ?? 0),
  impressions: Number(r.metrics?.impressions ?? 0), conv: Number(r.metrics?.conversions ?? 0),
  value: Number(r.metrics?.conversionsValue ?? 0),
});
const add = (a: Kpis, b: Kpis): Kpis => ({ cost: a.cost + b.cost, clicks: a.clicks + b.clicks, impressions: a.impressions + b.impressions, conv: a.conv + b.conv, value: a.value + b.value });
const M = "metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value";
const SHARE = "metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share, metrics.top_impression_percentage, metrics.absolute_top_impression_percentage";
const between = (r: { since: string; until: string }) => `segments.date BETWEEN '${r.since}' AND '${r.until}'`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown): number | null => (v === undefined || v === null || v === "" ? null : Number(v));

/** Un jour de chiffres (compte entier). */
export interface Day extends Kpis { date: string }
/** Part d'impressions Search et position, pondérées. */
export interface ShareAgg { share: number | null; lostBudget: number | null; lostRank: number | null; top: number | null; absTop: number | null }
export interface ShareDay extends ShareAgg { date: string }
export interface Missed { impr: number; clicks: number; conv: number }
export interface ShareRow { name: string; impressionShare: number | null; lostBudget: number | null; lostRank: number | null; cost: number; conv: number }
export interface DeviceRow { device: string; label: string; clicks: number; cost: number; conv: number; impressions: number }
export interface Pacing {
  month: string;                 // AAAA-MM
  spent: number;                 // dépensé du 1er à aujourd'hui (aujourd'hui partiel)
  daysElapsed: number; daysInMonth: number;
  dailyBudgets: number;          // somme des budgets quotidiens des campagnes actives
  avgLast7: number;              // dépense moyenne des 7 derniers jours complets
  projection: number;            // fin de mois au rythme des 7 derniers jours
  target: number | null;         // budget mensuel saisi
  googleCap: number;             // plafond théorique Google : budgets × jours du mois
}
export interface Dashboard {
  range: Range; prev: Range;
  now: Kpis; before: Kpis;
  daily: { date: string; cost: number; conv: number }[];
  /** Séries jour par jour, alignées : cur[i] se compare à prev[i]. */
  series: { cur: Day[]; prev: Day[] };
  share: {
    impressionShare: number | null; lostBudget: number | null; lostRank: number | null;
    top: number | null; absTop: number | null;
    before: ShareAgg;
    campaigns: ShareRow[];
    daily: ShareDay[];
    /** Estimation de ce qui a été obtenu / manqué (Search). */
    got: Missed | null; missedBudget: Missed | null; missedRank: Missed | null;
  };
  devices: DeviceRow[];
  pacing: Pacing;
  errors: string[];
}

export const budgetKey = (customerId: string) => `monthly_budget:${customerId}`;
export async function getMonthlyBudget(customerId: string): Promise<number | null> {
  const v = Number(await getSetting(budgetKey(customerId)));
  return Number.isFinite(v) && v > 0 ? v : null;
}
export async function setMonthlyBudget(customerId: string, amount: number | null): Promise<void> {
  await setSetting(budgetKey(customerId), amount && amount > 0 ? String(Math.round(amount)) : "");
}

/** Toutes les dates d'une période (les jours sans chiffres valent 0). */
function dates(r: Range): string[] {
  const out: string[] = [];
  const d = new Date(r.since + "T00:00:00Z");
  const end = new Date(r.until + "T00:00:00Z");
  while (d <= end && out.length < 400) { out.push(iso(d)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

function byDay(rows: RawRow[], r: Range): Day[] {
  const m = new Map<string, Kpis>();
  rows.forEach((x) => { const d = String(x.segments?.date ?? ""); m.set(d, add(m.get(d) ?? Z(), K(x))); });
  return dates(r).map((date) => ({ date, ...(m.get(date) ?? Z()) }));
}

/** Agrège la part d'impressions et la position (campagnes Search), pondérées. */
function aggShare(rows: RawRow[]) {
  let elig = 0, impr = 0, lostB = 0, lostR = 0, topW = 0, absW = 0, posImpr = 0, clicks = 0, conv = 0;
  for (const r of rows) {
    const k = K(r);
    const share = num(r.metrics?.searchImpressionShare);
    if (share && share > 0 && k.impressions > 0) {
      const e = k.impressions / share;
      elig += e; impr += k.impressions; clicks += k.clicks; conv += k.conv;
      lostB += e * (num(r.metrics?.searchBudgetLostImpressionShare) ?? 0);
      lostR += e * (num(r.metrics?.searchRankLostImpressionShare) ?? 0);
    }
    const top = num(r.metrics?.topImpressionPercentage), abs = num(r.metrics?.absoluteTopImpressionPercentage);
    if (top !== null && k.impressions > 0) { topW += top * k.impressions; absW += (abs ?? 0) * k.impressions; posImpr += k.impressions; }
  }
  const agg: ShareAgg = {
    share: elig ? impr / elig : null, lostBudget: elig ? lostB / elig : null, lostRank: elig ? lostR / elig : null,
    top: posImpr ? topW / posImpr : null, absTop: posImpr ? absW / posImpr : null,
  };
  return { agg, elig, impr, lostB, lostR, clicks, conv };
}

const DEVICES: Record<string, string> = { MOBILE: "Mobile", DESKTOP: "Ordinateur", TABLET: "Tablette", CONNECTED_TV: "TV connectée", OTHER: "Autre" };

export async function buildDashboard(ctx: AdsContext, periodKey: string, now = new Date()): Promise<Dashboard> {
  const range = periodRange(periodKey, now);
  const prev = previous(range);
  const errors: string[] = [];
  const safe = async <T,>(label: string, fn: () => Promise<T>, fb: T): Promise<T> => {
    try { return await fn(); } catch (e) { errors.push(`${label} : ${e instanceof Error ? e.message : String(e)}`); return fb; }
  };

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const daysInMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
  const y = new Date(today); y.setUTCDate(y.getUTCDate() - 1);
  const w7 = new Date(today); w7.setUTCDate(w7.getUTCDate() - 7);
  const SEARCH = "campaign.advertising_channel_type = 'SEARCH' AND metrics.impressions > 0";

  const [cur, prv, camps, campsPrev, shareDays, devices, month, last7, budgets, target] = await Promise.all([
    safe("Chiffres", () => searchRaw(ctx, `SELECT segments.date, ${M} FROM customer WHERE ${between(range)}`), [] as RawRow[]),
    safe("Période précédente", () => searchRaw(ctx, `SELECT segments.date, ${M} FROM customer WHERE ${between(prev)}`), [] as RawRow[]),
    safe("Part d'impressions", () => searchRaw(ctx, `SELECT campaign.name, campaign.advertising_channel_type, ${M}, ${SHARE}
      FROM campaign WHERE ${between(range)} AND metrics.impressions > 0`), [] as RawRow[]),
    safe("Part d'impressions (précédente)", () => searchRaw(ctx, `SELECT campaign.name, ${M}, ${SHARE}
      FROM campaign WHERE ${between(prev)} AND ${SEARCH}`), [] as RawRow[]),
    safe("Part d'impressions par jour", () => searchRaw(ctx, `SELECT segments.date, campaign.name, ${M}, ${SHARE}
      FROM campaign WHERE ${between(range)} AND ${SEARCH}`), [] as RawRow[]),
    safe("Appareils", () => searchRaw(ctx, `SELECT segments.device, ${M} FROM customer WHERE ${between(range)}`), [] as RawRow[]),
    safe("Dépense du mois", () => searchRaw(ctx, `SELECT segments.date, ${M} FROM customer WHERE segments.date BETWEEN '${iso(monthStart)}' AND '${iso(today)}'`), [] as RawRow[]),
    safe("7 derniers jours", () => searchRaw(ctx, `SELECT ${M} FROM customer WHERE segments.date BETWEEN '${iso(w7)}' AND '${iso(y)}'`), [] as RawRow[]),
    safe("Budgets", () => searchRaw(ctx, `SELECT campaign_budget.resource_name, campaign_budget.amount_micros FROM campaign
      WHERE campaign.status = 'ENABLED' AND campaign.serving_status != 'ENDED'`), [] as RawRow[]),
    getMonthlyBudget(ctx.customerId).catch(() => null),
  ]);

  // part d'impressions Search, pondérée par les impressions éligibles (impr ÷ part)
  const searchRows = camps.filter((r) => num(r.metrics?.searchImpressionShare) !== null);
  const s = aggShare(searchRows);
  const sPrev = aggShare(campsPrev);
  const rows: ShareRow[] = camps.map((r) => {
    const k = K(r);
    return {
      name: String(r.campaign?.name ?? ""), impressionShare: num(r.metrics?.searchImpressionShare),
      lostBudget: num(r.metrics?.searchBudgetLostImpressionShare), lostRank: num(r.metrics?.searchRankLostImpressionShare),
      cost: k.cost, conv: k.conv,
    };
  });
  // une campagne peut apparaître plusieurs fois (types) : on fusionne par nom
  const byName = new Map<string, ShareRow>();
  rows.forEach((r) => { const p = byName.get(r.name); byName.set(r.name, p ? { ...p, cost: p.cost + r.cost, conv: p.conv + r.conv } : r); });

  // estimation obtenu / manqué : impressions manquées × taux de clic × taux de conversion Search
  const ctr = s.impr ? s.clicks / s.impr : 0, cvr = s.clicks ? s.conv / s.clicks : 0;
  const est = (impr: number): Missed => ({ impr, clicks: impr * ctr, conv: impr * ctr * cvr });

  // part d'impressions jour par jour
  const perDay = new Map<string, RawRow[]>();
  shareDays.forEach((r) => { const d = String(r.segments?.date ?? ""); perDay.set(d, [...(perDay.get(d) ?? []), r]); });
  const shareDaily: ShareDay[] = dates(range).map((date) => ({ date, ...aggShare(perDay.get(date) ?? []).agg }));

  // appareils
  const dev = new Map<string, DeviceRow>();
  devices.forEach((r) => {
    const key = String(r.segments?.device ?? "OTHER");
    if (key === "UNSPECIFIED" || key === "UNKNOWN") return;
    const k = K(r); const p = dev.get(key);
    dev.set(key, { device: key, label: DEVICES[key] ?? key, clicks: (p?.clicks ?? 0) + k.clicks, cost: (p?.cost ?? 0) + k.cost, conv: (p?.conv ?? 0) + k.conv, impressions: (p?.impressions ?? 0) + k.impressions });
  });

  const seenBudget = new Set<string>(); let dailyBudgets = 0;
  for (const b of budgets) {
    const rn = String(b.campaignBudget?.resourceName ?? "");
    if (!rn || seenBudget.has(rn)) continue;
    seenBudget.add(rn); dailyBudgets += Number(b.campaignBudget?.amountMicros ?? 0) / 1e6;
  }
  const spent = month.map(K).reduce(add, Z()).cost;
  const avgLast7 = last7.map(K).reduce(add, Z()).cost / 7;
  const daysElapsed = today.getUTCDate();
  // projection : dépensé jusqu'à hier + rythme des 7 derniers jours × jours restants (aujourd'hui inclus)
  const spentToYesterday = month.filter((r) => String(r.segments?.date ?? "") < iso(today)).map(K).reduce(add, Z()).cost;
  const projection = spentToYesterday + avgLast7 * (daysInMonth - daysElapsed + 1);

  const seriesCur = byDay(cur, range);
  const seriesPrev = byDay(prv, prev);

  return {
    range, prev,
    now: cur.map(K).reduce(add, Z()), before: prv.map(K).reduce(add, Z()),
    daily: seriesCur.map((d) => ({ date: d.date, cost: d.cost, conv: d.conv })),
    series: { cur: seriesCur, prev: seriesPrev },
    share: {
      impressionShare: s.agg.share, lostBudget: s.agg.lostBudget, lostRank: s.agg.lostRank,
      top: s.agg.top, absTop: s.agg.absTop,
      before: sPrev.agg,
      campaigns: [...byName.values()].filter((r) => r.impressionShare !== null).sort((a, b) => b.cost - a.cost).slice(0, 10),
      daily: shareDaily,
      got: s.elig ? { impr: s.impr, clicks: s.clicks, conv: s.conv } : null,
      missedBudget: s.elig ? est(s.lostB) : null,
      missedRank: s.elig ? est(s.lostR) : null,
    },
    devices: [...dev.values()].filter((d) => d.clicks + d.cost + d.impressions > 0).sort((a, b) => b.clicks - a.clicks),
    pacing: {
      month: iso(monthStart).slice(0, 7), spent, daysElapsed, daysInMonth, dailyBudgets, avgLast7,
      projection, target, googleCap: dailyBudgets * daysInMonth,
    },
    errors,
  };
}
