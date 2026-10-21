// Audit complet noté sur 100 (modèle Ades) : évalue la grille AUDIT_GRID sur les
// données du compte. Chaque critère sort en Parfait / À vérifier / Incorrect, ou
// « à cocher » quand l'API ne permet pas de conclure (jamais inventé). Sans IA.
import { isLive } from "@/lib/google-ads/config";
import { searchRaw, type AdsContext, type RawRow } from "@/lib/google-ads/client";
import { getSetting, setSetting } from "@/lib/agent/store";
import { AUDIT_GRID, type AccountTag, type Criterion } from "./criteria";
import { keywordReport, termReport, listNegatives, campaignPerf, period, type KeywordRow, type TermRow, type NegativeRow, type CampaignPerf, type CampaignLite, listCampaignsLite } from "@/lib/optimize/data";
import { classify, ngrams } from "@/lib/optimize/intents";
import { negativeBlocks, normKw } from "./negatives";

export type ScanStatus = "ok" | "warn" | "bad" | "manual" | "na";
export interface ScanItem { id: string; status: ScanStatus; detail: string }
export interface ScanResult {
  at: string;
  model: Model;
  score: number;
  counts: Record<ScanStatus, number>;
  items: ScanItem[];
  skipped: string[];
}
export type Model = "complet" | "leads" | "local" | "ecommerce";
export const MODELS: Record<Model, string> = { complet: "Audit complet", leads: "Génération de leads", local: "Artisan local", ecommerce: "E-commerce" };

export const critId = (catKey: string, i: number) => `${catKey}.${i}`;

/** Critères du modèle (filtrés par type de compte), moins ceux désactivés. */
export function activeCriteria(model: Model, off: Set<string>) {
  const ok: AccountTag[] | null = model === "complet" ? null : model === "local" ? ["local", "leads"] : [model];
  return AUDIT_GRID.map((c) => ({
    ...c,
    items: c.items
      .map((it, i) => ({ ...it, id: critId(c.key, i) }))
      .filter((it) => (!ok || !it.tags || it.tags.some((t) => ok.includes(t))) && !off.has(it.id)),
  }));
}

// ── Réglages : critères désactivés, historique ────────────────────────────

const OFF_KEY = "audit_criteria_off";
const scansKey = (customerId: string) => `audit_scans:${customerId}`;

export async function readOff(): Promise<Set<string>> {
  try { return new Set(JSON.parse((await getSetting(OFF_KEY)) ?? "[]") as string[]); } catch { return new Set(); }
}
export async function saveOff(ids: string[]) { await setSetting(OFF_KEY, JSON.stringify(ids)); }

export async function readScans(customerId: string): Promise<ScanResult[]> {
  try { return JSON.parse((await getSetting(scansKey(customerId))) ?? "[]") as ScanResult[]; } catch { return []; }
}
export async function saveScan(customerId: string, r: ScanResult) {
  const prev = await readScans(customerId);
  await setSetting(scansKey(customerId), JSON.stringify([r, ...prev].slice(0, 6)));
}

// ── Données ───────────────────────────────────────────────────────────────

interface ConvAction { name: string; category: string; primary: boolean; counting: string; type: string; model: string; viewDays: number | null; origin: string }
interface AdRow { adGroupId: string; campaignId: string; status: string; strength: string; approval: string; type: string; headlines: number; descriptions: number; pinned: number; text: string; urls: string[] }
interface AssetRow { field: string; approval: string; level: "campagne" | "compte"; campaignId?: string }

export interface ScanData {
  autoTagging: boolean | null;
  optimizationScore: number | null;
  campaigns: CampaignLite[];
  settings: Map<string, { search: boolean; content: boolean; partners: boolean; geo: string; targetCpa: number | null }>;
  perf30: CampaignPerf[];
  kws: KeywordRow[];
  terms: TermRow[];
  negatives: NegativeRow[];
  sharedLinked: Set<string>;
  conversions: ConvAction[] | null;
  ads: AdRow[] | null;
  adGroups: { id: string; campaignId: string; name: string }[] | null;
  assets: AssetRow[] | null;
  daily: { date: string; cost: number; clicks?: number }[];
  lastChangeDays: number | null;
  autoApply: string[] | null;
  locations: Set<string> | null;
  schedules: Set<string> | null;
  devices: { device: string; cost: number; conv: number }[] | null;
  pages: { url: string; cost: number; clicks: number; conv: number }[] | null;
  /** Mots-clés refusés par Google (statut d'approbation). */
  disapprovedKws: { text: string; campaign: string }[] | null;
  /** Niveau de qualité des mots-clés actifs, avec leur dépense sur 30 jours. */
  qualityScores: { text: string; qs: number; cost: number }[] | null;
  /** Statut principal des campagnes (apprentissage, limitée par le budget…). */
  campaignStatus: { id: string; name: string; status: string; reasons: string[] }[] | null;
  /** Réponse HTTP des adresses de destination des annonces. */
  urlChecks: { url: string; code: number | null }[] | null;
  enhancedConversions: boolean | null;
  /** Score PageSpeed mobile des pages qui reçoivent le plus de dépense. */
  speed: { url: string; score: number; lcp: number | null }[] | null;
  accountName: string | null;
  /** Plafond de CPC des campagnes « maximiser les clics ». */
  cpcCeilings: { name: string; bidding: string; ceiling: number | null }[] | null;
  /** Dépense par tranche d'âge (30 jours). */
  ages: { range: string; cost: number }[] | null;
  /** Audiences attachées aux groupes Search. */
  audiences: { adGroupId: string }[] | null;
  /** Groupes Search dont l'audience est en ciblage (et non en observation). */
  audienceTargeting: { adGroupId: string; bidOnly: boolean }[] | null;
  /** Création automatique de composants (texte, images) par campagne. */
  assetAutomation: { campaign: string; types: string[] }[] | null;
  /** Listes de clients (Customer Match) : nom, taille. */
  crmLists: { name: string; size: number }[] | null;
  /** Exclusions d'audiences (clients, visiteurs) posées sur des campagnes ou groupes. */
  audienceExclusions: number | null;
  /** Langues ciblées par campagne (codes Google : 1002 = français). */
  languages: { campaign: string; ids: string[] }[] | null;
  /** AI Max activé par campagne. */
  aiMax: { campaign: string; on: boolean }[] | null;
  /** Objectifs de conversion qui pilotent l'enchère, par campagne. */
  goals: { campaign: string; categories: string[] }[] | null;
  /** Composants d'annonces notés « Faible » par Google. */
  lowAssets: number | null;
  valueRules: number | null;
}

