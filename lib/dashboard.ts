// Tableau de bord : chiffres de la période vs période précédente, part
// d'impressions (Search) et rythme de dépense du mois. Sans IA.
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
const between = (r: { since: string; until: string }) => `segments.date BETWEEN '${r.since}' AND '${r.until}'`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface ShareRow { name: string; impressionShare: number | null; lostBudget: number | null; lostRank: number | null; cost: number; conv: number }
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
  share: { impressionShare: number | null; lostBudget: number | null; lostRank: number | null; campaigns: ShareRow[] };
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

  const [cur, prv, camps, month, last7, budgets, target] = await Promise.all([
    safe("Chiffres", () => searchRaw(ctx, `SELECT segments.date, ${M} FROM customer WHERE ${between(range)}`), [] as RawRow[]),
    safe("Période précédente", () => searchRaw(ctx, `SELECT ${M} FROM customer WHERE ${between(prev)}`), [] as RawRow[]),
    safe("Part d'impressions", () => searchRaw(ctx, `SELECT campaign.name, campaign.advertising_channel_type, ${M},
        metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share
      FROM campaign WHERE ${between(range)} AND metrics.impressions > 0`), [] as RawRow[]),
    safe("Dépense du mois", () => searchRaw(ctx, `SELECT segments.date, ${M} FROM customer WHERE segments.date BETWEEN '${iso(monthStart)}' AND '${iso(today)}'`), [] as RawRow[]),
    safe("7 derniers jours", () => searchRaw(ctx, `SELECT ${M} FROM customer WHERE segments.date BETWEEN '${iso(w7)}' AND '${iso(y)}'`), [] as RawRow[]),
    safe("Budgets", () => searchRaw(ctx, `SELECT campaign_budget.resource_name, campaign_budget.amount_micros FROM campaign
      WHERE campaign.status = 'ENABLED' AND campaign.serving_status != 'ENDED'`), [] as RawRow[]),
    getMonthlyBudget(ctx.customerId).catch(() => null),
  ]);

  // part d'impressions Search, pondérée par les impressions éligibles (impr ÷ part)
  let elig = 0, impr = 0, lostB = 0, lostR = 0;
  const rows: ShareRow[] = [];
  for (const r of camps) {
    const k = K(r);
    const is = r.metrics?.searchImpressionShare;
    const lb = r.metrics?.searchBudgetLostImpressionShare, lr = r.metrics?.searchRankLostImpressionShare;
    const share = is === undefined || is === null ? null : Number(is);
    rows.push({ name: String(r.campaign?.name ?? ""), impressionShare: share, lostBudget: lb == null ? null : Number(lb), lostRank: lr == null ? null : Number(lr), cost: k.cost, conv: k.conv });
    if (share && share > 0 && k.impressions > 0) {
      const e = k.impressions / share;
      elig += e; impr += k.impressions;
      lostB += e * Number(lb ?? 0); lostR += e * Number(lr ?? 0);
    }
  }
  // une campagne peut apparaître plusieurs fois (types) : on fusionne par nom
  const byName = new Map<string, ShareRow>();
  rows.forEach((r) => { const p = byName.get(r.name); byName.set(r.name, p ? { ...p, cost: p.cost + r.cost, conv: p.conv + r.conv } : r); });

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

  const dailyMap = new Map<string, { cost: number; conv: number }>();
  cur.forEach((r) => {
    const d = String(r.segments?.date ?? ""); const k = K(r); const p = dailyMap.get(d) ?? { cost: 0, conv: 0 };
    dailyMap.set(d, { cost: p.cost + k.cost, conv: p.conv + k.conv });
  });

  return {
    range, prev,
    now: cur.map(K).reduce(add, Z()), before: prv.map(K).reduce(add, Z()),
    daily: [...dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v })),
    share: {
      impressionShare: elig ? impr / elig : null, lostBudget: elig ? lostB / elig : null, lostRank: elig ? lostR / elig : null,
      campaigns: [...byName.values()].filter((r) => r.impressionShare !== null).sort((a, b) => b.cost - a.cost).slice(0, 10),
    },
    pacing: {
      month: iso(monthStart).slice(0, 7), spent, daysElapsed, daysInMonth, dailyBudgets, avgLast7,
      projection, target, googleCap: dailyBudgets * daysInMonth,
    },
    errors,
  };
}
