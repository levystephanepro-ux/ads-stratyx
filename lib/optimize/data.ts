// Données des pages « Optimiser » et « Analyser » (modèle Ades) : lecture seule,
// sans IA. Chaque fonction lit la période demandée ET la période précédente de même
// durée, pour les comparaisons « vs période précédente ». En mode mock : données de
// démonstration (compte de menuiserie) pour développer sans Google Ads.
import { isLive } from "@/lib/google-ads/config";
import { searchRaw, type AdsContext, type RawRow } from "@/lib/google-ads/client";
import * as M from "./mock";

const micros = (v: unknown) => Number(v ?? 0) / 1_000_000;
const num = (v: unknown) => Number(v ?? 0);
const iso = (d: Date) => d.toISOString().slice(0, 10);

// ── Période ───────────────────────────────────────────────────────────────

export const PERIODS = ["7", "14", "30", "90", "mois"] as const;
export type PeriodKey = (typeof PERIODS)[number];
/** @deprecated garder pour compatibilité */
export type Days = number;

export interface Period {
  key: PeriodKey;
  /** Nombre de jours de la période. */
  days: number;
  since: string;
  until: string;
  prevSince: string;
  prevUntil: string;
  /** Libellé lisible, ex. « 7 derniers jours » ou « ce mois-ci ». */
  label: string;
}

const frShort = (isoDate: string) => new Date(isoDate + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Période jusqu'à hier (la journée en cours est incomplète), comme « N derniers jours » dans Google Ads. */
export function period(key: PeriodKey | number = "7"): Period {
  const k = String(key) as PeriodKey;
  const until = new Date();
  until.setUTCDate(until.getUTCDate() - 1);
  let since: Date;
  if (k === "mois") {
    // du 1er du mois à hier (le 1er : tout le mois précédent)
    since = new Date(Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), 1));
  } else {
    since = new Date(until);
    since.setUTCDate(since.getUTCDate() - (Number(k) - 1));
  }
  const days = Math.round((until.getTime() - since.getTime()) / 864e5) + 1;
  const prevUntil = new Date(since);
  prevUntil.setUTCDate(prevUntil.getUTCDate() - 1);
  const prevSince = new Date(prevUntil);
  prevSince.setUTCDate(prevSince.getUTCDate() - (days - 1));
  const label = k === "mois" ? `ce mois-ci (${frShort(iso(since))} → ${frShort(iso(until))})` : `${days} derniers jours`;
  return { key: k, days, since: iso(since), until: iso(until), prevSince: iso(prevSince), prevUntil: iso(prevUntil), label };
}

const between = (a: string, b: string) => `segments.date BETWEEN '${a}' AND '${b}'`;
const campFilter = (campaignId: string | null) => (campaignId && /^\d+$/.test(campaignId) ? ` AND campaign.id = ${campaignId}` : "");

// ── Campagnes ─────────────────────────────────────────────────────────────

export interface CampaignLite {
  id: string;
  name: string;
  status: "ENABLED" | "PAUSED" | string;
  channel: string;
  dailyBudget: number;
  bidding: string;
}

export async function listCampaignsLite(ctx: AdsContext): Promise<CampaignLite[]> {
  if (!isLive()) return M.CAMPAIGNS;
  const rows = await searchRaw(ctx, `
    SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
           campaign.bidding_strategy_type, campaign_budget.amount_micros
    FROM campaign WHERE campaign.status != 'REMOVED'`);
  return rows
    .map((r) => ({
      id: String(r.campaign?.id ?? ""),
      name: r.campaign?.name ?? "",
      status: r.campaign?.status ?? "",
      channel: r.campaign?.advertisingChannelType ?? "",
      dailyBudget: micros(r.campaignBudget?.amountMicros),
      bidding: r.campaign?.biddingStrategyType ?? "",
    }))
    .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "ENABLED" ? -1 : 1));
}

// ── Mots-clés ─────────────────────────────────────────────────────────────

export interface Metrics {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  value: number;
}
export const zero = (): Metrics => ({ impressions: 0, clicks: 0, cost: 0, conversions: 0, value: 0 });
export function addInto(a: Metrics, b: Metrics) {
  a.impressions += b.impressions; a.clicks += b.clicks; a.cost += b.cost; a.conversions += b.conversions; a.value += b.value;
}
const readMetrics = (r: RawRow): Metrics => ({
  impressions: num(r.metrics?.impressions),
  clicks: num(r.metrics?.clicks),
  cost: micros(r.metrics?.costMicros),
  conversions: num(r.metrics?.conversions),
  value: num(r.metrics?.conversionsValue),
});

export type QualityLevel = "faible" | "moyen" | "bon" | null;
const QL: Record<string, QualityLevel> = { BELOW_AVERAGE: "faible", AVERAGE: "moyen", ABOVE_AVERAGE: "bon" };

