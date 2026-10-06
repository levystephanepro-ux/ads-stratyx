// Création d'une campagne Search EN PAUSE, en une seule opération atomique
// (googleAds:mutate) : budget, campagne, lieux, langue, groupe, mots-clés, annonce.
import { adsPost } from "@/lib/google-ads/client";
import { LANG_FR } from "./ideas";

export interface CampaignSpec {
  name: string;
  dailyBudget: number;
  bidding: "MAXIMIZE_CLICKS" | "MAXIMIZE_CONVERSIONS" | "MANUAL_CPC";
  maxCpc: number | null;
  geoIds: string[];
  keywords: string[];
  matchType: "PHRASE" | "EXACT" | "BROAD";
  finalUrl: string;
  headlines: string[];
  descriptions: string[];
  path1?: string;
  path2?: string;
  /** id languageConstant (défaut 1002 = français) */
  languageId?: string;
}

/** Contrôles avant envoi : renvoie la liste des problèmes (vide = OK). */
export function validateSpec(s: CampaignSpec): string[] {
  const p: string[] = [];
  if (!s.name.trim()) p.push("Nom de campagne manquant.");
  if (!(s.dailyBudget >= 1)) p.push("Budget quotidien d'au moins 1 €.");
  if (s.bidding === "MANUAL_CPC" && !(s.maxCpc && s.maxCpc > 0)) p.push("CPC max requis en enchères manuelles.");
  if (!s.geoIds.length) p.push("Choisis au moins un lieu.");
  if (!s.keywords.length) p.push("Choisis au moins un mot-clé.");
  if (s.keywords.length > 80) p.push("80 mots-clés maximum par groupe ici.");
  s.keywords.forEach((k) => { if (k.length > 80 || k.split(/\s+/).length > 10) p.push(`Mot-clé trop long : « ${k} ».`); });
  if (!/^https:\/\/[^\s]+\.[^\s]+/.test(s.finalUrl)) p.push("URL finale en https:// requise.");
  if (s.headlines.length < 3 || s.headlines.length > 15) p.push("Entre 3 et 15 titres.");
  s.headlines.forEach((h) => { if (h.length > 30) p.push(`Titre de plus de 30 caractères : « ${h} » (${h.length}).`); });
  if (s.descriptions.length < 2 || s.descriptions.length > 4) p.push("Entre 2 et 4 descriptions.");
  s.descriptions.forEach((d) => { if (d.length > 90) p.push(`Description de plus de 90 caractères (${d.length}).`); });
  if ((s.path1 ?? "").length > 15 || (s.path2 ?? "").length > 15) p.push("Chemins d'URL : 15 caractères maximum.");
  return p;
}

const micros = (eur: number) => String(Math.round(eur * 1e6));

export async function createPausedSearchCampaign(customerId: string, s: CampaignSpec, validateOnly = false): Promise<{ campaign: string | null }> {
  const c = `customers/${customerId}`;
  const budget = `${c}/campaignBudgets/-1`, campaign = `${c}/campaigns/-2`, adGroup = `${c}/adGroups/-3`;
  const bidding =
    s.bidding === "MANUAL_CPC" ? { manualCpc: {} }
    : s.bidding === "MAXIMIZE_CONVERSIONS" ? { maximizeConversions: {} }
    : { targetSpend: s.maxCpc ? { cpcBidCeilingMicros: micros(s.maxCpc) } : {} };

  const ops: unknown[] = [
    { campaignBudgetOperation: { create: { resourceName: budget, name: `${s.name} · budget ${new Date().toISOString().slice(0, 16)}`, amountMicros: micros(s.dailyBudget), deliveryMethod: "STANDARD", explicitlyShared: false } } },
    { campaignOperation: { create: {
      resourceName: campaign, name: s.name, status: "PAUSED", advertisingChannelType: "SEARCH", campaignBudget: budget,
      networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
      geoTargetTypeSetting: { positiveGeoTargetType: "PRESENCE", negativeGeoTargetType: "PRESENCE" },
      containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
      ...bidding,
    } } },
    ...s.geoIds.map((g) => ({ campaignCriterionOperation: { create: { campaign, location: { geoTargetConstant: `geoTargetConstants/${g}` } } } })),
    { campaignCriterionOperation: { create: { campaign, language: { languageConstant: s.languageId && /^\d+$/.test(s.languageId) ? `languageConstants/${s.languageId}` : LANG_FR } } } },
    { adGroupOperation: { create: {
      resourceName: adGroup, campaign, name: "Groupe 1", status: "ENABLED", type: "SEARCH_STANDARD",
      ...(s.bidding === "MANUAL_CPC" && s.maxCpc ? { cpcBidMicros: micros(s.maxCpc) } : {}),
    } } },
    ...s.keywords.map((k) => ({ adGroupCriterionOperation: { create: { adGroup, status: "ENABLED", keyword: { text: k, matchType: s.matchType } } } })),
    { adGroupAdOperation: { create: { adGroup, status: "ENABLED", ad: {
      finalUrls: [s.finalUrl],
      responsiveSearchAd: {
        headlines: s.headlines.map((text) => ({ text })),
        descriptions: s.descriptions.map((text) => ({ text })),
        ...(s.path1 ? { path1: s.path1 } : {}), ...(s.path2 ? { path2: s.path2 } : {}),
      },
    } } } },
  ];

  const j = await adsPost(null, `${c}/googleAds:mutate`, { mutateOperations: ops, validateOnly });
  const res = (j.mutateOperationResponses ?? []) as { campaignResult?: { resourceName?: string } }[];
  return { campaign: res.find((r) => r.campaignResult?.resourceName)?.campaignResult?.resourceName ?? null };
}
