// Prévisions avant campagne : idées de mots-clés (planificateur Google Ads),
// lieux, et estimation volume / coût / conversions selon le budget. Sans IA.
import { adsPost, searchRaw } from "@/lib/google-ads/client";

export const LANG_FR = "languageConstants/1002";

/** Pays proposés (id geoTargetConstant, code ISO pour la recherche de villes). */
export const COUNTRIES = [
  { id: "2250", code: "FR", label: "France" },
  { id: "2056", code: "BE", label: "Belgique" },
  { id: "2756", code: "CH", label: "Suisse" },
  { id: "2442", code: "LU", label: "Luxembourg" },
  { id: "2124", code: "CA", label: "Canada" },
];
export const LANGUAGES = [
  { id: "1002", label: "Français" },
  { id: "1000", label: "Anglais" },
  { id: "1001", label: "Allemand" },
  { id: "1004", label: "Italien" },
  { id: "1010", label: "Néerlandais" },
];

export interface Geo { id: string; name: string; type: string; canonical: string }
export interface Idea { text: string; searches: number; competition: string; low: number | null; high: number | null }

export async function suggestGeo(names: string[], countryCode = "FR"): Promise<Geo[]> {
  const clean = names.map((n) => n.trim()).filter(Boolean).slice(0, 5);
  if (!clean.length) return [];
  const j = await adsPost(null, "geoTargetConstants:suggest", { locale: "fr", countryCode, locationNames: { names: clean } });
  const out: Geo[] = [];
  const seen = new Set<string>();
  for (const s of (j.geoTargetConstantSuggestions ?? []) as { geoTargetConstant?: { id?: string; name?: string; targetType?: string; canonicalName?: string } }[]) {
    const g = s.geoTargetConstant; if (!g?.id || seen.has(String(g.id))) continue;
    seen.add(String(g.id));
    out.push({ id: String(g.id), name: g.name ?? "", type: g.targetType ?? "", canonical: g.canonicalName ?? "" });
  }
  return out;
}

export async function keywordIdeas(customerId: string, seeds: string[], geoIds: string[], url?: string, languageId = "1002"): Promise<Idea[]> {
  const keywords = seeds.map((s) => s.trim()).filter(Boolean).slice(0, 20);
  if (!keywords.length && !url) return [];
  const body: Record<string, unknown> = {
    language: `languageConstants/${languageId}`,
    geoTargetConstants: (geoIds.length ? geoIds : ["2250"]).map((g) => `geoTargetConstants/${g}`),
    includeAdultKeywords: false,
    keywordPlanNetwork: "GOOGLE_SEARCH",
    pageSize: 200,
  };
  if (url && keywords.length) body.keywordAndUrlSeed = { url, keywords };
  else if (url) body.urlSeed = { url };
  else body.keywordSeed = { keywords };
  const j = await adsPost({ customerId }, `customers/${customerId}:generateKeywordIdeas`, body);
  const m = (v: unknown) => (v === undefined || v === null ? null : Number(v) / 1e6);
  return ((j.results ?? []) as { text?: string; keywordIdeaMetrics?: Record<string, unknown> }[]).map((r) => ({
    text: r.text ?? "",
    searches: Number(r.keywordIdeaMetrics?.avgMonthlySearches ?? 0),
    competition: String(r.keywordIdeaMetrics?.competition ?? "UNSPECIFIED"),
    low: m(r.keywordIdeaMetrics?.lowTopOfPageBidMicros),
    high: m(r.keywordIdeaMetrics?.highTopOfPageBidMicros),
  })).filter((i) => i.text).sort((a, b) => b.searches - a.searches);
}

/** Taux de conversion du compte sur 90 jours (null si moins de 10 conversions). */
export async function accountCvr(customerId: string): Promise<{ cvr: number | null; conv: number; clicks: number }> {
  const rows = await searchRaw({ customerId }, `SELECT metrics.clicks, metrics.conversions FROM customer WHERE segments.date DURING LAST_90_DAYS`).catch(() => []);
  const clicks = rows.reduce((s, r) => s + Number(r.metrics?.clicks ?? 0), 0);
  const conv = rows.reduce((s, r) => s + Number(r.metrics?.conversions ?? 0), 0);
  return { cvr: conv >= 10 && clicks > 0 ? conv / clicks : null, conv, clicks };
}

export interface ForecastRow { daily: number; spend: number; clicks: number; conv: number; cpa: number | null; capped: boolean }
export interface Forecast { searches: number; cpc: number; maxClicks: number; maxSpend: number; ctr: number; cvr: number; cvrSource: string; rows: ForecastRow[] }

/**
 * Estimation volontairement simple et lisible :
 *  coût par clic = milieu de la fourchette « haut de page » pondéré par les recherches ;
 *  clics max = recherches × taux de clic supposé ; conversions = clics × taux de conversion.
 */
export function forecast(ideas: Idea[], budgets: number[], cvr: number | null, ctr = 0.06): Forecast {
  const searches = ideas.reduce((s, i) => s + i.searches, 0);
  let w = 0, sum = 0;
  for (const i of ideas) {
    const mid = i.low !== null && i.high !== null ? (i.low + i.high) / 2 : i.high ?? i.low;
    if (mid && i.searches > 0) { sum += mid * i.searches; w += i.searches; }
  }
  const cpc = w ? sum / w : 1.5;
  const rate = cvr ?? 0.05;
  const maxClicks = searches * ctr;
  const maxSpend = maxClicks * cpc;
  const rows = budgets.map((daily) => {
    const want = daily * 30.4;
    const spend = Math.min(want, maxSpend);
    const clicks = spend / cpc;
    const conv = clicks * rate;
    return { daily, spend, clicks, conv, cpa: conv > 0 ? spend / conv : null, capped: want > maxSpend };
  });
  return { searches, cpc, maxClicks, maxSpend, ctr, cvr: rate, cvrSource: cvr ? "taux du compte sur 90 jours" : "hypothèse de 5 % (moins de 10 conversions sur le compte)", rows };
}
