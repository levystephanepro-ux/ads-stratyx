// Données de démonstration des pages Optimiser / Analyser (mode mock) :
// un compte de menuiserie avec une campagne Search active et une en pause.
import type { CampaignLite, CampaignPerf, DayRow, KeywordRow, Metrics, NegativeRow, TermRow } from "./data";

const C1 = { id: "2401", name: "D2B - Fenêtres - La-Farlède" };
const C2 = { id: "2402", name: "D2B - Vérandas et pergolas" };
const AG = { id: "7701", name: "Groupe d'annonces Fenêtres" };

export const CAMPAIGNS: CampaignLite[] = [
  { ...C1, status: "ENABLED", channel: "SEARCH", dailyBudget: 30, bidding: "MAXIMIZE_CONVERSIONS" },
  { ...C2, status: "PAUSED", channel: "SEARCH", dailyBudget: 15, bidding: "MAXIMIZE_CLICKS" },
];

const m = (impressions: number, clicks: number, cost: number, conversions = 0): Metrics => ({ impressions, clicks, cost, conversions, value: 0 });
const scale = (x: Metrics, f: number): Metrics => ({ impressions: Math.round(x.impressions * f), clicks: Math.round(x.clicks * f), cost: +(x.cost * f).toFixed(2), conversions: x.conversions, value: 0 });

// texte, type, QS, ctr, annonce, page, 1re page, haut de page, métriques (7 j)
const KW: [string, string, number | null, string, string, string, number, number, Metrics][] = [
  ["porte fenetre", "PHRASE", 3, "BELOW_AVERAGE", "AVERAGE", "BELOW_AVERAGE", 0.69, 3.31, m(278, 19, 87.99)],
  ["fenetre pvc double vitrage", "PHRASE", 2, "BELOW_AVERAGE", "BELOW_AVERAGE", "AVERAGE", 0.65, 2.44, m(26, 2, 25.3)],
  ["fenetre double vitrage prix", "PHRASE", 5, "AVERAGE", "AVERAGE", "AVERAGE", 0.47, 1.6, m(81, 5, 17.19)],
  ["double vitrage rénovation", "PHRASE", 5, "AVERAGE", "ABOVE_AVERAGE", "AVERAGE", 0.46, 2.18, m(44, 5, 16.63)],
  ["porte fenetre pvc", "PHRASE", 2, "BELOW_AVERAGE", "AVERAGE", "BELOW_AVERAGE", 0.46, 2.31, m(7, 1, 9.71)],
  ["menuiserie alu toulon", "PHRASE", 3, "BELOW_AVERAGE", "AVERAGE", "AVERAGE", 0.8, 3.3, m(34, 2, 9.46)],
  ["menuiserie six fours", "EXACT", 1, "BELOW_AVERAGE", "BELOW_AVERAGE", "BELOW_AVERAGE", 0.87, 2.65, m(13, 1, 8.35)],
  ["prime renov 2026 changement fenetre", "PHRASE", null, "", "", "", 0.72, 2.54, m(11, 1, 7.77)],
  ["fenetre à galandage", "PHRASE", null, "", "", "", 0.6, 2.1, m(62, 2, 7.5)],
  ["fenetre bois double vitrage", "PHRASE", 1, "BELOW_AVERAGE", "AVERAGE", "BELOW_AVERAGE", 0.65, 2.21, m(2, 1, 7.14)],
  ["fenetre aluminium la farlede", "EXACT", 7, "AVERAGE", "ABOVE_AVERAGE", "ABOVE_AVERAGE", 0.9, 2.9, m(48, 6, 14.2, 1)],
  ["remplacement fenetre var", "PHRASE", 6, "AVERAGE", "ABOVE_AVERAGE", "AVERAGE", 0.75, 2.6, m(57, 4, 11.4, 1)],
];

export function keywords(campaignId: string | null): KeywordRow[] {
  if (campaignId && campaignId !== C1.id) return [];
  return KW.map(([text, matchType, qs, ctr, ad, lp, fp, tp, cur], i) => {
    const q = (s: string) => (s === "BELOW_AVERAGE" ? "faible" : s === "AVERAGE" ? "moyen" : s === "ABOVE_AVERAGE" ? "bon" : null) as KeywordRow["ctrQ"];
    return {
      key: `${AG.id}~${900 + i}`, campaignId: C1.id, campaign: C1.name, adGroupId: AG.id, adGroup: AG.name, criterionId: String(900 + i),
      text, matchType, status: "ENABLED", qs, ctrQ: q(ctr), adQ: q(ad), lpQ: q(lp), firstPageCpc: fp, topPageCpc: tp,
      cur, prev: scale(cur, 0.7 + ((i * 37) % 60) / 100),
    };
  });
}

