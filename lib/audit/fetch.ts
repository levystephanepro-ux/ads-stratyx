// Lecture des données du diagnostic via l'API Google Ads (lecture seule).
// Chaque requête est isolée : si l'une échoue (champ indisponible, droits…),
// les autres vérifications tournent quand même et l'échec est signalé.
import { isLive } from "@/lib/google-ads/config";
import { getAllSearchTerms, searchRaw, type AdsContext, type RawRow } from "@/lib/google-ads/client";
import { MOCK_AUDIT_DATA } from "./mock";
import type { AuditData, AuditResult } from "./types";

const micros = (v: unknown) => Number(v ?? 0) / 1_000_000;
const num = (v: unknown) => Number(v ?? 0);
const share = (v: unknown) => (v === undefined || v === null ? null : Number(v));

export function last30Days() {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const until = new Date();
  until.setUTCDate(until.getUTCDate() - 1); // la journée en cours est incomplète
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - 29);
  return { since: iso(since), until: iso(until) };
}

export async function fetchAuditData(
  ctx: AdsContext,
): Promise<{ data: AuditData; skipped: AuditResult["skipped"] }> {
  if (!isLive()) return { data: MOCK_AUDIT_DATA, skipped: [] };

  const { since, until } = last30Days();
  const during = `segments.date BETWEEN '${since}' AND '${until}'`;
  const skipped: AuditResult["skipped"] = [];

  async function q<T>(check: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      skipped.push({ check, reason: e instanceof Error ? e.message : String(e) });
      return fallback;
    }
  }

  const [searchTerms, kwDef, kwPerf, campNeg, adGroupNeg, sharedLinks, sharedCrit, camps, ads, assets, daily, convActions] =
    await Promise.all([
      q("Termes de recherche", () => getAllSearchTerms(ctx, { since, until }), []),
      q("Mots-clés", () => searchRaw(ctx, `
        SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_criterion.criterion_id,
               ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
               ad_group_criterion.quality_info.quality_score
        FROM ad_group_criterion
        WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE
          AND ad_group_criterion.status = 'ENABLED' AND ad_group.status = 'ENABLED'
          AND campaign.status = 'ENABLED'`), [] as RawRow[]),
      q("Performances des mots-clés", () => searchRaw(ctx, `
        SELECT ad_group.id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
               metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
        FROM keyword_view
        WHERE ${during} AND campaign.status = 'ENABLED' AND ad_group_criterion.status = 'ENABLED'`), [] as RawRow[]),
      q("Négatifs de campagne", () => searchRaw(ctx, `
        SELECT campaign.id, campaign.name, campaign_criterion.resource_name, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
        FROM campaign_criterion
        WHERE campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE
          AND campaign.status = 'ENABLED'`), [] as RawRow[]),
      q("Négatifs de groupe", () => searchRaw(ctx, `
        SELECT campaign.id, campaign.name, ad_group.id, ad_group_criterion.resource_name, ad_group_criterion.keyword.text,
               ad_group_criterion.keyword.match_type
        FROM ad_group_criterion
        WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = TRUE
          AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'`), [] as RawRow[]),
      q("Listes de négatifs", () => searchRaw(ctx, `
        SELECT campaign.id, campaign.name, shared_set.id, shared_set.name
        FROM campaign_shared_set
        WHERE shared_set.type = 'NEGATIVE_KEYWORDS' AND campaign_shared_set.status = 'ENABLED'
          AND campaign.status = 'ENABLED'`), [] as RawRow[]),
      q("Contenu des listes de négatifs", () => searchRaw(ctx, `
        SELECT shared_set.id, shared_criterion.keyword.text, shared_criterion.keyword.match_type
        FROM shared_criterion
        WHERE shared_set.type = 'NEGATIVE_KEYWORDS' AND shared_criterion.type = 'KEYWORD'`), [] as RawRow[]),
      q("Campagnes et budgets", () => searchRaw(ctx, `
        SELECT campaign.id, campaign.name, campaign.advertising_channel_type, campaign_budget.amount_micros,
               metrics.cost_micros, metrics.clicks, metrics.conversions,
               metrics.search_impression_share, metrics.search_budget_lost_impression_share,
               metrics.search_rank_lost_impression_share
        FROM campaign
        WHERE ${during} AND campaign.status = 'ENABLED'`), [] as RawRow[]),
      q("Annonces refusées", () => searchRaw(ctx, `
        SELECT campaign.name, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.name,
               ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.policy_topic_entries
        FROM ad_group_ad
        WHERE ad_group_ad.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
          AND ad_group_ad.policy_summary.approval_status IN ('DISAPPROVED', 'APPROVED_LIMITED')`), [] as RawRow[]),
      q("Extensions refusées", () => searchRaw(ctx, `
        SELECT asset.id, asset.type, asset.name, asset.call_asset.phone_number,
               asset.sitelink_asset.link_text, asset.callout_asset.callout_text,
               asset.policy_summary.approval_status, asset.policy_summary.policy_topic_entries
        FROM asset
        WHERE asset.type IN ('CALL', 'SITELINK', 'CALLOUT', 'STRUCTURED_SNIPPET', 'IMAGE', 'LEAD_FORM')`), [] as RawRow[]),
      q("Conversions jour par jour", () => searchRaw(ctx, `
        SELECT segments.date, metrics.clicks, metrics.conversions, metrics.cost_micros
        FROM customer
        WHERE ${during}`), [] as RawRow[]),
      q("Actions de conversion", () => searchRaw(ctx, `
        SELECT conversion_action.id, conversion_action.status
        FROM conversion_action
        WHERE conversion_action.status = 'ENABLED'`), null as RawRow[] | null),
    ]);

  // Mots-clés : définition (tous, même à 0 impression) + performances 30 j
  const perf = new Map<string, RawRow>();
  for (const r of kwPerf) {
    const k = `${r.adGroup?.id}|${r.adGroupCriterion?.keyword?.text}|${r.adGroupCriterion?.keyword?.matchType}`;
    const prev = perf.get(k);
    if (!prev) perf.set(k, r);
    else {
      prev.metrics.costMicros = num(prev.metrics?.costMicros) + num(r.metrics?.costMicros);
      prev.metrics.clicks = num(prev.metrics?.clicks) + num(r.metrics?.clicks);
      prev.metrics.impressions = num(prev.metrics?.impressions) + num(r.metrics?.impressions);
      prev.metrics.conversions = num(prev.metrics?.conversions) + num(r.metrics?.conversions);
    }
  }
  const keywords: AuditData["keywords"] = kwDef.map((r) => {
    const text = r.adGroupCriterion?.keyword?.text ?? "";
    const matchType = r.adGroupCriterion?.keyword?.matchType ?? "BROAD";
    const m = perf.get(`${r.adGroup?.id}|${text}|${matchType}`)?.metrics ?? {};
    const qs = r.adGroupCriterion?.qualityInfo?.qualityScore;
    return {
      campaign: r.campaign?.name ?? "",
      campaignId: String(r.campaign?.id ?? ""),
      adGroup: r.adGroup?.name ?? "",
      adGroupId: String(r.adGroup?.id ?? ""),
      criterionId: r.adGroupCriterion?.criterionId ? String(r.adGroupCriterion.criterionId) : undefined,
      text,
      matchType,
      qualityScore: qs === undefined || qs === null ? null : Number(qs),
      cost: micros(m.costMicros),
      clicks: num(m.clicks),
      impressions: num(m.impressions),
      conversions: num(m.conversions),
    };
  });

  // Négatifs : campagne, groupe, listes partagées rattachées aux campagnes
  const sharedContent = new Map<string, { text: string; matchType: string }[]>();
  for (const r of sharedCrit) {
    const id = String(r.sharedSet?.id ?? "");
    const arr = sharedContent.get(id) ?? [];
    arr.push({ text: r.sharedCriterion?.keyword?.text ?? "", matchType: r.sharedCriterion?.keyword?.matchType ?? "BROAD" });
    sharedContent.set(id, arr);
  }
  const negatives: AuditData["negatives"] = [
    ...campNeg.map((r) => ({
      level: "campaign" as const,
      campaignId: String(r.campaign?.id ?? ""),
      campaign: r.campaign?.name ?? "",
      resourceName: r.campaignCriterion?.resourceName,
      text: r.campaignCriterion?.keyword?.text ?? "",
      matchType: r.campaignCriterion?.keyword?.matchType ?? "BROAD",
    })),
    ...adGroupNeg.map((r) => ({
      level: "ad_group" as const,
      campaignId: String(r.campaign?.id ?? ""),
      campaign: r.campaign?.name ?? "",
      adGroupId: String(r.adGroup?.id ?? ""),
      resourceName: r.adGroupCriterion?.resourceName,
      text: r.adGroupCriterion?.keyword?.text ?? "",
      matchType: r.adGroupCriterion?.keyword?.matchType ?? "BROAD",
    })),
    ...sharedLinks.flatMap((r) =>
      (sharedContent.get(String(r.sharedSet?.id ?? "")) ?? []).map((n) => ({
        level: "shared" as const,
        campaignId: String(r.campaign?.id ?? ""),
        campaign: r.campaign?.name ?? "",
        sharedSet: r.sharedSet?.name ?? "",
        text: n.text,
        matchType: n.matchType,
      })),
    ),
  ];

  const campaigns: AuditData["campaigns"] = camps.map((r) => ({
    id: String(r.campaign?.id ?? ""),
    name: r.campaign?.name ?? "",
    channel: r.campaign?.advertisingChannelType ?? "OTHER",
    dailyBudget: micros(r.campaignBudget?.amountMicros),
    cost: micros(r.metrics?.costMicros),
    clicks: num(r.metrics?.clicks),
    conversions: num(r.metrics?.conversions),
    impressionShare: share(r.metrics?.searchImpressionShare),
    lostBudget: share(r.metrics?.searchBudgetLostImpressionShare),
    lostRank: share(r.metrics?.searchRankLostImpressionShare),
  }));

  const topics = (entries: unknown): string[] =>
    Array.isArray(entries)
      ? entries.map((e: RawRow) => String(e.topic ?? "")).filter(Boolean)
      : [];

  const policy: AuditData["policy"] = [
    ...ads.map((r) => ({
      kind: "annonce" as const,
      campaign: r.campaign?.name ?? null,
      label: r.adGroupAd?.ad?.name || `${r.adGroup?.name ?? "annonce"} #${r.adGroupAd?.ad?.id ?? ""}`,
      status: r.adGroupAd?.policySummary?.approvalStatus ?? "",
      reasons: topics(r.adGroupAd?.policySummary?.policyTopicEntries),
    })),
    ...assets
      .filter((r) => ["DISAPPROVED", "APPROVED_LIMITED"].includes(r.asset?.policySummary?.approvalStatus))
      .map((r) => ({
        kind: "extension" as const,
        campaign: null,
        label:
          r.asset?.callAsset?.phoneNumber ??
          r.asset?.sitelinkAsset?.linkText ??
          r.asset?.calloutAsset?.calloutText ??
          r.asset?.name ??
          `${r.asset?.type ?? "extension"} #${r.asset?.id ?? ""}`,
        status: r.asset?.policySummary?.approvalStatus ?? "",
        reasons: topics(r.asset?.policySummary?.policyTopicEntries),
      })),
  ];

  const data: AuditData = {
    searchTerms,
    keywords,
    negatives,
    campaigns,
    policy,
    daily: daily.map((r) => ({
      date: r.segments?.date ?? "",
      clicks: num(r.metrics?.clicks),
      conversions: num(r.metrics?.conversions),
      cost: micros(r.metrics?.costMicros),
    })),
    conversionActions: convActions ? convActions.length : null,
  };
  return { data, skipped };
}
