// Données d'un rapport client : tout est lu dans Google Ads au moment de
// l'affichage (le lien reste à jour). Aucune IA.
import { searchRaw, type AdsContext, type RawRow } from "@/lib/google-ads/client";
import { latestAuditReports } from "@/lib/audit/run";
import { readChanges, type ChangeLine } from "./changes";
import { previous, type Range } from "./periods";

export const SECTIONS: { key: string; label: string; hint: string }[] = [
  { key: "chiffres", label: "Chiffres clés", hint: "Investissement, conversions, CPA, clics, taux, vs période précédente" },
  { key: "courbes", label: "Courbes jour par jour", hint: "Dépense et conversions" },
  { key: "jour_par_jour", label: "Tableau jour par jour", hint: "Dépense, clics, conversions et CPA de chaque jour" },
  { key: "sante", label: "Santé et dépense mal placée", hint: "Note sur 100 et gaspillage prouvé" },
  { key: "types", label: "Répartition par type de campagne", hint: "Search, Performance Max, Demand Gen… : dépense, conversions, CPA" },
  { key: "campagnes", label: "Par campagne", hint: "Les 12 campagnes les plus dépensières, écart vs période précédente" },
  { key: "recherches", label: "Recherches qui ont converti", hint: "Ce que les gens ont tapé avant de convertir" },
  { key: "mots_cles", label: "Mots-clés qui portent les résultats", hint: "Les 8 mots-clés avec le plus de conversions" },
  { key: "fait", label: "Ce qui a été fait", hint: "Les modifications du compte sur la période (30 derniers jours max.)" },
  { key: "actions", label: "Prochaines actions", hint: "Les corrections recommandées par le diagnostic" },
];
export const ALL_SECTIONS = SECTIONS.map((s) => s.key);

export interface Totals { cost: number; clicks: number; impressions: number; conversions: number; value: number }
const ZERO: Totals = { cost: 0, clicks: 0, impressions: 0, conversions: 0, value: 0 };
const T = (r: RawRow): Totals => ({
  cost: Number(r.metrics?.costMicros ?? 0) / 1e6, clicks: Number(r.metrics?.clicks ?? 0),
  impressions: Number(r.metrics?.impressions ?? 0), conversions: Number(r.metrics?.conversions ?? 0),
  value: Number(r.metrics?.conversionsValue ?? 0),
});
const add = (a: Totals, b: Totals): Totals => ({ cost: a.cost + b.cost, clicks: a.clicks + b.clicks, impressions: a.impressions + b.impressions, conversions: a.conversions + b.conversions, value: a.value + b.value });
const sumBy = (rows: RawRow[], key: (r: RawRow) => string) => {
  const m = new Map<string, Totals>();
  rows.forEach((r) => m.set(key(r), add(m.get(key(r)) ?? ZERO, T(r))));
  return m;
};
const M = "metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value";
const between = (r: Range) => `segments.date BETWEEN '${r.since}' AND '${r.until}'`;

export interface ReportData {
  range: Range;
  prev: Range;
  now: Totals;
  before: Totals;
  daily: { date: string; t: Totals }[];
  types: { type: string; t: Totals }[];
  campaigns: { name: string; t: Totals; before: Totals }[];
  searches: { term: string; t: Totals }[];
  keywords: { text: string; t: Totals }[];
  health: { score: number; proven: number; watch: number; date: string } | null;
  actions: { title: string; action: string }[];
  changes: ChangeLine[];
  changesSince: string | null;
  errors: string[];
}