// terme, coût, clics, impressions, conversions, statut
const TERMS: [string, number, number, number, number, string][] = [
  ["porte fenetre", 19.24, 4, 41, 0, "ADDED"],
  ["fenetre double vitrage prix", 13.1, 3, 22, 0, "NONE"],
  ["prix porte fenetre pvc", 9.71, 1, 7, 0, "NONE"],
  ["fenetre bois sur mesure", 9.4, 2, 5, 0, "NONE"],
  ["fenetre bois double vitrage", 8.92, 2, 4, 0, "NONE"],
  ["prime renov fenetre", 7.77, 1, 6, 0, "NONE"],
  ["baie vitrée galandage prix", 6.1, 1, 9, 0, "NONE"],
  ["fenêtre pvc rénovation", 5.76, 2, 7, 0, "NONE"],
  ["baie vitrée accordéon technal prix", 5.1, 1, 2, 0, "NONE"],
  ["menuisier toulon", 4.9, 1, 8, 1, "NONE"],
  ["changer fenetre devis", 4.7, 2, 6, 1, "NONE"],
  ["fenetre alu la farlede", 4.3, 2, 9, 1, "ADDED"],
  ["fenetre oscillo battante", 3.8, 1, 3, 0, "NONE"],
  ["double vitrage renovation", 3.33, 1, 11, 0, "ADDED"],
  ["maprimerenov fenetre 2026", 3.1, 1, 4, 0, "NONE"],
  ["fenetre pvc leroy merlin", 2.9, 1, 12, 0, "NONE"],
  ["fenetre pas cher", 2.7, 1, 6, 0, "NONE"],
  ["store banne", 2.4, 1, 3, 0, "NONE"],
  ["pierret portes et fenêtres", 0, 0, 1, 0, "NONE"],
  ["atulam fenetre", 0, 0, 1, 0, "NONE"],
  ["bertolotto france", 0, 0, 2, 0, "NONE"],
  ["fenetre internorm", 0, 0, 2, 0, "NONE"],
  ["kline fenetre", 0, 0, 2, 0, "NONE"],
  ["portes garofoli", 0, 0, 2, 0, "NONE"],
  ["schuco ads 60", 0, 0, 1, 0, "NONE"],
  ["porte fenetre bois", 0, 0, 5, 0, "NONE"],
  ["baie vitrée coulissante", 0, 0, 4, 0, "NONE"],
  ["fenetre sur mesure var", 0, 0, 3, 0, "NONE"],
  ["fenetre pvc emploi", 0, 0, 2, 0, "NONE"],
  ["fabricant fenêtre aluminium haut de gamme", 0, 0, 2, 0, "NONE"],
];

export function terms(campaignId: string | null): TermRow[] {
  if (campaignId && campaignId !== C1.id) return [];
  return TERMS.map(([term, cost, clicks, impressions, conversions, status], i) => {
    const cur = m(impressions, clicks, cost, conversions);
    return { term, campaignId: C1.id, campaign: C1.name, adGroupId: AG.id, adGroup: AG.name, status, cur, prev: scale(cur, i % 3 === 0 ? 0 : 0.8) };
  });
}

export function termHistory() {
  return [
    { term: "aide menuiserie", campaignId: C1.id, m: m(40, 6, 21.3) },
    { term: "fenetre gratuite", campaignId: C1.id, m: m(22, 4, 12.5) },
    { term: "emploi menuisier toulon", campaignId: C1.id, m: m(31, 5, 14.8) },
    { term: "fenetre occasion", campaignId: C1.id, m: m(18, 3, 9.9) },
    { term: "menuiserie formation", campaignId: C1.id, m: m(9, 2, 6.2) },
  ];
}

export const NEGATIVES: NegativeRow[] = [
  { level: "campaign", campaignId: C1.id, campaign: C1.name, text: "aide menuiserie", matchType: "PHRASE" },
  { level: "ad_group", campaignId: C1.id, campaign: C1.name, adGroupId: AG.id, adGroup: AG.name, text: "aide menuiserie", matchType: "BROAD" },
  { level: "campaign", campaignId: C1.id, campaign: C1.name, text: "gratuit", matchType: "BROAD" },
  { level: "campaign", campaignId: C1.id, campaign: C1.name, text: "gratuite", matchType: "BROAD" },
  { level: "shared", campaignId: C1.id, campaign: C1.name, sharedSet: "Exclusions générales", text: "emploi", matchType: "BROAD" },
  { level: "shared", campaignId: C1.id, campaign: C1.name, sharedSet: "Exclusions générales", text: "occasion", matchType: "BROAD" },
  { level: "shared", campaignId: C1.id, campaign: C1.name, sharedSet: "Exclusions générales", text: "formation", matchType: "BROAD" },
];

const IS = (is: number, lb: number, lr: number, top: number, abs: number) => ({ is, lostBudget: lb, lostRank: lr, top, absTop: abs });

export function campaignPerf(campaignId: string | null): CampaignPerf[] {
  if (campaignId && campaignId !== C1.id) return [];
  const cur = m(674, 44, 211.77, 0);
  const prev = m(682, 52, 215.9, 1);
  return [{
    id: C1.id, name: C1.name,
    cur: { ...cur, ...IS(0.693, 0.089, 0.218, 0.599, 0.21), eligible: 674 / 0.693 },
    prev: { ...prev, ...IS(0.554, 0.17, 0.276, 0.49, 0.18), eligible: 682 / 0.554 },
  }];
}

export function daily(since: string, until: string, campaignId: string | null): DayRow[] {
  if (campaignId && campaignId !== C1.id) return [];
  const out: DayRow[] = [];
  const d = new Date(since + "T00:00:00Z");
  const end = new Date(until + "T00:00:00Z");
  let i = 0;
  while (d <= end) {
    const cost = 26 + ((i * 53) % 11);
    out.push({
      date: d.toISOString().slice(0, 10), campaignId: C1.id, cost, clicks: 5 + (i % 4), impressions: 90 + ((i * 17) % 30),
      conversions: i % 9 === 4 ? 1 : 0, is: 0.6 + ((i * 7) % 15) / 100, lostBudget: 0.05 + ((i * 3) % 10) / 100, lostRank: 0.2 + ((i * 5) % 8) / 100,
    });
    d.setUTCDate(d.getUTCDate() + 1);
    i++;
  }
  return out;
}