const micros = (v: unknown) => Number(v ?? 0) / 1_000_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** PageSpeed Insights (mobile) : score de performance 0-100 et LCP en secondes. Clé facultative : PAGESPEED_API_KEY. */
async function pageSpeed(urls: string[]): Promise<{ url: string; score: number; lcp: number | null }[] | null> {
  const key = process.env.PAGESPEED_API_KEY;
  const out = await Promise.all(urls.map(async (url) => {
    try {
      const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance${key ? `&key=${key}` : ""}`;
      const res = await fetch(api, { signal: AbortSignal.timeout(70000) });
      if (!res.ok) throw new Error(`PageSpeed ${res.status}`);
      const j = (await res.json()) as { lighthouseResult?: { categories?: { performance?: { score?: number | null } }; audits?: Record<string, { numericValue?: number }> } };
      const sc = j.lighthouseResult?.categories?.performance?.score;
      if (typeof sc !== "number") return null;
      const lcp = j.lighthouseResult?.audits?.["largest-contentful-paint"]?.numericValue;
      return { url, score: Math.round(sc * 100), lcp: typeof lcp === "number" ? lcp / 1000 : null };
    } catch { return null; }
  }));
  const ok = out.filter((x): x is { url: string; score: number; lcp: number | null } => x !== null);
  if (!ok.length) throw new Error("PageSpeed sans réponse");
  return ok;
}

/** Ouvre chaque adresse (12 s max, redirections suivies) : code HTTP, ou null si injoignable. */
async function checkUrls(urls: string[]): Promise<{ url: string; code: number | null }[]> {
  return Promise.all(urls.map(async (url) => {
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) return { url, code: null };
      const res = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(12000), headers: { "user-agent": "Mozilla/5.0 (compatible; StratyxAudit/1.0)" } });
      return { url, code: res.status };
    } catch { return { url, code: null }; }
  }));
}

export async function fetchScanData(ctx: AdsContext): Promise<{ data: ScanData; skipped: string[] }> {
  const skipped: string[] = [];
  const p30 = period(30);
  const q = async <T>(label: string, fn: () => Promise<T>, fb: T): Promise<T> => {
    try { return await fn(); } catch (e) { skipped.push(`${label} (${(e instanceof Error ? e.message : String(e)).slice(0, 80)})`); return fb; }
  };
  const live = isLive();
  const [campaigns, perf, kws, terms, negatives] = await Promise.all([
    q("Campagnes", () => listCampaignsLite(ctx), [] as CampaignLite[]),
    q("Performances", () => campaignPerf(ctx, p30, null), [] as CampaignPerf[]),
    q("Mots-clés", () => keywordReport(ctx, p30, null), [] as KeywordRow[]),
    q("Termes", () => termReport(ctx, period(90), null), [] as TermRow[]),
    q("Négatifs", () => listNegatives(ctx, null), [] as NegativeRow[]),
  ]);
  const perf30 = perf;

  if (!live) return { data: mockScan(campaigns, perf30, kws, terms, negatives), skipped };

  const since30 = p30.since, until = p30.until;
  const d14 = new Date(); d14.setUTCDate(d14.getUTCDate() - 29);
  const [cust, sett, conv, ads, ags, campAssets, custAssets, daily, change, autoApply, loc, sched, dev, pages, shared, disKw, qsRows, campSt, ceil, ageRows, audRows, audTgt, autoAsset, crm, audEx, langs, aimax, goalRows, lowAs, vrules] = await Promise.all([
    q("Compte", () => searchRaw(ctx, `SELECT customer.descriptive_name, customer.auto_tagging_enabled, customer.optimization_score, customer.conversion_tracking_setting.enhanced_conversions_for_leads_enabled FROM customer`), [] as RawRow[]),
    q("Réglages des campagnes", () => searchRaw(ctx, `
      SELECT campaign.id, campaign.network_settings.target_google_search, campaign.network_settings.target_search_network,
             campaign.network_settings.target_content_network, campaign.geo_target_type_setting.positive_geo_target_type,
             campaign.target_cpa.target_cpa_micros, campaign.maximize_conversions.target_cpa_micros
      FROM campaign WHERE campaign.status = 'ENABLED'`), [] as RawRow[]),
    q("Actions de conversion", () => searchRaw(ctx, `
      SELECT conversion_action.name, conversion_action.category, conversion_action.primary_for_goal, conversion_action.counting_type,
             conversion_action.type, conversion_action.origin, conversion_action.attribution_model_settings.attribution_model,
             conversion_action.view_through_lookback_window_days
      FROM conversion_action WHERE conversion_action.status = 'ENABLED'`), null as RawRow[] | null),
    q("Annonces", () => searchRaw(ctx, `
      SELECT ad_group.id, campaign.id, ad_group_ad.status, ad_group_ad.ad_strength, ad_group_ad.policy_summary.approval_status,
             ad_group_ad.ad.type, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines,
             ad_group_ad.ad.responsive_search_ad.descriptions
      FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED' AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'`), null as RawRow[] | null),
    q("Groupes d'annonces", () => searchRaw(ctx, `SELECT ad_group.id, ad_group.name, campaign.id FROM ad_group WHERE ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'`), null as RawRow[] | null),
    q("Composants de campagne", () => searchRaw(ctx, `SELECT campaign.id, campaign.name, campaign_asset.asset, campaign_asset.campaign, campaign_asset.field_type, asset.policy_summary.approval_status FROM campaign_asset WHERE campaign.status = 'ENABLED' AND campaign_asset.status = 'ENABLED'`), null as RawRow[] | null),
    q("Composants du compte", () => searchRaw(ctx, `SELECT customer_asset.asset, customer_asset.field_type, asset.policy_summary.approval_status FROM customer_asset WHERE customer_asset.status = 'ENABLED'`), null as RawRow[] | null),
    q("Dépense par jour", () => searchRaw(ctx, `SELECT segments.date, metrics.cost_micros, metrics.clicks FROM customer WHERE segments.date BETWEEN '${since30}' AND '${until}'`), [] as RawRow[]),
    q("Historique des modifications", () => searchRaw(ctx, `
      SELECT change_event.change_date_time FROM change_event
      WHERE change_event.change_date_time >= '${iso(d14)}' AND change_event.change_date_time <= '${iso(new Date())} 23:59:59' ORDER BY change_event.change_date_time DESC LIMIT 1`), null as RawRow[] | null),
    q("Application automatique", () => searchRaw(ctx, `SELECT recommendation_subscription.type, recommendation_subscription.status FROM recommendation_subscription`), null as RawRow[] | null),
    q("Zones", () => searchRaw(ctx, `SELECT campaign.id FROM campaign_criterion WHERE campaign_criterion.type IN ('LOCATION', 'PROXIMITY') AND campaign_criterion.negative = FALSE AND campaign.status = 'ENABLED'`), null as RawRow[] | null),
    q("Calendrier", () => searchRaw(ctx, `SELECT campaign.id FROM campaign_criterion WHERE campaign_criterion.type = 'AD_SCHEDULE' AND campaign.status = 'ENABLED'`), null as RawRow[] | null),
    q("Appareils", () => searchRaw(ctx, `SELECT segments.device, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${since30}' AND '${until}' AND campaign.status = 'ENABLED'`), null as RawRow[] | null),
    q("Pages de destination", () => searchRaw(ctx, `SELECT landing_page_view.unexpanded_final_url, metrics.cost_micros, metrics.clicks, metrics.conversions FROM landing_page_view WHERE segments.date BETWEEN '${since30}' AND '${until}'`), null as RawRow[] | null),
    q("Listes de négatifs", () => searchRaw(ctx, `SELECT campaign.id FROM campaign_shared_set WHERE campaign_shared_set.status = 'ENABLED' AND shared_set.type = 'NEGATIVE_KEYWORDS' AND campaign.status = 'ENABLED'`), [] as RawRow[]),
    q("Mots-clés refusés", () => searchRaw(ctx, `SELECT ad_group_criterion.keyword.text, campaign.name FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status = 'ENABLED' AND ad_group_criterion.approval_status = 'DISAPPROVED' AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'`), null as RawRow[] | null),
    q("Niveau de qualité", () => searchRaw(ctx, `SELECT ad_group_criterion.keyword.text, ad_group_criterion.quality_info.quality_score, metrics.cost_micros FROM keyword_view WHERE ad_group_criterion.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED' AND segments.date BETWEEN '${since30}' AND '${until}'`), null as RawRow[] | null),
    q("Statut des campagnes", () => searchRaw(ctx, `SELECT campaign.id, campaign.name, campaign.primary_status, campaign.primary_status_reasons FROM campaign WHERE campaign.status = 'ENABLED'`), null as RawRow[] | null),
    q("Plafond de CPC", () => searchRaw(ctx, `SELECT campaign.name, campaign.bidding_strategy_type, campaign.target_spend.cpc_bid_ceiling_micros FROM campaign WHERE campaign.status = 'ENABLED'`), null as RawRow[] | null),
    q("Tranches d'âge", () => searchRaw(ctx, `SELECT ad_group_criterion.age_range.type, metrics.cost_micros FROM age_range_view WHERE segments.date BETWEEN '${since30}' AND '${until}'`), null as RawRow[] | null),
    q("Audiences", () => searchRaw(ctx, `SELECT ad_group.id, ad_group_criterion.type FROM ad_group_criterion WHERE ad_group_criterion.type IN ('USER_LIST', 'USER_INTEREST', 'CUSTOM_AUDIENCE', 'COMBINED_AUDIENCE') AND ad_group_criterion.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED' AND campaign.advertising_channel_type = 'SEARCH'`), null as RawRow[] | null),
    q("Mode des audiences", () => searchRaw(ctx, `SELECT ad_group.id, ad_group.targeting_setting.target_restrictions FROM ad_group WHERE ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED' AND campaign.advertising_channel_type = 'SEARCH'`), null as RawRow[] | null),
    q("Création automatique de composants", () => searchRaw(ctx, `SELECT campaign.name, campaign.asset_automation_settings FROM campaign WHERE campaign.status = 'ENABLED'`), null as RawRow[] | null),
    q("Listes de clients", () => searchRaw(ctx, `SELECT user_list.name, user_list.size_for_search FROM user_list WHERE user_list.type = 'CRM_BASED'`), null as RawRow[] | null),
    q("Exclusions d'audiences", () => searchRaw(ctx, `SELECT campaign.id, campaign_criterion.negative FROM campaign_criterion WHERE campaign_criterion.type = 'USER_LIST' AND campaign_criterion.negative = TRUE AND campaign.status = 'ENABLED'`), null as RawRow[] | null),
    q("Langues", () => searchRaw(ctx, `SELECT campaign.name, campaign_criterion.language.language_constant FROM campaign_criterion WHERE campaign_criterion.type = 'LANGUAGE' AND campaign.status = 'ENABLED'`), null as RawRow[] | null),
    q("AI Max", () => searchRaw(ctx, `SELECT campaign.name, campaign.ai_max_setting.enable_ai_max FROM campaign WHERE campaign.status = 'ENABLED' AND campaign.advertising_channel_type = 'SEARCH'`), null as RawRow[] | null),
    q("Objectifs de conversion", () => searchRaw(ctx, `SELECT campaign.name, campaign_conversion_goal.category, campaign_conversion_goal.biddable FROM campaign_conversion_goal WHERE campaign.status = 'ENABLED' AND campaign_conversion_goal.biddable = TRUE`), null as RawRow[] | null),
    q("Composants peu performants", () => searchRaw(ctx, `SELECT ad_group_ad_asset_view.performance_label, metrics.impressions FROM ad_group_ad_asset_view WHERE ad_group_ad_asset_view.performance_label = 'LOW' AND ad_group_ad.status = 'ENABLED' AND campaign.status = 'ENABLED' AND segments.date BETWEEN '${since30}' AND '${until}'`), null as RawRow[] | null),
    q("Règles de valeur", () => searchRaw(ctx, `SELECT conversion_value_rule.id FROM conversion_value_rule WHERE conversion_value_rule.status = 'ENABLED'`), null as RawRow[] | null),
  ]);

  const settings = new Map<string, { search: boolean; content: boolean; partners: boolean; geo: string; targetCpa: number | null }>();
  for (const r of sett) {
    const ns = r.campaign?.networkSettings ?? {};
    const t = r.campaign?.targetCpa?.targetCpaMicros ?? r.campaign?.maximizeConversions?.targetCpaMicros;
    settings.set(String(r.campaign?.id), { search: !!ns.targetGoogleSearch, content: !!ns.targetContentNetwork, partners: !!ns.targetSearchNetwork, geo: r.campaign?.geoTargetTypeSetting?.positiveGeoTargetType ?? "", targetCpa: t ? micros(t) : null });
  }
  const dmap = new Map<string, number>();
  const clk = new Map<string, number>();
  for (const r of daily) { dmap.set(r.segments?.date, (dmap.get(r.segments?.date) ?? 0) + micros(r.metrics?.costMicros)); clk.set(r.segments?.date, (clk.get(r.segments?.date) ?? 0) + Number(r.metrics?.clicks ?? 0)); }
  const devs = new Map<string, { device: string; cost: number; conv: number }>();
  for (const r of dev ?? []) {
    const k = r.segments?.device ?? "?";
    const e = devs.get(k) ?? { device: k, cost: 0, conv: 0 };
    e.cost += micros(r.metrics?.costMicros); e.conv += Number(r.metrics?.conversions ?? 0);
    devs.set(k, e);
  }
  const pg = new Map<string, { url: string; cost: number; clicks: number; conv: number }>();
  for (const r of pages ?? []) {
    const u = r.landingPageView?.unexpandedFinalUrl ?? "";
    const e = pg.get(u) ?? { url: u, cost: 0, clicks: 0, conv: 0 };
    e.cost += micros(r.metrics?.costMicros); e.clicks += Number(r.metrics?.clicks ?? 0); e.conv += Number(r.metrics?.conversions ?? 0);
    pg.set(u, e);
  }
  const lastChange = change?.[0]?.changeEvent?.changeDateTime as string | undefined;
  const urlChecks = ads === null ? null : await q("Adresses des annonces", () => checkUrls([...new Set(ads.flatMap((r) => (r.adGroupAd?.ad?.finalUrls ?? []) as string[]))].slice(0, 12)), null as { url: string; code: number | null }[] | null);
  const topPages = [...pg.values()].filter((x) => /^https?:/.test(x.url)).sort((a, b) => b.cost - a.cost).slice(0, 2).map((x) => x.url);
  const speed = topPages.length ? await q("Vitesse des pages", () => pageSpeed(topPages), null as { url: string; score: number; lcp: number | null }[] | null) : null;
  const qsMap = new Map<string, { text: string; qs: number; cost: number }>();
  for (const r of qsRows ?? []) {
    const qs = Number(r.adGroupCriterion?.qualityInfo?.qualityScore ?? 0);
    const text = String(r.adGroupCriterion?.keyword?.text ?? "");
    if (!qs || !text) continue;
    const e = qsMap.get(text) ?? { text, qs, cost: 0 };
    e.cost += micros(r.metrics?.costMicros);
    qsMap.set(text, e);
  }

  return {
    skipped,
    data: {
      autoTagging: cust[0]?.customer?.autoTaggingEnabled ?? null,
      optimizationScore: cust[0]?.customer?.optimizationScore !== undefined ? Number(cust[0].customer.optimizationScore) : null,
      campaigns, settings, perf30, kws, terms, negatives,
      sharedLinked: new Set(shared.map((r) => String(r.campaign?.id))),
      conversions: conv?.map((r) => ({
        name: r.conversionAction?.name ?? "", category: r.conversionAction?.category ?? "", primary: !!r.conversionAction?.primaryForGoal,
        counting: r.conversionAction?.countingType ?? "", type: r.conversionAction?.type ?? "", origin: r.conversionAction?.origin ?? "",
        model: r.conversionAction?.attributionModelSettings?.attributionModel ?? "",
        viewDays: r.conversionAction?.viewThroughLookbackWindowDays ? Number(r.conversionAction.viewThroughLookbackWindowDays) : null,
      })) ?? null,
      ads: ads?.map((r) => {
        const rsa = r.adGroupAd?.ad?.responsiveSearchAd ?? {};
        const hl = (rsa.headlines ?? []) as { text?: string; pinnedField?: string }[];
        const ds = (rsa.descriptions ?? []) as { text?: string; pinnedField?: string }[];
        return {
          adGroupId: String(r.adGroup?.id), campaignId: String(r.campaign?.id), status: r.adGroupAd?.status ?? "", strength: r.adGroupAd?.adStrength ?? "",
          approval: r.adGroupAd?.policySummary?.approvalStatus ?? "", type: r.adGroupAd?.ad?.type ?? "",
          headlines: hl.length, descriptions: ds.length, pinned: [...hl, ...ds].filter((h) => h.pinnedField && h.pinnedField !== "UNSPECIFIED").length,
          text: [...hl, ...ds].map((h) => h.text ?? "").join(" | "), urls: (r.adGroupAd?.ad?.finalUrls ?? []) as string[],
        };
      }) ?? null,
      adGroups: ags?.map((r) => ({ id: String(r.adGroup?.id), campaignId: String(r.campaign?.id), name: r.adGroup?.name ?? "" })) ?? null,
      assets: campAssets === null && custAssets === null ? null : [
        ...(campAssets ?? []).map((r) => ({ field: r.campaignAsset?.fieldType ?? "", approval: r.asset?.policySummary?.approvalStatus ?? "", level: "campagne" as const, campaignId: String(r.campaign?.id) })),
        ...(custAssets ?? []).map((r) => ({ field: r.customerAsset?.fieldType ?? "", approval: r.asset?.policySummary?.approvalStatus ?? "", level: "compte" as const })),
      ],
      daily: [...dmap.entries()].map(([date, cost]) => ({ date, cost, clicks: clk.get(date) ?? 0 })).sort((a, b) => a.date.localeCompare(b.date)),
      lastChangeDays: change === null ? null : lastChange ? Math.floor((Date.now() - Date.parse(lastChange.replace(" ", "T"))) / 864e5) : 31,
      autoApply: autoApply === null ? null : autoApply.filter((r) => r.recommendationSubscription?.status === "ENABLED").map((r) => String(r.recommendationSubscription?.type)),
      locations: loc === null ? null : new Set(loc.map((r) => String(r.campaign?.id))),
      schedules: sched === null ? null : new Set(sched.map((r) => String(r.campaign?.id))),
      devices: dev === null ? null : [...devs.values()],
      pages: pages === null ? null : [...pg.values()],
      disapprovedKws: disKw === null ? null : disKw.map((r) => ({ text: String(r.adGroupCriterion?.keyword?.text ?? ""), campaign: String(r.campaign?.name ?? "") })),
      qualityScores: qsRows === null ? null : [...qsMap.values()],
      campaignStatus: campSt === null ? null : campSt.map((r) => ({ id: String(r.campaign?.id), name: String(r.campaign?.name ?? ""), status: String(r.campaign?.primaryStatus ?? ""), reasons: ((r.campaign?.primaryStatusReasons ?? []) as string[]).map(String) })),
      urlChecks: urlChecks ?? null,
      speed,
      enhancedConversions: cust.length ? !!cust[0]?.customer?.conversionTrackingSetting?.enhancedConversionsForLeadsEnabled : null,
      accountName: cust[0]?.customer?.descriptiveName ?? null,
      cpcCeilings: ceil === null ? null : ceil.map((r) => ({ name: String(r.campaign?.name ?? ""), bidding: String(r.campaign?.biddingStrategyType ?? ""), ceiling: r.campaign?.targetSpend?.cpcBidCeilingMicros ? micros(r.campaign.targetSpend.cpcBidCeilingMicros) : null })),
      ages: ageRows === null ? null : [...ageRows.reduce((m, r) => m.set(String(r.adGroupCriterion?.ageRange?.type ?? "?"), (m.get(String(r.adGroupCriterion?.ageRange?.type ?? "?")) ?? 0) + micros(r.metrics?.costMicros)), new Map<string, number>()).entries()].map(([range, cost]) => ({ range, cost })),
      audiences: audRows === null ? null : audRows.map((r) => ({ adGroupId: String(r.adGroup?.id) })),
      audienceTargeting: audTgt === null ? null : audTgt.flatMap((r) => ((r.adGroup?.targetingSetting?.targetRestrictions ?? []) as { targetingDimension?: string; bidOnly?: boolean }[]).filter((t) => t.targetingDimension === "AUDIENCE").map((t) => ({ adGroupId: String(r.adGroup?.id), bidOnly: !!t.bidOnly }))),
      crmLists: crm === null ? null : crm.map((r) => ({ name: String(r.userList?.name ?? ""), size: Number(r.userList?.sizeForSearch ?? 0) })),
      audienceExclusions: audEx === null ? null : audEx.length,
      languages: langs === null ? null : [...langs.reduce((m, r) => m.set(String(r.campaign?.name ?? ""), [...(m.get(String(r.campaign?.name ?? "")) ?? []), String(r.campaignCriterion?.language?.languageConstant ?? "").replace(/^.*\//, "")]), new Map<string, string[]>()).entries()].map(([campaign, ids]) => ({ campaign, ids })),
      aiMax: aimax === null ? null : aimax.map((r) => ({ campaign: String(r.campaign?.name ?? ""), on: !!r.campaign?.aiMaxSetting?.enableAiMax })),
      goals: goalRows === null ? null : [...goalRows.reduce((m, r) => m.set(String(r.campaign?.name ?? ""), [...new Set([...(m.get(String(r.campaign?.name ?? "")) ?? []), String(r.campaignConversionGoal?.category ?? "")])]), new Map<string, string[]>()).entries()].map(([campaign, categories]) => ({ campaign, categories })),
      lowAssets: lowAs === null ? null : lowAs.length,
      valueRules: vrules === null ? null : vrules.length,
      assetAutomation: autoAsset === null ? null : autoAsset.map((r) => ({ campaign: String(r.campaign?.name ?? ""), types: ((r.campaign?.assetAutomationSettings ?? []) as { assetAutomationType?: string; assetAutomationStatus?: string }[]).filter((x) => x.assetAutomationStatus === "OPTED_IN").map((x) => String(x.assetAutomationType)) })),
    },
  };
}

function mockScan(campaigns: CampaignLite[], perf30: CampaignPerf[], kws: KeywordRow[], terms: TermRow[], negatives: NegativeRow[]): ScanData {
  const daily = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 30 + i); return { date: iso(d), cost: 28 + (i % 5) }; });
  return {
    autoTagging: true, optimizationScore: 0.71, campaigns,
    settings: new Map(campaigns.map((c) => [c.id, { search: true, content: false, partners: true, geo: "PRESENCE_OR_INTEREST", targetCpa: null }])),
    perf30, kws, terms, negatives, sharedLinked: new Set(["2401"]),
    conversions: [
      { name: "Appel depuis les annonces", category: "PHONE_CALL_LEAD", primary: true, counting: "ONE_PER_CLICK", type: "AD_CALL", model: "GOOGLE_SEARCH_ATTRIBUTION_DATA_DRIVEN", viewDays: null, origin: "CALL_FROM_ADS" },
      { name: "Formulaire devis", category: "SUBMIT_LEAD_FORM", primary: true, counting: "ONE_PER_CLICK", type: "WEBPAGE", model: "GOOGLE_SEARCH_ATTRIBUTION_DATA_DRIVEN", viewDays: null, origin: "WEBSITE" },
      { name: "Clic sur le téléphone (test)", category: "CONTACT", primary: true, counting: "MANY_PER_CLICK", type: "WEBPAGE", model: "GOOGLE_ADS_LAST_CLICK", viewDays: null, origin: "WEBSITE" },
    ],
    ads: [
      { adGroupId: "7701", campaignId: "2401", status: "ENABLED", strength: "AVERAGE", approval: "APPROVED", type: "RESPONSIVE_SEARCH_AD", headlines: 9, descriptions: 3, pinned: 2, text: "Fenêtres sur mesure | Pose par nos artisans | Devis gratuit", urls: ["https://d2b-renovation.fr/fenetres"] },
    ],
    adGroups: [{ id: "7701", campaignId: "2401", name: "Groupe d'annonces Fenêtres" }],
    assets: [
      { field: "CALL", approval: "DISAPPROVED", level: "campagne", campaignId: "2401" },
      { field: "SITELINK", approval: "APPROVED", level: "campagne", campaignId: "2401" },
      { field: "SITELINK", approval: "APPROVED", level: "campagne", campaignId: "2401" },
      { field: "CALLOUT", approval: "APPROVED", level: "compte" },
    ],
    daily, lastChangeDays: 3, autoApply: [], locations: new Set(["2401"]), schedules: new Set(),
    devices: [{ device: "MOBILE", cost: 610, conv: 2 }, { device: "DESKTOP", cost: 260, conv: 1 }, { device: "TABLET", cost: 44, conv: 0 }],
    pages: [{ url: "https://d2b-renovation.fr/fenetres", cost: 790, clicks: 170, conv: 3 }, { url: "https://d2b-renovation.fr/", cost: 124, clicks: 30, conv: 0 }],
    disapprovedKws: [{ text: "fenêtre pas chère", campaign: campaigns[0]?.name ?? "Campagne" }],
    qualityScores: [{ text: "fenetre pvc la farlede", qs: 8, cost: 210 }, { text: "porte fenetre", qs: 4, cost: 330 }, { text: "menuisier toulon", qs: 6, cost: 90 }],
    campaignStatus: campaigns.filter((c) => c.status === "ENABLED").map((c, i) => ({ id: c.id, name: c.name, status: i === 0 ? "LIMITED" : "ELIGIBLE", reasons: i === 0 ? ["BUDGET_CONSTRAINED"] : [] })),
    urlChecks: [{ url: "https://d2b-renovation.fr/fenetres", code: 200 }, { url: "https://d2b-renovation.fr/", code: 200 }],
    enhancedConversions: false,
    speed: [{ url: "https://d2b-renovation.fr/fenetres", score: 42, lcp: 4.1 }],
    accountName: "D2B Rénovation",
    cpcCeilings: campaigns.filter((c) => c.status === "ENABLED").map((c) => ({ name: c.name, bidding: c.bidding, ceiling: null })),
    ages: [{ range: "AGE_RANGE_18_24", cost: 12 }, { range: "AGE_RANGE_35_44", cost: 380 }, { range: "AGE_RANGE_UNDETERMINED", cost: 120 }],
    audiences: [{ adGroupId: "7701" }, { adGroupId: "7701" }],
    audienceTargeting: [{ adGroupId: "7701", bidOnly: true }],
    assetAutomation: campaigns.filter((c) => c.status === "ENABLED").map((c) => ({ campaign: c.name, types: ["TEXT_ASSET_AUTOMATION"] })),
    crmLists: [{ name: "Clients D2B", size: 340 }],
    audienceExclusions: 0,
    languages: campaigns.filter((c) => c.status === "ENABLED").map((c) => ({ campaign: c.name, ids: ["1002"] })),
    aiMax: campaigns.filter((c) => c.status === "ENABLED").map((c) => ({ campaign: c.name, on: false })),
    goals: campaigns.filter((c) => c.status === "ENABLED").map((c) => ({ campaign: c.name, categories: ["PHONE_CALL_LEAD", "SUBMIT_LEAD_FORM"] })),
    lowAssets: 3,
    valueRules: 0,
  };
}

// ── Évaluation ────────────────────────────────────────────────────────────

type Out = { status: ScanStatus; detail: string };
const ok = (detail: string): Out => ({ status: "ok", detail });
const warn = (detail: string): Out => ({ status: "warn", detail });
const bad = (detail: string): Out => ({ status: "bad", detail });
const manual = (detail = "À vérifier à la main (pas lisible par l'API).") : Out => ({ status: "manual", detail });
const na = (detail: string): Out => ({ status: "na", detail });
const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const pc = (n: number) => `${Math.round(n * 100)} %`;
const f1 = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const f0 = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });

function evaluators(d: ScanData, model: Model): Record<string, () => Out> {
  const search = d.campaigns.filter((c) => c.status === "ENABLED" && c.channel === "SEARCH");
  const active = d.campaigns.filter((c) => c.status === "ENABLED");
  const has = (ch: string) => active.some((c) => c.channel === ch);
  const tot = d.perf30.reduce((s, c) => ({ cost: s.cost + c.cur.cost, conv: s.conv + c.cur.conversions, clicks: s.clicks + c.cur.clicks, imp: s.imp + c.cur.impressions }), { cost: 0, conv: 0, clicks: 0, imp: 0 });
  const prev = d.perf30.reduce((s, c) => ({ cost: s.cost + c.prev.cost, conv: s.conv + c.prev.conversions, clicks: s.clicks + c.prev.clicks, imp: s.imp + c.prev.impressions }), { cost: 0, conv: 0, clicks: 0, imp: 0 });
  const cpa = tot.conv ? tot.cost / tot.conv : null;
  const kwAct = d.kws.filter((k) => k.status === "ENABLED");
  const kwCost = kwAct.reduce((s, k) => s + k.cur.cost, 0);
  const assetTypes = new Set((d.assets ?? []).map((a) => a.field));
  const primary = (d.conversions ?? []).filter((c) => c.primary);
  const notPmax = (label: string) => (has("PERFORMANCE_MAX") ? null : na(`Pas de campagne Performance Max active (${label}).`));
  const notShop = has("SHOPPING") || has("PERFORMANCE_MAX") ? null : na("Pas de campagne Shopping ou Performance Max active.");
  const notDisplay = has("DISPLAY") || has("DEMAND_GEN") || has("VIDEO") ? null : na("Pas de campagne Display, vidéo ou Demand Gen active.");
  const isBrandCamp = (n: string) => /marque|brand/i.test(n);
  const GENERIC = /^(renovation|rénovation|services?|sarl|sas|eurl|menuiserie|menuiseries|france|group|groupe|entreprise|artisan|batiment|bâtiment|construction|habitat|maison)$/i;
  const fold = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const brandWords = [...new Set(
    [d.campaigns.find((c) => isBrandCamp(c.name))?.name ?? "", d.accountName ?? ""].join(" ").split(/[^\p{L}\p{N}]+/u)
      .map(fold).filter((w) => w.length >= 3 && !/^(marque|brand|search|ads|google)$/.test(w) && !GENERIC.test(w)),
  )];
  const hasBrand = (t: string) => { const f = fold(t); return brandWords.some((w) => f.includes(w)); };
  const hasBrandCamp = d.campaigns.some((c) => c.status === "ENABLED" && isBrandCamp(c.name));

  const E: Record<string, () => Out> = {
    // compte
    "Le compte dépense": () => {
      const last = d.daily.at(-1)?.cost ?? 0;
      const avg = d.daily.slice(-8, -1).reduce((s, x) => s + x.cost, 0) / 7;
      return last === 0 && avg > 0 ? bad(`0 € hier contre ${eur(avg)} par jour en moyenne.`) : ok(`${eur(last)} dépensés hier.`);
    },
    "Recommandations auto-appliquées désactivées": () => (d.autoApply === null ? manual() : d.autoApply.length ? bad(`${d.autoApply.length} type(s) appliqué(s) automatiquement : ${d.autoApply.slice(0, 3).join(", ")}.`) : ok("Aucune recommandation appliquée toute seule.")),
    "Auto-tagging activé": () => (d.autoTagging === null ? manual() : d.autoTagging ? ok("Activé.") : bad("Désactivé : GA4 ne relie pas les visites aux clics.")),
    "Nombre de campagnes adapté au volume": () => {
      const n = Math.max(1, active.length), per = tot.conv / n;
      return per >= 30 ? ok(`${f1(per)} conversions par campagne sur 30 j.`) : per < 15 ? bad(`${f1(per)} conversion(s) par campagne sur 30 j (${n} campagne(s)) : données trop éparpillées pour l'enchère automatique.`) : warn(`${f1(per)} conversions par campagne.`);
    },
    "Répartition du budget par type de campagne": () => {
      const shop = d.perf30.filter((c) => ["SHOPPING", "PERFORMANCE_MAX"].includes(d.campaigns.find((x) => x.id === c.id)?.channel ?? "")).reduce((s, c) => s + c.cur.cost, 0);
      return tot.cost ? (shop / tot.cost >= 0.7 ? ok(`${pc(shop / tot.cost)} sur Shopping et PMax.`) : warn(`${pc(shop / tot.cost)} seulement sur Shopping et PMax.`)) : na("Pas de dépense.");
    },
    "Modifications récentes": () => (d.lastChangeDays === null ? manual() : d.lastChangeDays < 14 ? ok(`Dernière modification il y a ${d.lastChangeDays} jour(s).`) : d.lastChangeDays > 30 ? bad("Aucune modification depuis plus de 30 jours.") : warn(`Dernière modification il y a ${d.lastChangeDays} jours.`)),
    "Aucune campagne en « tous pays et territoires »": () => {
      if (d.locations === null) return manual();
      const none = active.filter((c) => !d.locations!.has(c.id) && c.channel !== "PERFORMANCE_MAX");
      return none.length ? bad(`Sans ciblage géographique : ${none.map((c) => `« ${c.name} »`).join(", ")}.`) : ok("Toutes les campagnes ciblent une zone.");
    },
    "Vérification annonceur, nom et logo": () => (d.assets === null ? manual() : assetTypes.has("BUSINESS_NAME") && assetTypes.has("BUSINESS_LOGO") ? ok("Nom et logo présents.") : bad(`Absent : ${[!assetTypes.has("BUSINESS_NAME") && "nom d'entreprise", !assetTypes.has("BUSINESS_LOGO") && "logo"].filter(Boolean).join(" et ")}.`)),
    "Score d'optimisation Google": () => (d.optimizationScore === null ? manual() : d.optimizationScore >= 0.8 ? ok(`${pc(d.optimizationScore)}.`) : d.optimizationScore < 0.6 ? bad(`${pc(d.optimizationScore)}.`) : warn(`${pc(d.optimizationScore)} (à lire avec recul : Google pousse ses propres recommandations).`)),
    // suivi
    "Les conversions remontent": () => {
      return tot.conv === 0 && prev.conv > 0 ? bad(`0 conversion sur 30 j contre ${f0(prev.conv)} avant.`) : tot.conv === 0 ? warn("Aucune conversion sur 30 jours : vérifier que le suivi fonctionne (test d'appel, de formulaire).") : ok(`${f0(tot.conv)} conversion(s) sur 30 j.`);
    },
    "Pas de double comptage": () => {
      if (d.conversions === null) return manual();
      const byCat = new Map<string, number>();
      primary.forEach((c) => byCat.set(c.category, (byCat.get(c.category) ?? 0) + 1));
      const dup = [...byCat.entries()].filter(([, n]) => n > 1);
      return dup.length ? bad(`Plusieurs actions principales du même type : ${dup.map(([k, n]) => `${k} (${n})`).join(", ")}.`) : ok(`${primary.length} action(s) principale(s), types distincts.`);
    },
    "Pas d'action de test en principale": () => (d.conversions === null ? manual() : primary.some((c) => /test/i.test(c.name)) ? bad(`Action de test en principale : ${primary.filter((c) => /test/i.test(c.name)).map((c) => `« ${c.name} »`).join(", ")}.`) : ok("Aucune action de test en principale.")),
    "Balise du site comme source principale": () => (d.conversions === null ? manual() : primary.length && primary.every((c) => c.type === "GOOGLE_ANALYTICS_4_CUSTOM" || c.type.startsWith("GOOGLE_ANALYTICS")) ? warn("Seules des conversions importées de GA4 pilotent l'enchère.") : ok("Balise Google Ads ou appels en principal.")),
    "Attribution basée sur les données": () => (d.conversions === null ? manual() : primary.some((c) => c.model && !c.model.includes("DATA_DRIVEN") && c.type === "WEBPAGE") ? bad(`Au dernier clic : ${primary.filter((c) => c.model && !c.model.includes("DATA_DRIVEN") && c.type === "WEBPAGE").map((c) => `« ${c.name} »`).join(", ")}.`) : ok("Attribution basée sur les données.")),
    "Comptage adapté à chaque action": () => {
      if (d.conversions === null) return manual();
      const wrong = primary.filter((c) => /LEAD|CONTACT|SIGNUP|PHONE|SUBMIT|BOOK/.test(c.category) && c.counting === "MANY_PER_CLICK");
      return wrong.length ? bad(`Lead compté « toutes » : ${wrong.map((c) => `« ${c.name} »`).join(", ")} (une par clic attendu).`) : ok("Comptage cohérent.");
    },
    "Suivi des appels": () => (d.conversions === null ? manual() : !assetTypes.has("CALL") ? na("Pas d'extension d'appel.") : (d.conversions ?? []).some((c) => c.type === "AD_CALL" || c.origin === "CALL_FROM_ADS") ? ok("Les appels depuis les annonces sont suivis.") : bad("Extension d'appel sans conversion d'appel.")),
    "Fenêtre d'attribution après vue courte": () => (d.conversions === null ? manual() : (() => { const long = (d.conversions ?? []).filter((c) => (c.viewDays ?? 0) > 3); return long.length ? warn(`Fenêtre après vue > 3 j : ${long.map((c) => c.name).join(", ")}.`) : ok("Fenêtres courtes."); })()),
    // enchères
    "Stratégie cohérente avec l'objectif": () => {
      const manualCpc = search.filter((c) => ["MANUAL_CPC", "MAXIMIZE_CLICKS", "TARGET_SPEND"].includes(c.bidding));
      return manualCpc.length && tot.conv >= 15 ? warn(`Au clic malgré ${f0(tot.conv)} conversions : ${manualCpc.map((c) => c.name).join(", ")}.`) : ok(`Stratégies : ${[...new Set(active.map((c) => c.bidding))].join(", ") || "–"}.`);
    },
    "Volume suffisant pour le Smart Bidding": () => {
      const smart = d.perf30.filter((c) => ["MAXIMIZE_CONVERSIONS", "TARGET_CPA", "MAXIMIZE_CONVERSION_VALUE", "TARGET_ROAS"].includes(d.campaigns.find((x) => x.id === c.id)?.bidding ?? ""));
      if (!smart.length) return na("Aucune campagne en enchère automatique aux conversions.");
      const low = smart.filter((c) => c.cur.conversions < 15);
      return low.length ? bad(`Moins de 15 conversions sur 30 j : ${low.map((c) => `« ${c.name} » (${f0(c.cur.conversions)})`).join(", ")}.`) : smart.some((c) => c.cur.conversions < 30) ? warn("Entre 15 et 30 conversions sur 30 j.") : ok("Au moins 30 conversions par campagne.");
    },
    "Requête large sans Smart Bidding": () => {
      const broad = kwAct.filter((k) => k.matchType === "BROAD" && ["MANUAL_CPC", "MAXIMIZE_CLICKS", "TARGET_SPEND"].includes(d.campaigns.find((c) => c.id === k.campaignId)?.bidding ?? ""));
      return broad.length ? bad(`${broad.length} mot(s)-clé(s) en requête large en enchère au clic.`) : ok("Pas de requête large en enchère au clic.");
    },
    "CPA réel par rapport à la cible": () => {
      const withT = [...d.settings.entries()].filter(([, s]) => s.targetCpa);
      if (!withT.length) return na("Aucune cible de CPA définie.");
      const outs = withT.map(([id, s]) => { const p = d.perf30.find((c) => c.id === id); return p && p.cur.conversions >= 10 ? { name: p.name, r: p.cur.cost / p.cur.conversions / s.targetCpa! } : null; }).filter(Boolean) as { name: string; r: number }[];
      if (!outs.length) return warn("Moins de 10 conversions : écart non mesurable.");
      const worst = outs.sort((a, b) => b.r - a.r)[0];
      return worst.r <= 1.1 ? ok("CPA dans la cible.") : worst.r > 1.3 ? bad(`« ${worst.name} » : CPA réel à ${pc(worst.r)} de la cible.`) : warn(`« ${worst.name} » : ${pc(worst.r)} de la cible.`);
    },
    "Part perdue faute de budget": () => {
      const rentable = d.perf30.filter((c) => c.cur.conversions > 0 && c.cur.lostBudget !== null);
      if (!rentable.length) return na("Pas de campagne Search qui convertit sur 30 j.");
      const worst = rentable.sort((a, b) => (b.cur.lostBudget ?? 0) - (a.cur.lostBudget ?? 0))[0];
      const lb = worst.cur.lostBudget ?? 0;
      return lb < 0.1 ? ok(`Au plus ${pc(lb)} perdues faute de budget.`) : lb > 0.2 ? bad(`« ${worst.name} » perd ${pc(lb)} faute de budget.`) : warn(`« ${worst.name} » perd ${pc(lb)} faute de budget.`);
    },
    "CPA cible renseigné en « Maximiser les conversions »": () => {
      const mc = search.filter((c) => c.bidding === "MAXIMIZE_CONVERSIONS" && !d.settings.get(c.id)?.targetCpa);
      return !search.some((c) => c.bidding === "MAXIMIZE_CONVERSIONS") ? na("Pas de campagne en Maximiser les conversions.") : mc.length ? warn(`Sans CPA cible : ${mc.map((c) => c.name).join(", ")}${cpa ? ` (CPA actuel ${eur(cpa)})` : ""}.`) : ok("CPA cible renseigné.");
    },
    "Budget journalier suffisant": () => (cpa === null ? warn("Pas de CPA mesuré pour juger le budget.") : (() => { const low = search.filter((c) => c.dailyBudget < 3 * cpa); return low.length ? bad(`Budget < 3 × CPA (${eur(3 * cpa)}) : ${low.map((c) => `« ${c.name} » ${eur(c.dailyBudget)}/j`).join(", ")}.`) : ok("Budgets d'au moins 3 × le CPA."); })()),
    "Rythme de dépense du mois": () => {
      const day = new Date().getUTCDate() - 1;
      if (day < 3) return na("Trop tôt dans le mois.");
      const dim = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0)).getUTCDate();
      const spent = d.daily.slice(-day).reduce((s, x) => s + x.cost, 0);
      const target = active.reduce((s, c) => s + c.dailyBudget, 0) * dim;
      const r = target ? (spent / day) * dim / target : 1;
      return Math.abs(r - 1) <= 0.1 ? ok(`Fin de mois prévue à ${pc(r)} du budget.`) : Math.abs(r - 1) > 0.2 ? bad(`Fin de mois prévue à ${pc(r)} du budget.`) : warn(`Fin de mois prévue à ${pc(r)} du budget.`);
    },
    // structure
    "Marque et générique séparés": () => (brandWords.length ? ok("Une campagne marque existe.") : warn("Pas de campagne marque identifiée (nom contenant « marque »).")),
    "Groupes sans annonce active": () => {
      if (!d.ads || !d.adGroups) return manual();
      const withAd = new Set(d.ads.filter((a) => a.status === "ENABLED").map((a) => a.adGroupId));
      const empty = d.adGroups.filter((g) => !withAd.has(g.id));
      return empty.length ? bad(`${empty.length} groupe(s) sans annonce active : ${empty.slice(0, 3).map((g) => g.name).join(", ")}.`) : ok("Chaque groupe a une annonce active.");
    },
    "Groupes sans mot-clé, campagnes sans groupe": () => {
      if (!d.adGroups) return manual();
      const withKw = new Set(kwAct.map((k) => k.adGroupId));
      const searchIds = new Set(search.map((c) => c.id));
      const empty = d.adGroups.filter((g) => searchIds.has(g.campaignId) && !withKw.has(g.id));
      return empty.length ? bad(`${empty.length} groupe(s) Search sans mot-clé actif.`) : ok("Pas de groupe vide.");
    },
    "Display coupé sur les campagnes Search": () => { const on = search.filter((c) => d.settings.get(c.id)?.content); return on.length ? bad(`Réseau Display ouvert : ${on.map((c) => c.name).join(", ")}.`) : ok("Display coupé sur le Search."); },
    "Partenaires du Réseau de Recherche rentables": () => { const on = search.filter((c) => d.settings.get(c.id)?.partners); return on.length ? warn(`Partenaires activés sur ${on.length} campagne(s) : comparer leur CPA (segment Réseau).`) : ok("Partenaires coupés."); },
    "Groupes trop larges": () => {
      const per = new Map<string, number>(); kwAct.forEach((k) => per.set(k.adGroup, (per.get(k.adGroup) ?? 0) + 1));
      const big = [...per.entries()].filter(([, n]) => n > 20);
      return big.length ? bad(`Plus de 20 mots-clés : ${big.map(([g, n]) => `« ${g} » (${n})`).join(", ")}.`) : ok(`Au plus ${Math.max(0, ...per.values())} mots-clés par groupe.`);
    },
    "Chevauchement de termes entre campagnes": () => {
      const by = new Map<string, Set<string>>(); d.terms.forEach((t) => { const k = normKw(t.term); by.set(k, new Set([...(by.get(k) ?? []), t.campaignId])); });
      const dup = [...by.entries()].filter(([, s]) => s.size > 1);
      return dup.length ? bad(`${dup.length} recherche(s) servie(s) par plusieurs campagnes (ex. « ${dup[0][0]} »).`) : ok("Pas de chevauchement.");
    },
    "Annonces dynamiques encore actives": () => (d.ads === null ? manual() : d.ads.some((a) => a.type === "EXPANDED_DYNAMIC_SEARCH_AD" && a.status === "ENABLED") ? warn("Annonces dynamiques actives : prévoir la migration.") : ok("Pas d'annonce dynamique.")),
    // mots-clés
    "QS des mots-clés qui dépensent le plus": () => {
      const withQs = kwAct.filter((k) => k.qs !== null).sort((a, b) => b.cur.cost - a.cur.cost);
      let acc = 0; const top = withQs.filter((k) => { const keep = acc < kwCost * 0.8; acc += k.cur.cost; return keep; });
      const c = top.reduce((s, k) => s + k.cur.cost, 0);
      if (!c) return na("Pas de dépense sur des mots-clés notés.");
      const w = top.reduce((s, k) => s + (k.qs ?? 0) * k.cur.cost, 0) / c;
      return w >= 7 ? ok(`QS pondéré ${f1(w)}/10.`) : w < 5 ? bad(`QS pondéré ${f1(w)}/10 sur les mots-clés qui font 80 % du coût.`) : warn(`QS pondéré ${f1(w)}/10.`);
    },
    "CTR attendu inférieur à la moyenne": () => { const imp = kwAct.reduce((s, k) => s + k.cur.impressions, 0); const low = kwAct.filter((k) => k.ctrQ === "faible").reduce((s, k) => s + k.cur.impressions, 0); return imp ? (low / imp > 0.2 ? bad(`${pc(low / imp)} des impressions avec un CTR attendu faible.`) : ok(`${pc(low / imp)} des impressions.`)) : na("Pas d'impression."); },
    "Pertinence de l'annonce inférieure": () => { const imp = kwAct.reduce((s, k) => s + k.cur.impressions, 0); const low = kwAct.filter((k) => k.adQ === "faible").reduce((s, k) => s + k.cur.impressions, 0); return imp ? (low / imp > 0.2 ? bad(`${pc(low / imp)} des impressions avec une pertinence faible.`) : ok(`${pc(low / imp)} des impressions.`)) : na("Pas d'impression."); },
    "Expérience sur la page de destination": () => { const imp = kwAct.reduce((s, k) => s + k.cur.impressions, 0); const low = kwAct.filter((k) => k.lpQ === "faible").reduce((s, k) => s + k.cur.impressions, 0); return imp ? (low / imp > 0.2 ? bad(`${pc(low / imp)} des impressions avec une page jugée faible.`) : ok(`${pc(low / imp)} des impressions.`)) : na("Pas d'impression."); },
    "Mots-clés qui dépensent sans convertir": () => {
      const ref = cpa ?? 60;
      const w = kwAct.filter((k) => k.cur.conversions === 0 && k.cur.clicks >= 30 && k.cur.cost > 2 * ref);
      return w.length ? bad(`${w.length} mot(s)-clé(s) > ${eur(2 * ref)} sans conversion : ${w.slice(0, 3).map((k) => `« ${k.text} »`).join(", ")}.`) : ok(`Aucun mot-clé au-delà de 2 × le CPA (${eur(2 * ref)}) sans conversion.`);
    },
    "Mots-clés bloqués par un négatif": () => {
      const blocked = kwAct.filter((k) => d.negatives.some((n) => (n.level === "ad_group" ? n.adGroupId === k.adGroupId : n.campaignId === k.campaignId) && negativeBlocks(n.text, n.matchType, k.text)));
      return blocked.length ? bad(`${blocked.length} mot(s)-clé(s) bloqué(s) : ${blocked.slice(0, 3).map((k) => `« ${k.text} »`).join(", ")}.`) : ok("Aucun mot-clé bloqué.");
    },
    "Mots-clés en doublon": () => { const seen = new Map<string, number>(); kwAct.forEach((k) => { const key = `${k.campaignId}~${normKw(k.text)}~${k.matchType}`; seen.set(key, (seen.get(key) ?? 0) + 1); }); const n = [...seen.values()].filter((v) => v > 1).length; return n ? warn(`${n} mot(s)-clé(s) en double dans une même campagne.`) : ok("Pas de doublon."); },
    "Syntaxe de correspondance erronée": () => { const w = kwAct.filter((k) => /^[["+]|[\]"]$/.test(k.text)); return w.length ? bad(`${w.length} mot(s)-clé(s) avec des signes dans le texte (ex. « ${w[0].text} »).`) : ok("Syntaxe propre."); },
    "Mots-clés rentables qui perdent du classement": () => manual("Part perdue au classement par mot-clé : voir la page CPC vs marché."),
    // termes
    "Liste de négatifs partagée sur chaque campagne Search": () => { const miss = search.filter((c) => !d.sharedLinked.has(c.id)); return miss.length ? bad(`Sans liste partagée : ${miss.map((c) => c.name).join(", ")}.`) : ok("Chaque campagne Search a une liste partagée."); },
    "Termes qui gaspillent": () => { const ref = cpa ?? 60; const w = d.terms.filter((t) => t.cur.conversions === 0 && t.cur.clicks >= 20 && t.cur.cost > 1.5 * ref); return w.length ? bad(`${w.length} recherche(s) > ${eur(1.5 * ref)} sans conversion sur 90 j.`) : ok("Aucune recherche ne gaspille au-delà du seuil (90 j)."); },
    "N-grammes sans conversion": () => {
      const ref = cpa ?? 60; const m = new Map<string, { c: number; v: number }>();
      d.terms.forEach((t) => ngrams(t.term, 1).forEach((g) => { const e = m.get(g) ?? { c: 0, v: 0 }; e.c += t.cur.cost; e.v += t.cur.conversions; m.set(g, e); }));
      const w = [...m.entries()].filter(([, e]) => e.v === 0 && e.c > 2 * ref).sort((a, b) => b[1].c - a[1].c);
      return w.length ? bad(`Mots sans conversion au-delà de ${eur(2 * ref)} : ${w.slice(0, 4).map(([g, e]) => `« ${g} » ${eur(e.c)}`).join(", ")}.`) : ok("Aucun mot sans conversion au-delà du seuil.");
    },
    "Termes qui convertissent sans être mots-clés": () => { const kwSet = new Set(kwAct.map((k) => normKw(k.text))); const w = d.terms.filter((t) => t.cur.conversions >= 2 && !kwSet.has(normKw(t.term))); return w.length ? warn(`${w.length} recherche(s) à ajouter en mot-clé (ex. « ${w[0].term} »).`) : ok("Les recherches qui convertissent sont des mots-clés."); },
    "Mots d'intention indésirable": () => { const w = d.terms.filter((t) => ["emploi", "gratuit"].includes(classify(t.term)) && t.cur.cost > 0); return w.length ? bad(`${w.length} recherche(s) emploi / gratuit / occasion payées (${eur(w.reduce((s, t) => s + t.cur.cost, 0))}).`) : ok("Aucune recherche indésirable payée."); },
    "Termes hors sujet": () => { const w = d.terms.filter((t) => classify(t.term) === "concurrent" && t.cur.cost > 0); return w.length ? warn(`${w.length} recherche(s) de marques concurrentes payées (${eur(w.reduce((s, t) => s + t.cur.cost, 0))}).`) : ok("Pas de recherche concurrente payée."); },
    "Requêtes à fort volume couvertes en exact": () => { const exact = kwAct.filter((k) => k.matchType === "EXACT").reduce((s, k) => s + k.cur.cost, 0); return kwCost ? (exact / kwCost >= 0.7 ? ok(`${pc(exact / kwCost)} du coût en exact.`) : warn(`${pc(exact / kwCost)} du coût seulement en exact.`)) : na("Pas de dépense."); },
    "Négatifs courants absents": () => { const all = d.negatives.map((n) => normKw(n.text)); const miss = ["gratuit", "emploi", "occasion", "formation", "tuto"].filter((w) => !all.some((n) => n.includes(w))); return miss.length ? warn(`Absents : ${miss.join(", ")}.`) : ok("Négatifs courants en place."); },
    "Cannibalisation entre groupes": () => { const by = new Map<string, Set<string>>(); d.terms.forEach((t) => { const k = `${t.campaignId}~${normKw(t.term)}`; by.set(k, new Set([...(by.get(k) ?? []), t.adGroupId])); }); const n = [...by.values()].filter((s) => s.size > 1).length; return n ? bad(`${n} recherche(s) servie(s) par plusieurs groupes d'une campagne.`) : ok("Pas de cannibalisation."); },
    // annonces
    "Deux annonces par groupe": () => {
      if (!d.ads || !d.adGroups) return manual();
      const per = new Map<string, number>(); d.ads.filter((a) => a.status === "ENABLED").forEach((a) => per.set(a.adGroupId, (per.get(a.adGroupId) ?? 0) + 1));
      const one = d.adGroups.filter((g) => (per.get(g.id) ?? 0) < 2);
      return one.length ? (one.some((g) => (per.get(g.id) ?? 0) === 0) ? bad(`${one.length} groupe(s) avec moins de 2 annonces.`) : warn(`${one.length} groupe(s) avec une seule annonce.`)) : ok("Au moins 2 annonces par groupe.");
    },
    "Force des annonces Bonne ou Excellente": () => { if (!d.ads) return manual(); const rsa = d.ads.filter((a) => a.type === "RESPONSIVE_SEARCH_AD" && a.status === "ENABLED"); const poor = rsa.filter((a) => a.strength === "POOR"); const avg = rsa.filter((a) => a.strength === "AVERAGE"); return poor.length ? bad(`${poor.length} annonce(s) « Médiocre ».`) : avg.length ? warn(`${avg.length} annonce(s) « Moyenne ».`) : ok("Annonces Bonnes ou Excellentes."); },
    "CTR des annonces Search hors marque": () => { const ctr = tot.imp ? tot.clicks / tot.imp : 0; return !tot.imp ? na("Pas d'impression.") : ctr >= 0.1 ? ok(`CTR ${pc(ctr)}.`) : ctr < 0.05 ? bad(`CTR ${f1(ctr * 100)} %.`) : warn(`CTR ${f1(ctr * 100)} %.`); },
    "Annonces et composants refusés ou limités": () => {
      if (d.ads === null && d.assets === null) return manual();
      const ads = (d.ads ?? []).filter((a) => a.status === "ENABLED" && ["DISAPPROVED", "APPROVED_LIMITED"].includes(a.approval)).length;
      const as = (d.assets ?? []).filter((a) => ["DISAPPROVED", "APPROVED_LIMITED"].includes(a.approval)).length;
      return ads + as ? bad(`${ads} annonce(s) et ${as} composant(s) refusé(s) ou limité(s).`) : ok("Rien de refusé.");
    },
    "Adresses cassées, redirigées ou en http": () => { if (!d.ads) return manual(); const http = d.ads.flatMap((a) => a.urls).filter((u) => u.startsWith("http:")); return http.length ? bad(`${http.length} adresse(s) en http.`) : warn("Adresses en https ; réponse des pages à vérifier (erreurs 4xx/5xx non lues ici)."); },
    "Extensions minimales": () => { if (d.assets === null) return manual(); const per = new Map<string, number>(); d.assets.filter((a) => a.field === "SITELINK").forEach((a) => per.set(a.campaignId ?? "compte", (per.get(a.campaignId ?? "compte") ?? 0) + 1)); const n = Math.max(0, ...per.values()); return n >= 4 ? ok(`${n} liens annexes.`) : n < 2 ? bad(`${n} lien(s) annexe(s).`) : warn(`${n} liens annexes (4 conseillés).`); },
    "Extension d'appel et de lieu": () => (d.assets === null ? manual() : assetTypes.has("CALL") ? (d.assets.some((a) => a.field === "CALL" && a.approval === "DISAPPROVED") ? bad("Extension d'appel refusée.") : ok("Extension d'appel présente.")) : bad("Pas d'extension d'appel.")),
    "Nombre de titres et descriptions": () => { if (!d.ads) return manual(); const rsa = d.ads.filter((a) => a.type === "RESPONSIVE_SEARCH_AD" && a.status === "ENABLED"); if (!rsa.length) return na("Pas d'annonce responsive."); const min = Math.min(...rsa.map((a) => a.headlines)); return min >= 10 ? ok(`Au moins ${min} titres.`) : min < 5 ? bad(`Une annonce n'a que ${min} titres.`) : warn(`Au moins ${min} titres (10 conseillés).`); },
    "Épinglage excessif": () => { if (!d.ads) return manual(); const w = d.ads.filter((a) => a.pinned > 3); return w.length ? warn(`${w.length} annonce(s) avec plus de 3 éléments épinglés.`) : ok("Épinglage modéré."); },
    "Offre périmée dans les textes": () => { if (!d.ads) return manual(); const y = new Date().getUTCFullYear(); const w = d.ads.filter((a) => /black friday|soldes/i.test(a.text) || new RegExp(`\\b(${y - 1}|${y - 2})\\b`).test(a.text)); return w.length ? bad(`${w.length} annonce(s) avec une offre ou une année passée.`) : ok("Pas d'offre périmée."); },
    // pmax / shopping / display
    "Part de la dépense sur Shopping": () => notPmax("dépense Shopping") ?? manual(),
    "Répartition par canal pour les leads": () => notPmax("canaux") ?? manual(),
    "Exclusion de marque appliquée": () => notPmax("exclusion de marque") ?? manual(),
    "Termes de marque dans la PMax": () => notPmax("termes de marque") ?? manual(),
    "Expansion d'URL finale sans exclusion": () => notPmax("URL finale") ?? manual(),
    "Un seul objectif de conversion": () => notPmax("objectif") ?? manual(),
    "Stratégie cohérente": () => notPmax("stratégie") ?? manual(),
    "Signal d'audience sur chaque groupe d'assets": () => notPmax("signal") ?? manual(),
    "Assets en nombre suffisant": () => notPmax("assets") ?? manual(),
    "Vidéo ajoutée": () => notPmax("vidéo") ?? manual(),
    "Assets générés automatiquement coupés": () => notPmax("assets auto") ?? manual(),
    "Négatifs au niveau de la campagne": () => notPmax("négatifs") ?? manual(),
    "Groupe d'assets qui dépense sans convertir": () => notPmax("groupes d'assets") ?? manual(),
    "Pages de destination PMax sous-performantes": () => notPmax("pages") ?? manual(),
    "Groupes d'assets en flux seul": () => notPmax("flux") ?? manual(),
    "Case « acquisition de nouveaux clients »": () => notPmax("nouveaux clients") ?? manual(),
    "Cannibalisation entre PMax et Search": () => notPmax("cannibalisation") ?? manual(),
    "Titres de la PMax": () => notPmax("titres") ?? manual(),
    // pages
    "Pages qui dépensent sans convertir": () => { if (!d.pages) return manual(); const ref = cpa ?? 60; const w = d.pages.filter((p) => p.conv === 0 && p.cost > 2 * ref); return w.length ? bad(`${w.length} page(s) > ${eur(2 * ref)} sans conversion (ex. ${w[0].url}).`) : ok("Aucune page ne dépense sans convertir au-delà du seuil."); },
    "Pages au taux de conversion faible": () => { if (!d.pages) return manual(); const tc = tot.clicks ? tot.conv / tot.clicks : 0; const w = d.pages.filter((p) => p.clicks >= 200 && p.conv / p.clicks < 0.5 * tc); return w.length ? warn(`${w.length} page(s) à moins de la moitié du taux moyen.`) : ok("Pas de page nettement en dessous."); },
    "Pages adaptées à l'intention": () => { if (!d.pages) return manual(); const top = d.pages.sort((a, b) => b.cost - a.cost)[0]; const share = top && tot.cost ? top.cost / tot.cost : 0; return share > 0.7 && (d.adGroups?.length ?? 0) > 1 ? warn(`${pc(share)} du budget sur une seule page pour plusieurs groupes.`) : ok("Plusieurs pages selon les groupes."); },
    // ciblage
    "Zones en « présence » uniquement": () => { const w = active.filter((c) => (d.settings.get(c.id)?.geo ?? "PRESENCE") !== "PRESENCE" && c.channel !== "PERFORMANCE_MAX"); return w.length ? bad(`« Présence ou intérêt » : ${w.map((c) => c.name).join(", ")}.`) : ok("Ciblage en présence."); },
    "Segments qui gaspillent (appareil, zone, âge)": () => { if (!d.devices) return manual(); const ref = cpa ?? 60; const w = d.devices.filter((x) => x.conv === 0 && x.cost > 2 * ref); return w.length ? warn(`Sans conversion : ${w.map((x) => `${x.device.toLowerCase()} ${eur(x.cost)}`).join(", ")}.`) : ok("Pas d'appareil qui gaspille."); },
    "Mots-clés refusés": () => (d.disapprovedKws === null ? manual() : d.disapprovedKws.length ? bad(`${d.disapprovedKws.length} mot(s)-clé(s) refusé(s) : ${d.disapprovedKws.slice(0, 3).map((k) => `« ${k.text} »`).join(", ")}.`) : ok("Aucun mot-clé refusé.")),
    "Quality Score hors marque": () => {
      if (d.qualityScores === null) return manual();
      const gen = d.qualityScores.filter((k) => !brandWords.some((w) => k.text.toLowerCase().includes(w)));
      const w = gen.reduce((s, k) => s + k.cost, 0);
      if (!gen.length || w <= 0) return na("Pas de mot-clé hors marque avec un niveau de qualité sur 30 jours.");
      const avg = gen.reduce((s, k) => s + k.qs * k.cost, 0) / w;
      const low = gen.filter((k) => k.qs <= 4).sort((a, b) => b.cost - a.cost)[0];
      const txt = `Niveau moyen ${f1(avg)}/10 (pondéré par la dépense)${low ? ` ; à revoir : « ${low.text} » (${low.qs}/10, ${eur(low.cost)})` : ""}.`;
      return avg >= 7 ? ok(txt) : avg < 5 ? bad(txt) : warn(txt);
    },
    "Campagnes en apprentissage ou limitées": () => {
      if (d.campaignStatus === null) return manual();
      const learn = d.campaignStatus.filter((c) => c.status === "LEARNING" || c.reasons.some((r) => /LEARNING/.test(r)));
      const lim = d.campaignStatus.filter((c) => c.status === "LIMITED" || c.reasons.some((r) => /CONSTRAINED|LIMITED/.test(r)));
      if (lim.length) return warn(`Limitée par le budget ou la stratégie : ${lim.slice(0, 3).map((c) => `« ${c.name} »`).join(", ")}.`);
      if (learn.length) return warn(`En apprentissage : ${learn.slice(0, 3).map((c) => `« ${c.name} »`).join(", ")} (éviter de la modifier).`);
      return ok("Aucune campagne en apprentissage ni limitée.");
    },
    "Pages qui répondent": () => {
      if (d.urlChecks === null) return manual();
      if (!d.urlChecks.length) return na("Aucune adresse de destination lue.");
      const dead = d.urlChecks.filter((u) => u.code === null || u.code >= 400);
      return dead.length ? bad(`${dead.length} adresse(s) ne répondent pas correctement : ${dead.slice(0, 3).map((u) => `${u.url} (${u.code ?? "injoignable"})`).join(", ")}.`) : ok(`${d.urlChecks.length} adresse(s) testée(s), toutes répondent.`);
    },
    "Conversions améliorées activées": () => (d.enhancedConversions === null ? manual() : d.enhancedConversions ? ok("Conversions améliorées pour les leads activées.") : warn("Conversions améliorées pour les leads désactivées : Google retrouve moins de leads.")),
    "Vitesse mobile": () => {
      if (!d.speed || !d.speed.length) return manual("Vitesse non mesurée (PageSpeed sans réponse ou pages non lues).");
      const worst = [...d.speed].sort((a, b) => a.score - b.score)[0];
      const txt = `PageSpeed mobile ${worst.score}/100${worst.lcp !== null ? `, affichage principal en ${f1(worst.lcp)} s` : ""} (${worst.url}).`;
      return worst.score >= 50 ? ok(txt) : worst.score < 30 ? bad(txt) : warn(txt);
    },
    "Termes de marque dans les campagnes génériques": () => {
      if (!brandWords.length) return manual("Nom de l'entreprise introuvable : mets-le dans le nom du compte Google Ads ou d'une campagne « marque ».");
      const gen = d.terms.filter((t) => !isBrandCamp(t.campaign));
      const cost = gen.reduce((s, t) => s + t.cur.cost, 0);
      if (cost <= 0) return na("Pas de dépense générique sur les termes lus.");
      const b = gen.filter((t) => hasBrand(t.term)).reduce((s, t) => s + t.cur.cost, 0);
      const sh = b / cost;
      const via = `(marque lue : ${brandWords.slice(0, 3).join(", ")})`;
      return sh < 0.02 ? ok(`${pc(sh)} du coût générique ${via}.`) : sh > 0.05 ? bad(`${pc(sh)} du coût générique (${eur(b)}) part sur des recherches de marque ${via}.`) : warn(`${pc(sh)} du coût générique sur des recherches de marque ${via}.`);
    },
    "Termes génériques dans la campagne marque": () => {
      if (!hasBrandCamp) return na("Pas de campagne « marque » (le mot « marque » ou « brand » n'est dans le nom d'aucune campagne).");
      if (!brandWords.length) return manual("Nom de l'entreprise introuvable.");
      const br = d.terms.filter((t) => isBrandCamp(t.campaign));
      const cost = br.reduce((s, t) => s + t.cur.cost, 0);
      if (cost <= 0) return na("Pas de dépense sur la campagne marque.");
      const g = br.filter((t) => !hasBrand(t.term)).reduce((s, t) => s + t.cur.cost, 0);
      const sh = g / cost;
      return sh > 0.1 ? bad(`${pc(sh)} du coût de la marque (${eur(g)}) vient de recherches génériques.`) : sh > 0.05 ? warn(`${pc(sh)} du coût de la marque vient de recherches génériques.`) : ok(`${pc(sh)} du coût de la marque.`);
    },
    "N-grammes au CTR faible": () => {
      if (!d.terms.length) return na("Pas de termes de recherche lus.");
      const agg = new Map<string, { imp: number; clk: number }>();
      for (const t of d.terms) for (const n of [1, 2]) for (const g of ngrams(t.term, n)) { const e = agg.get(g) ?? { imp: 0, clk: 0 }; e.imp += t.cur.impressions; e.clk += t.cur.clicks; agg.set(g, e); }
      const low = [...agg.entries()].filter(([, v]) => v.imp >= 500 && v.clk / v.imp < 0.03).sort((a, b) => b[1].imp - a[1].imp);
      return low.length ? warn(`${low.length} expression(s) sous 3 % de CTR, ex. « ${low[0][0]} » (${pc(low[0][1].clk / low[0][1].imp)} sur ${f0(low[0][1].imp)} affichages). Voir Termes de recherche → N-grammes.`) : ok("Aucune expression fréquente sous 3 % de CTR.");
    },
    "Import des conversions hors ligne": () => {
      if (d.conversions === null) return manual();
      const up = d.conversions.filter((c) => /UPLOAD/.test(c.type) || /UPLOAD|STORE|CRM/.test(c.origin));
      return up.length ? ok(`Import en place : ${up.slice(0, 2).map((c) => `« ${c.name} »`).join(", ")}.`) : warn("Aucun import de ventes signées (CRM) : Google optimise sur les demandes, pas sur les vrais clients.");
    },
    "Valeur de conversion renseignée et cohérente": () => {
      const v = d.perf30.reduce((s, c) => s + c.cur.value, 0);
      if (tot.conv < 3) return na("Moins de 3 conversions sur 30 jours.");
      const avg = v / tot.conv;
      return avg < 10 ? bad(`Valeur moyenne ${eur(avg)} par conversion (aucune valeur renseignée ou trop basse) : impossible d'enchérir à la valeur.`) : ok(`Valeur moyenne ${eur(avg)} par conversion.`);
    },
    "ROAS réel par rapport à la cible": () => (d.campaigns.some((c) => c.status === "ENABLED" && /ROAS/.test(c.bidding)) ? manual("Enchère au ROAS cible : compare le ROAS réel à la cible dans chaque campagne.") : na("Aucune campagne à l'enchère au ROAS cible.")),
    "Ventes croisées suivies (Merchant Center)": () => notShop ?? manual(),
    "Pics de CPC": () => {
      if (d.daily.length < 10) return manual();
      const days = d.daily.filter((x) => (x.clicks ?? 0) >= 3);
      const clk = d.daily.reduce((s, x) => s + (x.clicks ?? 0), 0);
      const avg = clk ? d.daily.reduce((s, x) => s + x.cost, 0) / clk : 0;
      if (!avg || days.length < 5) return na("Trop peu de clics par jour pour mesurer des pics.");
      const peaks = days.filter((x) => x.cost / (x.clicks ?? 1) > 5 * avg);
      return peaks.length ? bad(`${peaks.length} jour(s) à plus de 5 fois le CPC moyen (${eur(avg)}), ex. le ${peaks[0].date}.`) : ok(`Aucun jour à plus de 5 fois le CPC moyen (${f1(avg)} €).`);
    },
    "Plafond de CPC en enchère automatique": () => {
      if (d.cpcCeilings === null) return manual();
      const clicks = d.cpcCeilings.filter((c) => c.bidding === "TARGET_SPEND");
      if (!clicks.length) return na("Aucune campagne en « maximiser les clics » (le plafond ne concerne que celle-là).");
      const none = clicks.filter((c) => !c.ceiling);
      return none.length ? warn(`Sans plafond de CPC : ${none.slice(0, 3).map((c) => `« ${c.name} »`).join(", ")}.`) : ok("Plafond de CPC défini.");
    },
    "18-24 ans sur une offre B2B": () => {
      if (d.ages === null) return manual();
      const t = d.ages.reduce((s, a) => s + a.cost, 0);
      if (t <= 0) return na("Pas de dépense par âge sur 30 jours.");
      const y = (d.ages.find((a) => a.range === "AGE_RANGE_18_24")?.cost ?? 0) / t;
      return y > 0.1 ? warn(`${pc(y)} du coût sur les 18-24 ans (à exclure si ton offre vise des professionnels).`) : ok(`${pc(y)} du coût sur les 18-24 ans.`);
    },
    "Audiences en observation": () => {
      if (d.audiences === null) return manual();
      const n = d.audiences.length;
      return n >= 5 ? ok(`${n} audiences attachées aux groupes Search.`) : warn(n ? `${n} audience(s) seulement (5 ou plus conseillées).` : "Aucune audience en observation sur les groupes Search.");
    },
    "Audiences Search en ciblage par erreur": () => {
      if (d.audiences === null || d.audienceTargeting === null) return manual();
      if (!d.audiences.length) return na("Aucune audience attachée aux groupes Search.");
      const withAud = new Set(d.audiences.map((a) => a.adGroupId));
      const bad_ = d.audienceTargeting.filter((t) => withAud.has(t.adGroupId) && !t.bidOnly);
      return bad_.length ? bad(`${new Set(bad_.map((b) => b.adGroupId)).size} groupe(s) Search avec une audience en ciblage : elle restreint la diffusion au lieu de l'observer.`) : ok("Audiences en observation uniquement.");
    },
    "Composants générés automatiquement": () => {
      if (d.assetAutomation === null) return manual();
      const on = d.assetAutomation.filter((c) => c.types.length);
      return on.length ? warn(`Création automatique activée : ${on.slice(0, 3).map((c) => `« ${c.campaign} »`).join(", ")} (${[...new Set(on.flatMap((c) => c.types))].join(", ")}).`) : ok("Création automatique désactivée.");
    },
    "Liste de clients importée récemment": () => {
      if (d.crmLists === null) return manual();
      if (!d.crmLists.length) return warn("Aucune liste de clients (Customer Match) : rien à exclure ni à cibler en remarketing.");
      return manual(`${d.crmLists.length} liste(s) de clients (${d.crmLists.slice(0, 2).map((l) => `« ${l.name} » ${f0(l.size)} contacts`).join(", ")}). La date du dernier import n'est pas donnée par Google : à vérifier dans Gestionnaire d'audiences.`);
    },
    "Clients exclus des campagnes d'acquisition": () => {
      if (d.audienceExclusions === null) return manual();
      return d.audienceExclusions ? ok(`${d.audienceExclusions} exclusion(s) d'audience sur les campagnes.`) : warn("Aucune audience exclue : tes clients actuels voient les annonces d'acquisition.");
    },
    "Langues cohérentes avec les annonces": () => {
      if (d.languages === null || d.ads === null) return manual();
      const fr = d.ads.filter((a) => /\b(le|la|les|de|des|pour|votre|vos|et|sur|mesure|devis)\b/i.test(a.text)).length;
      if (!d.ads.length || fr / d.ads.length < 0.7) return manual("Annonces non rédigées en français : compare à la main la langue ciblée.");
      const lack = d.languages.filter((l) => l.ids.length && !l.ids.includes("1002"));
      const none = search.filter((c) => !d.languages!.some((l) => l.campaign === c.name));
      return lack.length ? bad(`Annonces en français mais langue ciblée différente : ${lack.slice(0, 3).map((l) => `« ${l.campaign} »`).join(", ")}.`) : none.length ? warn(`Aucune langue définie : ${none.slice(0, 3).map((c) => `« ${c.name} »`).join(", ")}.`) : ok("Annonces en français, langue ciblée : français.");
    },
    "AI Max sans garde-fous": () => {
      if (d.aiMax === null) return manual();
      const on = d.aiMax.filter((c) => c.on);
      return on.length ? manual(`AI Max actif sur ${on.slice(0, 3).map((c) => `« ${c.campaign} »`).join(", ")} : vérifie les exclusions de marque et d'URL dans chaque campagne.`) : na("AI Max n'est activé sur aucune campagne Search.");
    },
    "AI Max sans Smart Bidding": () => {
      if (d.aiMax === null) return manual();
      const on = d.aiMax.filter((c) => c.on);
      if (!on.length) return na("AI Max n'est activé sur aucune campagne Search.");
      const click = on.filter((c) => { const b = d.campaigns.find((x) => x.name === c.campaign)?.bidding ?? ""; return ["MANUAL_CPC", "MAXIMIZE_CLICKS", "TARGET_SPEND"].includes(b); });
      return click.length ? bad(`AI Max sur une enchère au clic : ${click.slice(0, 3).map((c) => `« ${c.campaign} »`).join(", ")}.`) : ok("AI Max uniquement avec une enchère automatique aux conversions.");
    },
    "Une campagne, un objectif": () => {
      if (d.goals === null) return manual();
      if (!d.goals.length) return na("Aucun objectif de conversion lu.");
      const multi = d.goals.filter((g) => g.categories.length > 1);
      return multi.length ? warn(`${multi.length} campagne(s) avec plusieurs objectifs qui pilotent l'enchère, ex. « ${multi[0].campaign} » : ${multi[0].categories.join(", ").toLowerCase()}.`) : ok("Un seul objectif de conversion par campagne.");
    },
    "Une seule action de conversion pilote l'enchère": () => {
      if (d.goals === null) return manual();
      if (!d.goals.length) return na("Aucun objectif de conversion lu.");
      const mixed = d.goals.filter((g) => g.categories.some((c) => /PURCHASE|ADD_TO_CART|BEGIN_CHECKOUT/.test(c)) && g.categories.some((c) => /LEAD|CONTACT|PHONE|SIGNUP|PAGE_VIEW/.test(c)));
      return mixed.length ? bad(`Ventes et demandes mélangées dans « ${mixed[0].campaign} » : ${mixed[0].categories.join(", ").toLowerCase()}.`) : ok("Pas d'objectifs de nature différente mélangés.");
    },
    "Composants peu diffusés": () => (d.lowAssets === null ? manual() : d.lowAssets ? warn(`${d.lowAssets} composant(s) d'annonce noté(s) « Faible » par Google : à remplacer (titres et descriptions).`) : ok("Aucun composant noté « Faible » par Google.")),
    "Règles de valeur si enchère à la valeur": () => {
      if (d.valueRules === null) return manual();
      const valueBid = d.campaigns.some((c) => c.status === "ENABLED" && /ROAS|VALUE/.test(c.bidding));
      return !valueBid ? na("Aucune enchère à la valeur : les règles de valeur ne servent pas.") : d.valueRules ? ok(`${d.valueRules} règle(s) de valeur.`) : warn("Enchère à la valeur sans règle de valeur.");
    },
    "Mots-clés trop chers": () => {
      const by = new Map<string, { cost: number; conv: number }>();
      for (const k of kwAct) { const e = by.get(k.adGroupId) ?? { cost: 0, conv: 0 }; e.cost += k.cur.cost; e.conv += k.cur.conversions; by.set(k.adGroupId, e); }
      const bad_ = kwAct.filter((k) => { const g = by.get(k.adGroupId); return k.cur.conversions >= 5 && g && g.conv > 0 && k.cur.cost / k.cur.conversions > 1.5 * (g.cost / g.conv); });
      if (!kwAct.some((k) => k.cur.conversions >= 5)) return na("Aucun mot-clé avec 5 conversions ou plus sur 30 jours.");
      return bad_.length ? bad(`${bad_.length} mot(s)-clé(s) à plus de 1,5 fois le CPA de leur groupe, ex. « ${bad_[0].text} ».`) : ok("Aucun mot-clé nettement plus cher que son groupe.");
    },
    "Calendrier de diffusion": () => (d.schedules === null ? manual() : search.every((c) => d.schedules!.has(c.id)) ? ok("Calendrier défini.") : warn("Diffusion 24 h/24 : caler les horaires sur ceux où l'entreprise répond.")),
    // tendances
    "Chute des conversions": () => (prev.conv < 20 ? warn(`Volume faible (${f0(prev.conv)} conversions avant) : écart ${prev.conv ? pc(tot.conv / prev.conv - 1) : "–"}.`) : tot.conv / prev.conv - 1 <= -0.3 ? bad(`Conversions ${pc(tot.conv / prev.conv - 1)}.`) : ok(`Conversions ${pc(tot.conv / prev.conv - 1)}.`)),
    "Hausse du coût par conversion": () => { if (tot.conv < 10 || prev.conv < 10) return warn("Moins de 10 conversions : écart non significatif."); const r = (tot.cost / tot.conv) / (prev.cost / prev.conv) - 1; return r >= 0.3 ? bad(`CPA ${r > 0 ? "+" : ""}${pc(r)}.`) : ok(`CPA ${r > 0 ? "+" : ""}${pc(r)}.`); },
    "Hausse du CPC": () => { if (!tot.clicks || !prev.clicks) return na("Pas assez de clics."); const r = (tot.cost / tot.clicks) / (prev.cost / prev.clicks) - 1; return r >= 0.3 ? warn(`CPC +${pc(r)}.`) : ok(`CPC ${r > 0 ? "+" : ""}${pc(r)}.`); },
    "Baisse du CTR": () => { if (tot.imp < 1000 || !prev.imp) return na("Moins de 1 000 impressions."); const r = (tot.clicks / tot.imp) / (prev.clicks / prev.imp) - 1; return r <= -0.3 ? warn(`CTR ${pc(r)}.`) : ok(`CTR ${r > 0 ? "+" : ""}${pc(r)}.`); },
    "Baisse de la part d'impressions": () => { const s = (k: "cur" | "prev") => { const e = d.perf30.reduce((a, c) => a + c[k].eligible, 0); return e ? d.perf30.reduce((a, c) => a + c[k].impressions, 0) / e : null; }; const a = s("prev"), b = s("cur"); if (a === null || b === null) return na("Pas de part d'impressions."); return b - a <= -0.1 ? warn(`${Math.round((b - a) * 100)} points.`) : ok(`${b - a >= 0 ? "+" : ""}${Math.round((b - a) * 100)} point(s).`); },
  };
  void model; void notShop; void notDisplay;
  // Shopping / Display : non applicable sans ce type de campagne
  for (const c of AUDIT_GRID) {
    if (c.key === "shopping" && notShop) c.items.forEach((it) => { E[it.label] = () => notShop; });
    if (c.key === "display" && notDisplay) c.items.forEach((it) => { E[it.label] = () => notDisplay; });
  }
  return E;
}

const W: Record<Criterion["sev"], number> = { haut: 3, moyen: 2, bas: 1 };

export function evaluate(d: ScanData, model: Model, off: Set<string>, skipped: string[]): ScanResult {
  const E = evaluators(d, model);
  const items: ScanItem[] = [];
  let got = 0, max = 0;
  const counts: Record<ScanStatus, number> = { ok: 0, warn: 0, bad: 0, manual: 0, na: 0 };
  for (const cat of activeCriteria(model, off)) {
    for (const it of cat.items) {
      let out: Out;
      try { out = E[it.label]?.() ?? (it.ia ? manual("Jugement qualitatif : à relire (ou demander au Copilote).") : manual()); }
      catch (e) { out = manual(`Non évalué (${e instanceof Error ? e.message.slice(0, 60) : "erreur"}).`); }
      counts[out.status]++;
      if (out.status === "ok" || out.status === "warn" || out.status === "bad") {
        max += W[it.sev];
        got += W[it.sev] * (out.status === "ok" ? 1 : out.status === "warn" ? 0.5 : 0);
      }
      items.push({ id: it.id, status: out.status, detail: out.detail.slice(0, 220) });
    }
  }
  return { at: new Date().toISOString(), model, score: max ? Math.round((got / max) * 100) : 0, counts, items, skipped };
}
