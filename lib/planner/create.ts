// Création d'une campagne Search EN PAUSE, en une seule opération atomique
// (googleAds:mutate) : budget, campagne, lieux, langue, négatifs, puis pour
// chaque groupe ses mots-clés et son annonce responsive.
import { adsPost } from "@/lib/google-ads/client";
import { LANG_FR } from "./ideas";

export interface AdGroupSpec {
  name: string;
  keywords: string[];
  headlines: string[];
  descriptions: string[];
  path1?: string;
  path2?: string;
}

export interface CampaignSpec {
  name: string;
  dailyBudget: number;
  bidding: "MAXIMIZE_CLICKS" | "MAXIMIZE_CONVERSIONS" | "MANUAL_CPC";
  maxCpc: number | null;
  geoIds: string[];
  matchType: "PHRASE" | "EXACT" | "BROAD";
  finalUrl: string;
  groups: AdGroupSpec[];
  /** négatifs de campagne (correspondance expression) */
  negatives: string[];
  /** id languageConstant (défaut 1002 = français) */
  languageId?: string;
  /** noms des lieux (export Google Ads Editor) */
  geoNames?: string[];
  extensions?: Extensions;
}

export interface Sitelink { text: string; desc1: string; desc2: string; url: string }
export interface Schedule { days: number[]; startHour: number; endHour: number } // jours 1 = lundi … 7 = dimanche
export interface Extensions {
  phone?: string;
  sitelinks?: Sitelink[];
  callouts?: string[];
  schedule?: Schedule | null;
}