export interface KeywordRow {
  key: string;
  campaignId: string;
  campaign: string;
  adGroupId: string;
  adGroup: string;
  criterionId: string;
  text: string;
  matchType: "EXACT" | "PHRASE" | "BROAD" | string;
  status: string;
  qs: number | null;
  ctrQ: QualityLevel;
  adQ: QualityLevel;
  lpQ: QualityLevel;
  firstPageCpc: number | null;
  topPageCpc: number | null;
  cur: Metrics;
  prev: Metrics;
}

export async function keywordReport(ctx: AdsContext, p: Period, campaignId: string | null): Promise<KeywordRow[]> {
  if (!isLive()) return M.keywords(campaignId);
  const cf = campFilter(campaignId);
  const [defs, cur, prev] = await Promise.all([
    searchRaw(ctx, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_criterion.criterion_id,
             ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status,
             ad_group_criterion.quality_info.quality_score, ad_group_criterion.quality_info.creative_quality_score,
             ad_group_criterion.quality_info.post_click_quality_score, ad_group_criterion.quality_info.search_predicted_ctr,
             ad_group_criterion.position_estimates.first_page_cpc_micros, ad_group_criterion.position_estimates.top_of_page_cpc_micros
      FROM ad_group_criterion
      WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE
        AND ad_group_criterion.status != 'REMOVED' AND ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'${cf}`),
    searchRaw(ctx, `
      SELECT ad_group.id, ad_group_criterion.criterion_id, metrics.impressions, metrics.clicks, metrics.cost_micros,
             metrics.conversions, metrics.conversions_value
      FROM keyword_view WHERE ${between(p.since, p.until)}${cf}`),
    searchRaw(ctx, `
      SELECT ad_group.id, ad_group_criterion.criterion_id, metrics.impressions, metrics.clicks, metrics.cost_micros,
             metrics.conversions, metrics.conversions_value
      FROM keyword_view WHERE ${between(p.prevSince, p.prevUntil)}${cf}`),
  ]);
  const idx = (rows: RawRow[]) => {
    const m = new Map<string, Metrics>();
    for (const r of rows) {
      const k = `${r.adGroup?.id}~${r.adGroupCriterion?.criterionId}`;
      const acc = m.get(k) ?? zero();
      addInto(acc, readMetrics(r));
      m.set(k, acc);
    }
    return m;
  };
  const c = idx(cur), pr = idx(prev);
  return defs.map((r) => {
    const k = `${r.adGroup?.id}~${r.adGroupCriterion?.criterionId}`;
    const qi = r.adGroupCriterion?.qualityInfo ?? {};
    const pe = r.adGroupCriterion?.positionEstimates ?? {};
    return {
      key: k,
      campaignId: String(r.campaign?.id ?? ""),
      campaign: r.campaign?.name ?? "",
      adGroupId: String(r.adGroup?.id ?? ""),
      adGroup: r.adGroup?.name ?? "",
      criterionId: String(r.adGroupCriterion?.criterionId ?? ""),
      text: r.adGroupCriterion?.keyword?.text ?? "",
      matchType: r.adGroupCriterion?.keyword?.matchType ?? "",
      status: r.adGroupCriterion?.status ?? "",
      qs: qi.qualityScore ? Number(qi.qualityScore) : null,
      ctrQ: QL[qi.searchPredictedCtr] ?? null,
      adQ: QL[qi.creativeQualityScore] ?? null,
      lpQ: QL[qi.postClickQualityScore] ?? null,
      firstPageCpc: pe.firstPageCpcMicros ? micros(pe.firstPageCpcMicros) : null,
      topPageCpc: pe.topOfPageCpcMicros ? micros(pe.topOfPageCpcMicros) : null,
      cur: c.get(k) ?? zero(),
      prev: pr.get(k) ?? zero(),
    };
  });
}

// ── Termes de recherche ───────────────────────────────────────────────────

export interface TermRow {
  term: string;
  campaignId: string;
  campaign: string;
  adGroupId: string;
  adGroup: string;
  /** ADDED (ajouté en mot-clé), EXCLUDED, ADDED_EXCLUDED, NONE */
  status: string;
  cur: Metrics;
  prev: Metrics;
}

export async function termReport(ctx: AdsContext, p: Period, campaignId: string | null): Promise<TermRow[]> {
  if (!isLive()) return M.terms(campaignId);
  const cf = campFilter(campaignId);
  const q = (a: string, b: string) => searchRaw(ctx, `
    SELECT search_term_view.search_term, search_term_view.status, campaign.id, campaign.name, ad_group.id, ad_group.name,
           metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value
    FROM search_term_view
    WHERE ${between(a, b)} AND campaign.status != 'REMOVED' AND metrics.impressions > 0${cf}`);
  const [cur, prev] = await Promise.all([q(p.since, p.until), q(p.prevSince, p.prevUntil)]);
  const out = new Map<string, TermRow>();
  const key = (r: RawRow) => `${r.adGroup?.id}~${(r.searchTermView?.searchTerm ?? "").toLowerCase()}`;
  for (const r of cur) {
    const k = key(r);
    const row = out.get(k) ?? {
      term: r.searchTermView?.searchTerm ?? "",
      campaignId: String(r.campaign?.id ?? ""),
      campaign: r.campaign?.name ?? "",
      adGroupId: String(r.adGroup?.id ?? ""),
      adGroup: r.adGroup?.name ?? "",
      status: r.searchTermView?.status ?? "NONE",
      cur: zero(),
      prev: zero(),
    };
    addInto(row.cur, readMetrics(r));
    out.set(k, row);
  }
  for (const r of prev) {
    const row = out.get(key(r));
    if (row) addInto(row.prev, readMetrics(r));
  }
  return [...out.values()];
}

/** Termes sur 12 mois (pour « Bloquées » : ce qu'ont coûté les recherches avant exclusion). */
export async function termHistory(ctx: AdsContext, campaignId: string | null): Promise<{ term: string; campaignId: string; m: Metrics }[]> {
  if (!isLive()) return M.termHistory();
  const until = new Date(); until.setUTCDate(until.getUTCDate() - 1);
  const since = new Date(until); since.setUTCDate(since.getUTCDate() - 364);
  const rows = await searchRaw(ctx, `
    SELECT search_term_view.search_term, campaign.id, metrics.impressions, metrics.clicks, metrics.cost_micros,
           metrics.conversions, metrics.conversions_value
    FROM search_term_view
    WHERE ${between(iso(since), iso(until))} AND campaign.status != 'REMOVED' AND metrics.clicks > 0${campFilter(campaignId)}`);
  const map = new Map<string, { term: string; campaignId: string; m: Metrics }>();
  for (const r of rows) {
    const term = r.searchTermView?.searchTerm ?? "";
    const k = `${r.campaign?.id}~${term.toLowerCase()}`;
    const e = map.get(k) ?? { term, campaignId: String(r.campaign?.id ?? ""), m: zero() };
    addInto(e.m, readMetrics(r));
    map.set(k, e);
  }
  return [...map.values()];
}

export interface NegativeRow {
  level: "campaign" | "ad_group" | "shared";
  campaignId: string;
  campaign: string;
  adGroupId?: string;
  adGroup?: string;
  sharedSet?: string;
  text: string;
  matchType: string;
}

export async function listNegatives(ctx: AdsContext, campaignId: string | null): Promise<NegativeRow[]> {
  if (!isLive()) return M.NEGATIVES;
  const cf = campFilter(campaignId);
  const [camp, ag, links, shared] = await Promise.all([
    searchRaw(ctx, `
      SELECT campaign.id, campaign.name, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
      FROM campaign_criterion
      WHERE campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE AND campaign.status != 'REMOVED'${cf}`).catch(() => [] as RawRow[]),
    searchRaw(ctx, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type
      FROM ad_group_criterion
      WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = TRUE
        AND ad_group_criterion.status != 'REMOVED' AND campaign.status != 'REMOVED'${cf}`).catch(() => [] as RawRow[]),
    searchRaw(ctx, `
      SELECT campaign.id, campaign.name, shared_set.id, shared_set.name
      FROM campaign_shared_set
      WHERE campaign_shared_set.status = 'ENABLED' AND shared_set.type = 'NEGATIVE_KEYWORDS' AND campaign.status != 'REMOVED'${cf}`).catch(() => [] as RawRow[]),
    searchRaw(ctx, `
      SELECT shared_set.id, shared_criterion.keyword.text, shared_criterion.keyword.match_type
      FROM shared_criterion WHERE shared_criterion.type = 'KEYWORD'`).catch(() => [] as RawRow[]),
  ]);
  const out: NegativeRow[] = [];
  for (const r of camp) out.push({ level: "campaign", campaignId: String(r.campaign?.id), campaign: r.campaign?.name ?? "", text: r.campaignCriterion?.keyword?.text ?? "", matchType: r.campaignCriterion?.keyword?.matchType ?? "" });
  for (const r of ag) out.push({ level: "ad_group", campaignId: String(r.campaign?.id), campaign: r.campaign?.name ?? "", adGroupId: String(r.adGroup?.id), adGroup: r.adGroup?.name ?? "", text: r.adGroupCriterion?.keyword?.text ?? "", matchType: r.adGroupCriterion?.keyword?.matchType ?? "" });
  const bySet = new Map<string, RawRow[]>();
  for (const r of shared) {
    const id = String(r.sharedSet?.id);
    bySet.set(id, [...(bySet.get(id) ?? []), r]);
  }
  for (const l of links) {
    for (const r of bySet.get(String(l.sharedSet?.id)) ?? []) {
      out.push({ level: "shared", campaignId: String(l.campaign?.id), campaign: l.campaign?.name ?? "", sharedSet: l.sharedSet?.name ?? "", text: r.sharedCriterion?.keyword?.text ?? "", matchType: r.sharedCriterion?.keyword?.matchType ?? "" });
    }
  }
  return out;
}

// ── Campagnes : métriques, parts d'impressions, jours ─────────────────────

export interface CampaignPerf {
  id: string;
  name: string;
  cur: Metrics & { is: number | null; lostBudget: number | null; lostRank: number | null; top: number | null; absTop: number | null; eligible: number };
  prev: Metrics & { is: number | null; lostBudget: number | null; lostRank: number | null; top: number | null; absTop: number | null; eligible: number };
}

export async function campaignPerf(ctx: AdsContext, p: Period, campaignId: string | null): Promise<CampaignPerf[]> {
  if (!isLive()) return M.campaignPerf(campaignId);
  const cf = campFilter(campaignId);
  const q = (a: string, b: string) => searchRaw(ctx, `
    SELECT campaign.id, campaign.name, campaign.advertising_channel_type, metrics.impressions, metrics.clicks, metrics.cost_micros,
           metrics.conversions, metrics.conversions_value, metrics.search_impression_share,
           metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share,
           metrics.search_top_impression_share, metrics.search_absolute_top_impression_share
    FROM campaign WHERE ${between(a, b)} AND campaign.status != 'REMOVED'${cf}`);
  const [cur, prev] = await Promise.all([q(p.since, p.until), q(p.prevSince, p.prevUntil)]);
  const read = (r: RawRow | undefined) => {
    const m = r ? readMetrics(r) : zero();
    const sh = (v: unknown) => (v === undefined || v === null ? null : Number(v));
    const is = r ? sh(r.metrics?.searchImpressionShare) : null;
    return {
      ...m,
      is,
      lostBudget: r ? sh(r.metrics?.searchBudgetLostImpressionShare) : null,
      lostRank: r ? sh(r.metrics?.searchRankLostImpressionShare) : null,
      top: r ? sh(r.metrics?.searchTopImpressionShare) : null,
      absTop: r ? sh(r.metrics?.searchAbsoluteTopImpressionShare) : null,
      // impressions possibles = impressions / part d'impressions
      eligible: is && is > 0 ? m.impressions / is : m.impressions,
    };
  };
  const pm = new Map(prev.map((r) => [String(r.campaign?.id), r]));
  return cur.map((r) => ({
    id: String(r.campaign?.id),
    name: r.campaign?.name ?? "",
    cur: read(r),
    prev: read(pm.get(String(r.campaign?.id))),
  }));
}

export interface DayRow { date: string; campaignId: string; cost: number; clicks: number; impressions: number; conversions: number; lostBudget: number | null; lostRank: number | null; is: number | null }

/** Lignes campagne × jour entre deux dates. */
export async function dailyByCampaign(ctx: AdsContext, since: string, until: string, campaignId: string | null): Promise<DayRow[]> {
  if (!isLive()) return M.daily(since, until, campaignId);
  const rows = await searchRaw(ctx, `
    SELECT segments.date, campaign.id, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions,
           metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share
    FROM campaign WHERE ${between(since, until)} AND campaign.status != 'REMOVED'${campFilter(campaignId)}`);
  const sh = (v: unknown) => (v === undefined || v === null ? null : Number(v));
  return rows.map((r) => ({
    date: r.segments?.date ?? "",
    campaignId: String(r.campaign?.id),
    cost: micros(r.metrics?.costMicros),
    clicks: num(r.metrics?.clicks),
    impressions: num(r.metrics?.impressions),
    conversions: num(r.metrics?.conversions),
    is: sh(r.metrics?.searchImpressionShare),
    lostBudget: sh(r.metrics?.searchBudgetLostImpressionShare),
    lostRank: sh(r.metrics?.searchRankLostImpressionShare),
  }));
}

// ── Utilitaires d'affichage ───────────────────────────────────────────────

export const eur = (n: number, digits = 2) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} €`;
export const pct = (n: number | null, digits = 2) =>
  n === null || !isFinite(n) ? "–" : `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
export const int = (n: number) => Math.round(n).toLocaleString("fr-FR");
export const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
/** Variation relative cur vs prev (null si pas de base). */
export const delta = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : null);
export const fmtKw = (t: string, m: string) => (m === "EXACT" ? `[${t}]` : m === "PHRASE" ? `"${t}"` : t);
export const MATCH_LABEL: Record<string, string> = { EXACT: "Exact", PHRASE: "Expression", BROAD: "Large" };