export async function buildReport(ctx: AdsContext, range: Range, sections: string[]): Promise<ReportData> {
  const prev = previous(range);
  const want = new Set(sections);
  const errors: string[] = [];
  const safe = async <X>(label: string, fn: () => Promise<X>, fb: X): Promise<X> => {
    try { return await fn(); } catch (e) { errors.push(`${label} : ${e instanceof Error ? e.message : String(e)}`); return fb; }
  };

  const [cur, prv, daily, camps, campsPrev, terms, kws, changes, audits] = await Promise.all([
    safe("Chiffres", () => searchRaw(ctx, `SELECT ${M} FROM customer WHERE ${between(range)}`), [] as RawRow[]),
    safe("Chiffres (période précédente)", () => searchRaw(ctx, `SELECT ${M} FROM customer WHERE ${between(prev)}`), [] as RawRow[]),
    want.has("courbes") || want.has("jour_par_jour")
      ? safe("Jour par jour", () => searchRaw(ctx, `SELECT segments.date, ${M} FROM customer WHERE ${between(range)}`), [] as RawRow[]) : Promise.resolve([] as RawRow[]),
    want.has("types") || want.has("campagnes")
      ? safe("Campagnes", () => searchRaw(ctx, `SELECT campaign.name, campaign.advertising_channel_type, ${M} FROM campaign WHERE ${between(range)} AND metrics.impressions > 0`), [] as RawRow[]) : Promise.resolve([] as RawRow[]),
    want.has("campagnes")
      ? safe("Campagnes (période précédente)", () => searchRaw(ctx, `SELECT campaign.name, ${M} FROM campaign WHERE ${between(prev)} AND metrics.impressions > 0`), [] as RawRow[]) : Promise.resolve([] as RawRow[]),
    want.has("recherches")
      ? safe("Recherches", () => searchRaw(ctx, `SELECT search_term_view.search_term, ${M} FROM search_term_view WHERE ${between(range)} AND metrics.conversions > 0`), [] as RawRow[]) : Promise.resolve([] as RawRow[]),
    want.has("mots_cles")
      ? safe("Mots-clés", () => searchRaw(ctx, `SELECT ad_group_criterion.keyword.text, ${M} FROM keyword_view WHERE ${between(range)} AND metrics.conversions > 0`), [] as RawRow[]) : Promise.resolve([] as RawRow[]),
    want.has("fait")
      ? safe("Journal des modifications", () => readChanges(ctx, range.since, range.until), { lines: [] as ChangeLine[], clampedSince: range.since }) : Promise.resolve({ lines: [] as ChangeLine[], clampedSince: range.since }),
    want.has("sante") || want.has("actions") ? safe("Diagnostic", () => latestAuditReports(), []) : Promise.resolve([]),
  ]);

  const total = (rows: RawRow[]) => rows.reduce<Totals>((a, r) => add(a, T(r)), ZERO);
  const campPrev = sumBy(campsPrev, (r) => r.campaign?.name ?? "");
  const audit = audits.find((a) => a.customer_id === ctx.customerId) ?? null;

  return {
    range, prev,
    now: total(cur), before: total(prv),
    daily: [...sumBy(daily, (r) => r.segments?.date ?? "").entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, t]) => ({ date, t })),
    types: [...sumBy(camps, (r) => r.campaign?.advertisingChannelType ?? "").entries()].map(([type, t]) => ({ type, t })).sort((a, b) => b.t.cost - a.t.cost),
    campaigns: [...sumBy(camps, (r) => r.campaign?.name ?? "").entries()].map(([name, t]) => ({ name, t, before: campPrev.get(name) ?? ZERO })).sort((a, b) => b.t.cost - a.t.cost).slice(0, 12),
    searches: [...sumBy(terms, (r) => r.searchTermView?.searchTerm ?? "").entries()].map(([term, t]) => ({ term, t })).sort((a, b) => b.t.conversions - a.t.conversions).slice(0, 15),
    keywords: [...sumBy(kws, (r) => r.adGroupCriterion?.keyword?.text ?? "").entries()].map(([text, t]) => ({ text, t })).sort((a, b) => b.t.conversions - a.t.conversions).slice(0, 8),
    health: audit ? { score: audit.health_score, proven: Number(audit.waste_proven), watch: Number(audit.waste_watch), date: audit.run_date } : null,
    actions: audit ? audit.constats.filter((c) => c.severity !== "mineur").slice(0, 5).map((c) => ({ title: c.title, action: c.action })) : [],
    changes: changes.lines,
    changesSince: want.has("fait") ? changes.clampedSince : null,
    errors,
  };
}