export const DAY_NAMES = ["", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
export const DAY_FR = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const normPhone = (v: string) => v.replace(/[^\d+]/g, "");

/** Contrôles avant envoi : renvoie la liste des problèmes (vide = OK). */
export function validateSpec(s: CampaignSpec): string[] {
  const p: string[] = [];
  if (!s.name.trim()) p.push("Nom de campagne manquant.");
  if (!(s.dailyBudget >= 1)) p.push("Budget quotidien d'au moins 1 €.");
  if (s.bidding === "MANUAL_CPC" && !(s.maxCpc && s.maxCpc > 0)) p.push("CPC max requis en enchères manuelles.");
  if (!s.geoIds.length) p.push("Choisis au moins un lieu.");
  if (!/^https:\/\/[^\s]+\.[^\s]+/.test(s.finalUrl)) p.push("URL finale en https:// requise.");
  if (!s.groups.length) p.push("Au moins un groupe d'annonces.");
  if (s.groups.length > 20) p.push("20 groupes maximum.");
  const names = new Set<string>();
  s.groups.forEach((g, i) => {
    const n = g.name.trim() || `Groupe ${i + 1}`;
    if (names.has(n)) p.push(`Deux groupes s'appellent « ${n} ».`);
    names.add(n);
    if (!g.keywords.length) p.push(`« ${n} » : aucun mot-clé.`);
    if (g.keywords.length > 80) p.push(`« ${n} » : 80 mots-clés maximum.`);
    g.keywords.forEach((k) => { if (k.length > 80 || k.split(/\s+/).length > 10) p.push(`« ${n} » : mot-clé trop long « ${k} ».`); });
    if (g.headlines.length < 3 || g.headlines.length > 15) p.push(`« ${n} » : entre 3 et 15 titres (${g.headlines.length}).`);
    g.headlines.forEach((h) => { if (h.length > 30) p.push(`« ${n} » : titre de ${h.length} caractères « ${h} » (30 max).`); });
    if (g.descriptions.length < 2 || g.descriptions.length > 4) p.push(`« ${n} » : entre 2 et 4 descriptions (${g.descriptions.length}).`);
    g.descriptions.forEach((d) => { if (d.length > 90) p.push(`« ${n} » : description de ${d.length} caractères (90 max).`); });
    if ((g.path1 ?? "").length > 15 || (g.path2 ?? "").length > 15) p.push(`« ${n} » : chemins d'URL de 15 caractères maximum.`);
  });
  s.negatives.forEach((k) => { if (k.length > 80) p.push(`Négatif trop long « ${k} ».`); });
  const x = s.extensions;
  if (x) {
    if (x.phone && !/^(\+33|0)\d{9}$/.test(normPhone(x.phone))) p.push("Téléphone : format français attendu (ex. 04 94 00 00 00).");
    (x.sitelinks ?? []).forEach((l, i) => {
      if (!l.text || l.text.length > 25) p.push(`Lien annexe ${i + 1} : titre de 1 à 25 caractères requis.`);
      if (l.desc1.length > 35 || l.desc2.length > 35) p.push(`Lien annexe ${i + 1} : descriptions de 35 caractères maximum.`);
      if ((l.desc1 && !l.desc2) || (!l.desc1 && l.desc2)) p.push(`Lien annexe ${i + 1} : remplis les deux descriptions ou aucune.`);
      if (!/^https:\/\/[^\s]+\.[^\s]+/.test(l.url)) p.push(`Lien annexe ${i + 1} : URL en https:// requise.`);
    });
    (x.callouts ?? []).forEach((c, i) => { if (!c || c.length > 25) p.push(`Accroche ${i + 1} : 1 à 25 caractères (« ${c} »).`); });
    if (x.schedule) {
      const h = x.schedule;
      if (!h.days.length) p.push("Horaires : choisis au moins un jour.");
      if (!(h.startHour >= 0 && h.endHour <= 24 && h.startHour < h.endHour)) p.push("Horaires : heure de début avant l'heure de fin (0 à 24).");
    }
  }
  return p;
}

const micros = (eur: number) => String(Math.round(eur * 1e6));

export async function createPausedSearchCampaign(customerId: string, s: CampaignSpec, validateOnly = false): Promise<{ campaign: string | null }> {
  const c = `customers/${customerId}`;
  const budget = `${c}/campaignBudgets/-1`, campaign = `${c}/campaigns/-2`;
  const bidding =
    s.bidding === "MANUAL_CPC" ? { manualCpc: {} }
    : s.bidding === "MAXIMIZE_CONVERSIONS" ? { maximizeConversions: {} }
    : { targetSpend: s.maxCpc ? { cpcBidCeilingMicros: micros(s.maxCpc) } : {} };
  const lang = s.languageId && /^\d+$/.test(s.languageId) ? `languageConstants/${s.languageId}` : LANG_FR;

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
    { campaignCriterionOperation: { create: { campaign, language: { languageConstant: lang } } } },
    ...s.negatives.map((k) => ({ campaignCriterionOperation: { create: { campaign, negative: true, keyword: { text: k, matchType: "PHRASE" } } } })),
  ];
  const x = s.extensions;
  if (x?.schedule) {
    for (const d of x.schedule.days) ops.push({ campaignCriterionOperation: { create: { campaign, adSchedule: { dayOfWeek: DAY_NAMES[d], startHour: x.schedule.startHour, startMinute: "ZERO", endHour: x.schedule.endHour, endMinute: "ZERO" } } } });
  }
  let assetId = 100;
  const addAsset = (field: "SITELINK" | "CALLOUT" | "CALL", asset: Record<string, unknown>) => {
    const rn = `${c}/assets/-${assetId++}`;
    ops.push({ assetOperation: { create: { resourceName: rn, ...asset } } });
    ops.push({ campaignAssetOperation: { create: { campaign, asset: rn, fieldType: field } } });
  };
  (x?.sitelinks ?? []).forEach((l) => addAsset("SITELINK", { finalUrls: [l.url], sitelinkAsset: { linkText: l.text, ...(l.desc1 ? { description1: l.desc1, description2: l.desc2 } : {}) } }));
  (x?.callouts ?? []).forEach((t) => addAsset("CALLOUT", { calloutAsset: { calloutText: t } }));
  if (x?.phone) {
    const n = normPhone(x.phone);
    addAsset("CALL", { callAsset: { countryCode: "FR", phoneNumber: n.startsWith("+33") ? "0" + n.slice(3) : n } });
  }
  s.groups.forEach((g, i) => {
    const adGroup = `${c}/adGroups/-${10 + i}`;
    ops.push({ adGroupOperation: { create: {
      resourceName: adGroup, campaign, name: g.name.trim() || `Groupe ${i + 1}`, status: "ENABLED", type: "SEARCH_STANDARD",
      ...(s.bidding === "MANUAL_CPC" && s.maxCpc ? { cpcBidMicros: micros(s.maxCpc) } : {}),
    } } });
    g.keywords.forEach((k) => ops.push({ adGroupCriterionOperation: { create: { adGroup, status: "ENABLED", keyword: { text: k, matchType: s.matchType } } } }));
    ops.push({ adGroupAdOperation: { create: { adGroup, status: "ENABLED", ad: {
      finalUrls: [s.finalUrl],
      responsiveSearchAd: {
        headlines: g.headlines.map((text) => ({ text })),
        descriptions: g.descriptions.map((text) => ({ text })),
        ...(g.path1 ? { path1: g.path1 } : {}), ...(g.path2 ? { path2: g.path2 } : {}),
      },
    } } } });
  });

  const j = await adsPost({ customerId }, `${c}/googleAds:mutate`, { mutateOperations: ops, validateOnly });
  const res = (j.mutateOperationResponses ?? []) as { campaignResult?: { resourceName?: string } }[];
  return { campaign: res.find((r) => r.campaignResult?.resourceName)?.campaignResult?.resourceName ?? null };
}
