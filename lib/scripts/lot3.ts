// Lot 3 · Annonces, conversions, audiences, Performance Max, Display/Shopping,
// géographie, réglages, tendances, liens cassés et analyse IA (33 scripts).
import Anthropic from "@anthropic-ai/sdk";
import { calcCost, addMonthlyCost } from "@/lib/agent/cost";
import { getGlobalBilling } from "@/lib/billing";
import { during, groupSum, micros, num, perf, PERF_COLS, q, r2, ratio, DAY_LABEL } from "./helpers";
import type { Row, ScriptDef, ScriptRange } from "./types";
import type { AdsContext, RawRow } from "@/lib/google-ads/client";

const ENABLED = "campaign.status = 'ENABLED'";
const M = (r: RawRow) => ({ cost: micros(r.metrics?.costMicros), clicks: num(r.metrics?.clicks), impressions: num(r.metrics?.impressions), conversions: num(r.metrics?.conversions) });
const sortCost = (a: Row, b: Row) => Number(b.cost ?? 0) - Number(a.cost ?? 0);
const TXT = { type: "text" as const };
const PCT = { type: "pct" as const };
const STRENGTH: Record<string, string> = { EXCELLENT: "Excellente", GOOD: "Bonne", AVERAGE: "Moyenne", POOR: "Faible", PENDING: "En attente", NO_ADS: "Aucune annonce", UNSPECIFIED: "–", UNKNOWN: "–" };

async function accountTotals(ctx: AdsContext, range: ScriptRange) {
  const t = await q(ctx, `SELECT metrics.cost_micros, metrics.conversions, metrics.clicks, metrics.impressions FROM customer WHERE ${during(range)}`);
  const s = t.reduce((a, r) => { const m = M(r); return { cost: a.cost + m.cost, clicks: a.clicks + m.clicks, impressions: a.impressions + m.impressions, conversions: a.conversions + m.conversions }; }, { cost: 0, clicks: 0, impressions: 0, conversions: 0 });
  return { ...s, ctr: ratio(s.clicks, s.impressions) };
}

/** Les N dernières semaines complètes (lundi → dimanche). */
function lastWeeks(n: number) {
  const d = new Date();
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lundi
  const lastSunday = new Date(d); lastSunday.setUTCDate(d.getUTCDate() - dow - 1);
  const start = new Date(lastSunday); start.setUTCDate(lastSunday.getUTCDate() - 7 * n + 1);
  return { since: start.toISOString().slice(0, 10), until: lastSunday.toISOString().slice(0, 10) };
}

/** Tendance strictement décroissante sur 4 semaines. */
async function declining(ctx: AdsContext, select: string, from: string, key: (r: RawRow) => string, label: (r: RawRow) => Row, metric: "clicks" | "conversions", min: number) {
  const w = lastWeeks(4);
  const rows = await q(ctx, `SELECT ${select}, segments.week, metrics.clicks, metrics.conversions, metrics.cost_micros FROM ${from} WHERE segments.date BETWEEN '${w.since}' AND '${w.until}'`);
  const by = new Map<string, { first: RawRow; weeks: Map<string, number> }>();
  rows.forEach((r) => { const k = key(r); const e = by.get(k) ?? { first: r, weeks: new Map() }; const wk = r.segments?.week; e.weeks.set(wk, (e.weeks.get(wk) ?? 0) + num(r.metrics?.[metric])); by.set(k, e); });
  const weeks = [...new Set(rows.map((r) => r.segments?.week as string))].sort();
  const out: Row[] = [];
  by.forEach(({ first, weeks: m }) => {
    const v = weeks.map((wk) => m.get(wk) ?? 0);
    if (v.length < 4 || v[0] < min) return;
    for (let i = 1; i < v.length; i++) if (v[i] >= v[i - 1]) return;
    out.push({ ...label(first), w1: r2(v[0]), w2: r2(v[1]), w3: r2(v[2]), w4: r2(v[3]), delta: r2((v[3] - v[0]) / v[0]) });
  });
  return { rows: out.sort((a, b) => Number(a.delta) - Number(b.delta)), summary: `Semaines du ${weeks.join(", ")}.` };
}
const WEEK_COLS = [{ key: "w1", label: "S-4", type: "num" as const }, { key: "w2", label: "S-3", type: "num" as const }, { key: "w3", label: "S-2", type: "num" as const }, { key: "w4", label: "S-1", type: "num" as const }, { key: "delta", label: "Évolution", ...PCT }];

async function names(ctx: AdsContext, resource: "geo_target_constant" | "language_constant", ids: string[]) {
  const m = new Map<string, string>();
  if (!ids.length) return m;
  const field = resource === "geo_target_constant" ? "canonical_name" : "name";
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const rows = await q(ctx, `SELECT ${resource}.resource_name, ${resource}.${field} FROM ${resource} WHERE ${resource}.resource_name IN (${chunk.map((x) => `'${x}'`).join(", ")})`);
    const key = resource === "geo_target_constant" ? "geoTargetConstant" : "languageConstant";
    rows.forEach((r) => m.set(r[key]?.resourceName, r[key]?.[field === "name" ? "name" : "canonicalName"]));
  }
  return m;
}

/** Relecture d'un texte d'annonce : renvoie les défauts trouvés. */
function proofread(t: string): string[] {
  const out: string[] = [];
  const y = new Date().getUTCFullYear();
  const years = t.match(/\b20\d\d\b/g) ?? [];
  if (years.some((x) => Number(x) < y)) out.push("année passée");
  if (/ {2,}/.test(t)) out.push("double espace");
  if (/\b[A-ZÀ-Ý]{4,}\b/.test(t) && !/^[A-Z0-9 ]+$/.test(t)) out.push("mot en majuscules");
  if (/([!?.,])\1/.test(t)) out.push("ponctuation répétée");
  const w = t.toLowerCase().split(/\s+/);
  if (w.some((x, i) => i > 0 && x.length > 2 && x === w[i - 1])) out.push("mot répété");
  if (/^[a-zà-ÿ]/.test(t)) out.push("minuscule au début");
  return out;
}

export const LOT3_SCRIPTS: ScriptDef[] = [
  // ======================================================= Annonces
  {
    id: "annonces-a-reecrire", title: "Annonces à réécrire",
    description: "Les annonces responsives dont Google juge l'efficacité faible ou moyenne, classées par impressions : réécrivez d'abord celles que les gens voient le plus.",
    category: "annonces", level: "Débutant", frequency: "Hebdomadaire", channels: "Search",
    columns: [{ key: "where", label: "Campagne › groupe", ...TXT }, { key: "ad", label: "Annonce", ...TXT }, { key: "strength", label: "Efficacité", ...TXT }, { key: "impressions", label: "Impr.", type: "int" }, { key: "ctr", label: "CTR", ...PCT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.name, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad_strength, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM ad_group_ad WHERE ${during(range)} AND ${ENABLED} AND ad_group_ad.status = 'ENABLED' AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD' AND ad_group_ad.ad_strength IN ('POOR', 'AVERAGE')`);
      return { rows: rows.map((r) => ({ where: `${r.campaign?.name} › ${r.adGroup?.name}`, ad: `#${r.adGroupAd?.ad?.id}`, strength: STRENGTH[r.adGroupAd?.adStrength] ?? r.adGroupAd?.adStrength, ...perf(M(r)) })).sort((a, b) => Number(b.impressions) - Number(a.impressions)) };
    },
  },
  {
    id: "force-des-annonces", title: "Force des annonces",
    description: "Combien de vos annonces responsives actives Google juge excellentes, bonnes, moyennes ou faibles.",
    category: "annonces", level: "Débutant", frequency: "Hebdomadaire", channels: "Search",
    columns: [{ key: "strength", label: "Efficacité", ...TXT }, { key: "count", label: "Annonces", type: "int" }, { key: "share", label: "Part", ...PCT }],
    async run(ctx) {
      const rows = await q(ctx, `SELECT ad_group_ad.ad_strength FROM ad_group_ad WHERE ${ENABLED} AND ad_group.status = 'ENABLED' AND ad_group_ad.status = 'ENABLED' AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'`);
      const c = new Map<string, number>(); rows.forEach((r) => c.set(r.adGroupAd?.adStrength, (c.get(r.adGroupAd?.adStrength) ?? 0) + 1));
      return { rows: ["EXCELLENT", "GOOD", "AVERAGE", "POOR", "PENDING"].filter((k) => c.get(k)).map((k) => ({ strength: STRENGTH[k], count: c.get(k)!, share: r2(c.get(k)! / rows.length) })) };
    },
  },
  {
    id: "titres-notes", title: "Titres notés par Google",
    description: "Chaque titre et description de vos annonces responsives avec la note de Google (meilleure, bonne, faible) : réécrivez les faibles.",
    category: "annonces", level: "Intermédiaire", frequency: "Mensuel", channels: "Search",
    columns: [{ key: "where", label: "Campagne › groupe", ...TXT }, { key: "field", label: "Type", ...TXT }, { key: "text", label: "Texte", ...TXT }, { key: "label", label: "Note Google", ...TXT }],
    async run(ctx) {
      const LBL: Record<string, string> = { BEST: "Meilleure", GOOD: "Bonne", LOW: "Faible", LEARNING: "En apprentissage", PENDING: "En attente", UNRATED: "Non notée" };
      const rows = await q(ctx, `SELECT campaign.name, ad_group.name, ad_group_ad_asset_view.field_type, ad_group_ad_asset_view.performance_label, asset.text_asset.text
        FROM ad_group_ad_asset_view WHERE ${ENABLED} AND ad_group_ad_asset_view.enabled = TRUE AND ad_group_ad_asset_view.field_type IN ('HEADLINE', 'DESCRIPTION')`);
      const order: Record<string, number> = { LOW: 0, LEARNING: 1, GOOD: 2, BEST: 3 };
      return { rows: rows.map((r) => ({ where: `${r.campaign?.name} › ${r.adGroup?.name}`, field: r.adGroupAdAssetView?.fieldType === "HEADLINE" ? "Titre" : "Description", text: r.asset?.textAsset?.text ?? "",
        label: LBL[r.adGroupAdAssetView?.performanceLabel] ?? r.adGroupAdAssetView?.performanceLabel ?? "", _o: order[r.adGroupAdAssetView?.performanceLabel] ?? 9 })).sort((a, b) => a._o - b._o).map(({ _o, ...r }) => r) };
    },
  },
  {
    id: "ctr-en-berne", title: "CTR en berne",
    description: "Les annonces dont le taux de clic tombe sous 60 % de celui du compte (200 impressions au moins) : le message ne parle pas.",
    category: "annonces", level: "Débutant", frequency: "Hebdomadaire", channels: "Search",
    columns: [{ key: "where", label: "Campagne › groupe", ...TXT }, { key: "ad", label: "Annonce", ...TXT }, { key: "impressions", label: "Impr.", type: "int" }, { key: "ctr", label: "CTR", ...PCT }, { key: "cost", label: "Coût", type: "eur" }],
    async run(ctx, range) {
      const [acc, rows] = await Promise.all([accountTotals(ctx, range), q(ctx, `SELECT campaign.name, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.type, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM ad_group_ad WHERE ${during(range)} AND metrics.impressions >= 200`)]);
      if (!acc.ctr) return { rows: [] };
      return { rows: rows.map((r) => ({ where: `${r.campaign?.name} › ${r.adGroup?.name}`, ad: `${r.adGroupAd?.ad?.type ?? ""} #${r.adGroupAd?.ad?.id}`, ...perf(M(r)) })).filter((r) => Number(r.ctr) < acc.ctr! * 0.6),
        summary: `CTR du compte : ${(acc.ctr * 100).toFixed(1)} %.` };
    },
  },
  {
    id: "annonces-championnes", title: "Annonces championnes",
    description: "Les annonces qui convertissent le plus, avec leur taux de clic et leur coût par conversion : le message à reprendre ailleurs.",
    category: "annonces", level: "Débutant", frequency: "Mensuel", channels: "Search",
    columns: [{ key: "where", label: "Campagne › groupe", ...TXT }, { key: "ad", label: "Annonce", ...TXT }, { key: "headline", label: "1er titre", ...TXT }, { key: "ctr", label: "CTR", ...PCT }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.name, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.responsive_search_ad.headlines, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM ad_group_ad WHERE ${during(range)} AND metrics.conversions > 0`);
      return { rows: rows.map((r) => ({ where: `${r.campaign?.name} › ${r.adGroup?.name}`, ad: `#${r.adGroupAd?.ad?.id}`, headline: r.adGroupAd?.ad?.responsiveSearchAd?.headlines?.[0]?.text ?? "", ...perf(M(r)) }))
        .sort((a, b) => Number(b.conversions) - Number(a.conversions)) };
    },
  },
  {
    id: "annonces-en-double", title: "Annonces en double",
    description: "Les annonces responsives aux titres et descriptions identiques, dans le même groupe ou ailleurs : elles se partagent les impressions sans rien tester.",
    category: "annonces", level: "Débutant", frequency: "Mensuel", channels: "Search",
    columns: [{ key: "headline", label: "1er titre", ...TXT }, { key: "count", label: "Copies", type: "int" }, { key: "where", label: "Où", ...TXT }],
    async run(ctx) {
      const rows = await q(ctx, `SELECT campaign.name, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions
        FROM ad_group_ad WHERE ${ENABLED} AND ad_group_ad.status = 'ENABLED' AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'`);
      const sig = (r: RawRow) => { const h = (r.adGroupAd?.ad?.responsiveSearchAd?.headlines ?? []).map((x: { text: string }) => x.text.toLowerCase().trim()).sort(); const d = (r.adGroupAd?.ad?.responsiveSearchAd?.descriptions ?? []).map((x: { text: string }) => x.text.toLowerCase().trim()).sort(); return JSON.stringify([h, d]); };
      const m = new Map<string, RawRow[]>(); rows.forEach((r) => m.set(sig(r), [...(m.get(sig(r)) ?? []), r]));
      return { rows: [...m.values()].filter((l) => l.length > 1).map((l) => ({ headline: l[0].adGroupAd?.ad?.responsiveSearchAd?.headlines?.[0]?.text ?? "", count: l.length, where: l.map((r) => `${r.campaign?.name} › ${r.adGroup?.name} #${r.adGroupAd?.ad?.id}`).join(" · ") })) };
    },
  },
  {
    id: "relecture-annonces", title: "Relecture des annonces",
    description: "Les titres et descriptions à reprendre : année passée, double espace, mot en majuscules, ponctuation répétée, mot répété, minuscule au début.",
    category: "annonces", level: "Débutant", frequency: "Mensuel", channels: "Search",
    columns: [{ key: "where", label: "Campagne › groupe", ...TXT }, { key: "text", label: "Texte", ...TXT }, { key: "issues", label: "À reprendre", ...TXT }],
    async run(ctx) {
      const rows = await q(ctx, `SELECT campaign.name, ad_group.name, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions
        FROM ad_group_ad WHERE ${ENABLED} AND ad_group_ad.status = 'ENABLED' AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'`);
      const out: Row[] = []; const seen = new Set<string>();
      rows.forEach((r) => [...(r.adGroupAd?.ad?.responsiveSearchAd?.headlines ?? []), ...(r.adGroupAd?.ad?.responsiveSearchAd?.descriptions ?? [])].forEach((x: { text: string }) => {
        const issues = proofread(x.text); const k = `${r.adGroup?.name}|${x.text}`;
        if (issues.length && !seen.has(k)) { seen.add(k); out.push({ where: `${r.campaign?.name} › ${r.adGroup?.name}`, text: x.text, issues: issues.join(", ") }); }
      }));
      return { rows: out };
    },
  },
  {
    id: "extensions-par-campagne", title: "Extensions par campagne",
    description: "Combien de liens annexes, d'accroches, d'extraits et d'images chaque campagne active porte : les extensions manquantes coûtent des clics.",
    category: "annonces", level: "Débutant", frequency: "Mensuel", channels: "Search, PMax",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "sitelinks", label: "Liens annexes", type: "int" }, { key: "callouts", label: "Accroches", type: "int" }, { key: "snippets", label: "Extraits", type: "int" }, { key: "images", label: "Images", type: "int" }, { key: "calls", label: "Appel", type: "int" }, { key: "account", label: "Hérités du compte", ...TXT }],
    async run(ctx) {
      const [camps, ca, cust] = await Promise.all([
        q(ctx, `SELECT campaign.id, campaign.name FROM campaign WHERE ${ENABLED} AND campaign.advertising_channel_type IN ('SEARCH', 'PERFORMANCE_MAX')`),
        q(ctx, `SELECT campaign.id, campaign_asset.field_type FROM campaign_asset WHERE ${ENABLED} AND campaign_asset.status = 'ENABLED'`),
        q(ctx, `SELECT customer_asset.field_type FROM customer_asset WHERE customer_asset.status = 'ENABLED'`),
      ]);
      const cnt = (rows: RawRow[], id: string | null, t: string, getType: (r: RawRow) => string) => rows.filter((r) => (id === null || String(r.campaign?.id) === id) && getType(r) === t).length;
      const accTypes = new Map<string, number>(); cust.forEach((r) => accTypes.set(r.customerAsset?.fieldType, (accTypes.get(r.customerAsset?.fieldType) ?? 0) + 1));
      const acc = [...accTypes.entries()].map(([t, n]) => `${t} ${n}`).join(", ");
      const ft = (r: RawRow) => r.campaignAsset?.fieldType;
      return { rows: camps.map((c) => { const id = String(c.campaign?.id); return { campaign: c.campaign?.name ?? "", sitelinks: cnt(ca, id, "SITELINK", ft), callouts: cnt(ca, id, "CALLOUT", ft), snippets: cnt(ca, id, "STRUCTURED_SNIPPET", ft), images: cnt(ca, id, "AD_IMAGE", ft), calls: cnt(ca, id, "CALL", ft), account: acc || "–" }; }) };
    },
  },
  {
    id: "liens-annexes", title: "Liens annexes",
    description: "Impressions, clics et taux de clics de chaque lien annexe : remplacez ceux que personne ne clique.",
    category: "annonces", level: "Débutant", frequency: "Mensuel", channels: "Search",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "text", label: "Lien annexe", ...TXT }, { key: "impressions", label: "Impr.", type: "int" }, { key: "clicks", label: "Clics", type: "int" }, { key: "ctr", label: "CTR", ...PCT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.name, asset.sitelink_asset.link_text, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM campaign_asset WHERE ${during(range)} AND campaign_asset.field_type = 'SITELINK'`);
      const g = groupSum(rows, (r) => `${r.campaign?.name}|${r.asset?.sitelinkAsset?.linkText}`, M);
      return { rows: [...g.values()].map(({ first, sum }) => ({ campaign: first.campaign?.name ?? "", text: first.asset?.sitelinkAsset?.linkText ?? "", impressions: sum.impressions, clicks: sum.clicks, ctr: r2(ratio(sum.clicks, sum.impressions)) })).sort((a, b) => Number(a.ctr ?? 0) - Number(b.ctr ?? 0)) };
    },
  },
  {
    id: "promotions", title: "Promotions",
    description: "Les promotions de vos annonces et leurs dates : une promo expirée encore attachée se repère avant qu'elle ne s'éteigne.",
    category: "annonces", level: "Débutant", frequency: "Hebdomadaire", channels: "Search, Shopping",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "target", label: "Promotion", ...TXT }, { key: "start", label: "Début", ...TXT }, { key: "end", label: "Fin", ...TXT }, { key: "state", label: "État", ...TXT }],
    async run(ctx) {
      const rows = await q(ctx, `SELECT campaign.name, asset.promotion_asset.promotion_target, asset.promotion_asset.start_date, asset.promotion_asset.end_date
        FROM campaign_asset WHERE campaign_asset.field_type = 'PROMOTION' AND campaign_asset.status = 'ENABLED'`);
      const today = new Date().toISOString().slice(0, 10);
      return { rows: rows.map((r) => { const p = r.asset?.promotionAsset ?? {}; return { campaign: r.campaign?.name ?? "", target: p.promotionTarget ?? "", start: p.startDate ?? "", end: p.endDate ?? "",
        state: p.endDate && p.endDate < today ? "Expirée" : p.startDate && p.startDate > today ? "À venir" : "Active" }; }) };
    },
  },
  // ======================================================= Conversions
  {
    id: "reglages-conversion", title: "Réglages de conversion",
    description: "Source, catégorie, comptage et action principale ou non : les réglages qui décident de chaque CPA, rarement relus après la mise en place.",
    category: "conversions", level: "Intermédiaire", frequency: "Mensuel", channels: "Tous types",
    columns: [{ key: "name", label: "Action", ...TXT }, { key: "type", label: "Source", ...TXT }, { key: "category", label: "Catégorie", ...TXT }, { key: "counting", label: "Comptage", ...TXT }, { key: "primary", label: "Principale", ...TXT }, { key: "status", label: "État", ...TXT }],
    async run(ctx) {
      const rows = await q(ctx, `SELECT conversion_action.name, conversion_action.type, conversion_action.category, conversion_action.counting_type, conversion_action.primary_for_goal, conversion_action.status FROM conversion_action WHERE conversion_action.status != 'REMOVED'`);
      return { rows: rows.map((r) => { const c = r.conversionAction ?? {}; return { name: c.name ?? "", type: c.type ?? "", category: c.category ?? "", counting: c.countingType === "ONE_PER_CLICK" ? "Une par clic" : c.countingType === "MANY_PER_CLICK" ? "Toutes" : c.countingType ?? "", primary: c.primaryForGoal ? "Oui" : "Non", status: c.status ?? "" }; }),
        summary: "Pour des leads (formulaire, appel), le comptage « Une par clic » évite de compter deux fois le même prospect." };
    },
  },
  {
    id: "delai-de-conversion", title: "Délai de conversion",
    description: "Combien de temps les conversions mettent à arriver après le clic : la raison pour laquelle la semaine dernière paraît toujours mauvaise.",
    category: "conversions", level: "Intermédiaire", frequency: "Mensuel", channels: "Tous types",
    columns: [{ key: "bucket", label: "Délai après le clic", ...TXT }, { key: "conversions", label: "Conversions", type: "num" }, { key: "share", label: "Part", ...PCT }, { key: "cumul", label: "Cumul", ...PCT }],
    async run(ctx) {
      const iso = (d: Date) => d.toISOString().slice(0, 10); const until = new Date(); until.setUTCDate(until.getUTCDate() - 1); const since = new Date(until); since.setUTCDate(since.getUTCDate() - 89);
      const rows = await q(ctx, `SELECT segments.conversion_lag_bucket, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${iso(since)}' AND '${iso(until)}' AND metrics.conversions > 0`);
      const ORDER = ["LESS_THAN_ONE_DAY", "ONE_TO_TWO_DAYS", "TWO_TO_THREE_DAYS", "THREE_TO_FOUR_DAYS", "FOUR_TO_FIVE_DAYS", "FIVE_TO_SIX_DAYS", "SIX_TO_SEVEN_DAYS", "SEVEN_TO_EIGHT_DAYS", "EIGHT_TO_NINE_DAYS", "NINE_TO_TEN_DAYS", "TEN_TO_ELEVEN_DAYS", "ELEVEN_TO_TWELVE_DAYS", "TWELVE_TO_THIRTEEN_DAYS", "THIRTEEN_TO_FOURTEEN_DAYS", "FOURTEEN_TO_TWENTY_ONE_DAYS", "TWENTY_ONE_TO_THIRTY_DAYS", "THIRTY_TO_FORTY_FIVE_DAYS", "FORTY_FIVE_TO_SIXTY_DAYS", "SIXTY_TO_NINETY_DAYS"];
      const g = groupSum(rows, (r) => r.segments?.conversionLagBucket ?? "", (r) => ({ c: num(r.metrics?.conversions) }));
      const total = [...g.values()].reduce((s, x) => s + x.sum.c, 0); let cumul = 0;
      return { rows: ORDER.filter((k) => g.get(k)).map((k) => { const c = g.get(k)!.sum.c; cumul += c; return { bucket: k.toLowerCase().replace(/_/g, " "), conversions: r2(c), share: r2(c / total), cumul: r2(cumul / total) }; }),
        summary: "Sur les 90 derniers jours." };
    },
  },
  // ======================================================= Audiences
  {
    id: "par-age", title: "Par âge",
    description: "Les tranches d'âge qui coûtent et celles qui convertissent, tout le compte additionné.",
    category: "audiences", level: "Débutant", frequency: "Mensuel", channels: "Search, Display, YouTube",
    columns: [{ key: "age", label: "Âge", ...TXT }, ...PERF_COLS, { key: "cvr", label: "Taux conv.", ...PCT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT ad_group_criterion.age_range.type, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.impressions FROM age_range_view WHERE ${during(range)}`);
      const LBL: Record<string, string> = { AGE_RANGE_18_24: "18-24", AGE_RANGE_25_34: "25-34", AGE_RANGE_35_44: "35-44", AGE_RANGE_45_54: "45-54", AGE_RANGE_55_64: "55-64", AGE_RANGE_65_UP: "65 et +", AGE_RANGE_UNDETERMINED: "Inconnu" };
      const g = groupSum(rows, (r) => r.adGroupCriterion?.ageRange?.type ?? "", M);
      return { rows: Object.keys(LBL).filter((k) => g.get(k)).map((k) => ({ age: LBL[k], ...perf(g.get(k)!.sum) })) };
    },
  },
  {
    id: "par-sexe", title: "Par sexe",
    description: "Femmes, hommes et inconnu : la dépense et le coût par conversion de chacun, tout le compte additionné.",
    category: "audiences", level: "Débutant", frequency: "Mensuel", channels: "Search, Display, YouTube",
    columns: [{ key: "gender", label: "Sexe", ...TXT }, ...PERF_COLS, { key: "cvr", label: "Taux conv.", ...PCT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT ad_group_criterion.gender.type, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.impressions FROM gender_view WHERE ${during(range)}`);
      const LBL: Record<string, string> = { FEMALE: "Femmes", MALE: "Hommes", UNDETERMINED: "Inconnu" };
      const g = groupSum(rows, (r) => r.adGroupCriterion?.gender?.type ?? "", M);
      return { rows: Object.keys(LBL).filter((k) => g.get(k)).map((k) => ({ gender: LBL[k], ...perf(g.get(k)!.sum) })) };
    },
  },
  {
    id: "listes-audience", title: "Listes d'audience",
    description: "Vos listes d'audience ouvertes et leur taille : sous 1 000 personnes, une liste ne peut pas servir sur le Réseau de Recherche.",
    category: "audiences", level: "Débutant", frequency: "Mensuel", channels: "Search, Display, YouTube",
    columns: [{ key: "name", label: "Liste", ...TXT }, { key: "type", label: "Type", ...TXT }, { key: "search", label: "Taille (Recherche)", type: "int" }, { key: "display", label: "Taille (Display)", type: "int" }, { key: "usable", label: "Utilisable en Search", ...TXT }],
    async run(ctx) {
      const rows = await q(ctx, `SELECT user_list.name, user_list.type, user_list.size_for_search, user_list.size_for_display, user_list.membership_status FROM user_list WHERE user_list.membership_status = 'OPEN'`);
      return { rows: rows.map((r) => { const u = r.userList ?? {}; return { name: u.name ?? "", type: u.type ?? "", search: num(u.sizeForSearch), display: num(u.sizeForDisplay), usable: num(u.sizeForSearch) >= 1000 ? "Oui" : "Non (< 1 000)" }; }) };
    },
  },
  {
    id: "audiences-campagnes", title: "Audiences des campagnes",
    description: "Les audiences liées à vos campagnes et ce qu'elles coûtent et rapportent : de quoi ajuster les enchères ou exclure.",
    category: "audiences", level: "Intermédiaire", frequency: "Mensuel", channels: "Search, Display, YouTube",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "audience", label: "Audience", ...TXT }, ...PERF_COLS],
    async run(ctx, range) {
      const [c, a] = await Promise.all([
        q(ctx, `SELECT campaign.name, campaign_criterion.display_name, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign_audience_view WHERE ${during(range)}`),
        q(ctx, `SELECT campaign.name, ad_group.name, ad_group_criterion.display_name, metrics.clicks, metrics.cost_micros, metrics.conversions FROM ad_group_audience_view WHERE ${during(range)}`),
      ]);
      return { rows: [...c.map((r) => ({ campaign: r.campaign?.name ?? "", audience: r.campaignCriterion?.displayName ?? "", ...perf(M(r)) })),
        ...a.map((r) => ({ campaign: `${r.campaign?.name} › ${r.adGroup?.name}`, audience: r.adGroupCriterion?.displayName ?? "", ...perf(M(r)) }))].sort(sortCost) };
    },
  },
  {
    id: "campagnes-sans-audience", title: "Campagnes sans audience",
    description: "Les campagnes actives sans aucune audience, même en observation : ajoutez au moins vos visiteurs et vos clients pour voir qui convertit le mieux.",
    category: "audiences", level: "Débutant", frequency: "Mensuel", channels: "Search, Shopping, Display",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "type", label: "Type", ...TXT }],
    async run(ctx) {
      const [camps, cc, ac] = await Promise.all([
        q(ctx, `SELECT campaign.id, campaign.name, campaign.advertising_channel_type FROM campaign WHERE ${ENABLED} AND campaign.advertising_channel_type IN ('SEARCH', 'SHOPPING', 'DISPLAY')`),
        q(ctx, `SELECT campaign.id FROM campaign_criterion WHERE ${ENABLED} AND campaign_criterion.type IN ('USER_LIST', 'USER_INTEREST', 'CUSTOM_AUDIENCE', 'COMBINED_AUDIENCE', 'AUDIENCE')`),
        q(ctx, `SELECT campaign.id FROM ad_group_criterion WHERE ${ENABLED} AND ad_group_criterion.type IN ('USER_LIST', 'USER_INTEREST', 'CUSTOM_AUDIENCE', 'COMBINED_AUDIENCE', 'AUDIENCE')`),
      ]);
      const has = new Set([...cc, ...ac].map((r) => String(r.campaign?.id)));
      return { rows: camps.filter((c) => !has.has(String(c.campaign?.id))).map((c) => ({ campaign: c.campaign?.name ?? "", type: c.campaign?.advertisingChannelType ?? "" })) };
    },
  },
  // ======================================================= Performance Max, Display, Shopping
  {
    id: "groupes-elements-pmax", title: "Groupes d'éléments",
    description: "L'efficacité que Google donne à chaque groupe d'éléments Performance Max actif : enrichissez ceux qui sont faibles.",
    category: "pmax", level: "Débutant", frequency: "Hebdomadaire", channels: "PMax",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "group", label: "Groupe d'éléments", ...TXT }, { key: "strength", label: "Efficacité", ...TXT }],
    async run(ctx) {
      const rows = await q(ctx, `SELECT campaign.name, asset_group.name, asset_group.ad_strength FROM asset_group WHERE ${ENABLED} AND asset_group.status = 'ENABLED'`);
      return { rows: rows.map((r) => ({ campaign: r.campaign?.name ?? "", group: r.assetGroup?.name ?? "", strength: STRENGTH[r.assetGroup?.adStrength] ?? r.assetGroup?.adStrength })),
        summary: rows.length ? undefined : "Aucune campagne Performance Max active." };
    },
  },
  {
    id: "ou-diffuse-pmax", title: "Où diffuse Performance Max",
    description: "Les sites, applications et vidéos YouTube où vos campagnes Performance Max se sont affichées, des plus vus aux moins vus.",
    category: "pmax", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "PMax",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "name", label: "Emplacement", ...TXT }, { key: "type", label: "Type", ...TXT }, { key: "url", label: "Adresse", ...TXT }, { key: "impressions", label: "Impr.", type: "int" }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.name, performance_max_placement_view.display_name, performance_max_placement_view.placement_type, performance_max_placement_view.target_url, metrics.impressions
        FROM performance_max_placement_view WHERE ${during(range)}`);
      const g = groupSum(rows, (r) => `${r.campaign?.name}|${r.performanceMaxPlacementView?.targetUrl}`, (r) => ({ i: num(r.metrics?.impressions) }));
      return { rows: [...g.values()].map(({ first, sum }) => ({ campaign: first.campaign?.name ?? "", name: first.performanceMaxPlacementView?.displayName ?? "", type: first.performanceMaxPlacementView?.placementType ?? "", url: first.performanceMaxPlacementView?.targetUrl ?? "", impressions: sum.i }))
        .sort((a, b) => b.impressions - a.impressions).slice(0, 300) };
    },
  },
  {
    id: "relecture-pmax", title: "Relecture P-Max",
    description: "La même relecture pour les titres, titres longs et descriptions de vos groupes d'éléments Performance Max.",
    category: "pmax", level: "Débutant", frequency: "Mensuel", channels: "PMax",
    columns: [{ key: "where", label: "Campagne › groupe", ...TXT }, { key: "field", label: "Type", ...TXT }, { key: "text", label: "Texte", ...TXT }, { key: "issues", label: "À reprendre", ...TXT }],
    async run(ctx) {
      const rows = await q(ctx, `SELECT campaign.name, asset_group.name, asset_group_asset.field_type, asset.text_asset.text FROM asset_group_asset
        WHERE ${ENABLED} AND asset_group_asset.status = 'ENABLED' AND asset_group_asset.field_type IN ('HEADLINE', 'LONG_HEADLINE', 'DESCRIPTION')`);
      return { rows: rows.map((r) => ({ where: `${r.campaign?.name} › ${r.assetGroup?.name}`, field: r.assetGroupAsset?.fieldType ?? "", text: r.asset?.textAsset?.text ?? "", issues: proofread(r.asset?.textAsset?.text ?? "").join(", ") })).filter((r) => r.issues) };
    },
  },
  {
    id: "emplacements-display", title: "Emplacements Display",
    description: "Les sites et chaînes où vos campagnes Display et vidéo ont dépensé, avec leurs conversions : excluez ceux qui ne rapportent rien.",
    category: "display_shopping", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "Display, YouTube",
    columns: [{ key: "name", label: "Emplacement", ...TXT }, { key: "url", label: "Adresse", ...TXT }, { key: "type", label: "Type", ...TXT }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT detail_placement_view.display_name, detail_placement_view.target_url, detail_placement_view.placement_type, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM detail_placement_view WHERE ${during(range)} AND metrics.cost_micros > 0`);
      const g = groupSum(rows, (r) => r.detailPlacementView?.targetUrl ?? "", M);
      return { rows: [...g.values()].map(({ first, sum }) => ({ name: first.detailPlacementView?.displayName ?? "", url: first.detailPlacementView?.targetUrl ?? "", type: first.detailPlacementView?.placementType ?? "", ...perf(sum) })).sort(sortCost).slice(0, 300) };
    },
  },
  {
    id: "produits-gouffres", title: "Produits gouffres",
    description: "Les produits Shopping qui ont coûté sur la période sans une seule conversion, du plus cher au moins cher.",
    category: "display_shopping", level: "Débutant", frequency: "Hebdomadaire", channels: "Shopping, PMax",
    columns: [{ key: "id", label: "ID produit", ...TXT }, { key: "title", label: "Produit", ...TXT }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT segments.product_item_id, segments.product_title, metrics.clicks, metrics.cost_micros, metrics.conversions FROM shopping_performance_view WHERE ${during(range)} AND metrics.cost_micros > 0`);
      const g = groupSum(rows, (r) => r.segments?.productItemId ?? "", M);
      return { rows: [...g.values()].map(({ first, sum }) => ({ id: first.segments?.productItemId ?? "", title: first.segments?.productTitle ?? "", ...perf(sum) })).filter((r) => Number(r.conversions) === 0).sort(sortCost) };
    },
  },
  // ======================================================= Diagnostic, géographie, calendrier
  {
    id: "recos-google", title: "Recos de Google",
    description: "Les recommandations que Google vous propose, par type et par campagne : à relire une par une plutôt qu'à tout appliquer.",
    category: "diagnostic", level: "Débutant", frequency: "Hebdomadaire", channels: "Tous types",
    columns: [{ key: "type", label: "Recommandation", ...TXT }, { key: "campaign", label: "Campagne", ...TXT }],
    async run(ctx) {
      const [recos, camps] = await Promise.all([
        q(ctx, `SELECT recommendation.type, recommendation.campaign FROM recommendation WHERE recommendation.dismissed = FALSE`),
        q(ctx, `SELECT campaign.resource_name, campaign.name FROM campaign WHERE campaign.status != 'REMOVED'`),
      ]);
      const nm = new Map(camps.map((c) => [c.campaign?.resourceName, c.campaign?.name]));
      return { rows: recos.map((r) => ({ type: String(r.recommendation?.type ?? "").toLowerCase().replace(/_/g, " "), campaign: nm.get(r.recommendation?.campaign) ?? "Compte" })).sort((a, b) => a.type.localeCompare(b.type)) };
    },
  },
  {
    id: "modeles-de-suivi", title: "Modèles de suivi",
    description: "Le modèle de suivi et le suffixe d'URL de chaque campagne : un modèle sans {lpurl} envoie les clics nulle part.",
    category: "diagnostic", level: "Intermédiaire", frequency: "Mensuel", channels: "Tous types",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "template", label: "Modèle de suivi", ...TXT }, { key: "suffix", label: "Suffixe d'URL", ...TXT }, { key: "alert", label: "À vérifier", ...TXT }],
    async run(ctx) {
      const [camps, cust] = await Promise.all([
        q(ctx, `SELECT campaign.name, campaign.tracking_url_template, campaign.final_url_suffix FROM campaign WHERE ${ENABLED}`),
        q(ctx, `SELECT customer.tracking_url_template, customer.final_url_suffix FROM customer`),
      ]);
      const c0 = cust[0]?.customer ?? {};
      const rows = [{ campaign: "Compte (hérité)", template: c0.trackingUrlTemplate ?? "", suffix: c0.finalUrlSuffix ?? "" },
        ...camps.map((r) => ({ campaign: r.campaign?.name ?? "", template: r.campaign?.trackingUrlTemplate ?? "", suffix: r.campaign?.finalUrlSuffix ?? "" }))];
      return { rows: rows.map((r) => ({ ...r, alert: r.template && !/\{(lpurl|unescapedlpurl|escapedlpurl)/i.test(r.template) ? "modèle sans {lpurl}" : "" })) };
    },
  },
  {
    id: "langues-ciblees", title: "Langues ciblées",
    description: "Les langues visées par chaque campagne active : une campagne copiée d'un pays à l'autre garde souvent la mauvaise langue.",
    category: "diagnostic", level: "Débutant", frequency: "Mensuel", channels: "Search, Display, YouTube",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "languages", label: "Langues", ...TXT }],
    async run(ctx) {
      const [camps, rows] = await Promise.all([
        q(ctx, `SELECT campaign.name FROM campaign WHERE ${ENABLED}`),
        q(ctx, `SELECT campaign.name, campaign_criterion.language.language_constant FROM campaign_criterion WHERE ${ENABLED} AND campaign_criterion.type = 'LANGUAGE'`),
      ]);
      const nm = await names(ctx, "language_constant", [...new Set(rows.map((r) => r.campaignCriterion?.language?.languageConstant).filter(Boolean))] as string[]);
      const by = new Map<string, string[]>(); rows.forEach((r) => by.set(r.campaign?.name, [...(by.get(r.campaign?.name) ?? []), nm.get(r.campaignCriterion?.language?.languageConstant) ?? r.campaignCriterion?.language?.languageConstant]));
      return { rows: camps.map((c) => ({ campaign: c.campaign?.name ?? "", languages: (by.get(c.campaign?.name) ?? ["Toutes les langues"]).join(", ") })) };
    },
  },
  {
    id: "horaires-diffusion", title: "Horaires de diffusion",
    description: "Les plages horaires de chaque campagne et leurs ajustements : une fenêtre oubliée qui coupe vos annonces se repère ici.",
    category: "calendrier", level: "Débutant", frequency: "Mensuel", channels: "Search, Shopping, Display",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "day", label: "Jour", ...TXT }, { key: "hours", label: "Plage", ...TXT }, { key: "modifier", label: "Ajustement", ...TXT }],
    async run(ctx) {
      const rows = await q(ctx, `SELECT campaign.name, campaign_criterion.ad_schedule.day_of_week, campaign_criterion.ad_schedule.start_hour, campaign_criterion.ad_schedule.start_minute,
          campaign_criterion.ad_schedule.end_hour, campaign_criterion.ad_schedule.end_minute, campaign_criterion.bid_modifier
        FROM campaign_criterion WHERE ${ENABLED} AND campaign_criterion.type = 'AD_SCHEDULE'`);
      const MIN: Record<string, string> = { ZERO: "00", FIFTEEN: "15", THIRTY: "30", FORTY_FIVE: "45" };
      return { rows: rows.map((r) => { const s = r.campaignCriterion?.adSchedule ?? {}; const b = r.campaignCriterion?.bidModifier;
        return { campaign: r.campaign?.name ?? "", day: DAY_LABEL[s.dayOfWeek] ?? s.dayOfWeek, hours: `${s.startHour ?? 0}h${MIN[s.startMinute] ?? "00"} → ${s.endHour ?? 24}h${MIN[s.endMinute] ?? "00"}`,
          modifier: b && Number(b) !== 1 ? `${Math.round((Number(b) - 1) * 100)} %` : "–" }; }),
        summary: rows.length ? undefined : "Aucune plage horaire : les annonces diffusent 24 h/24, 7 j/7." };
    },
  },
  {
    id: "par-ville", title: "Par ville",
    description: "Clics, coût et conversions de chaque ville où se trouvaient vos clients, de la plus chère à la moins chère : où renforcer, où baisser les enchères.",
    category: "rapports", level: "Débutant", frequency: "Mensuel", channels: "Tous types",
    columns: [{ key: "place", label: "Ville", ...TXT }, ...PERF_COLS, { key: "cvr", label: "Taux conv.", ...PCT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT segments.geo_target_city, metrics.clicks, metrics.cost_micros, metrics.conversions FROM geographic_view WHERE ${during(range)} AND metrics.clicks > 0`);
      const g = groupSum(rows, (r) => r.segments?.geoTargetCity ?? "", M);
      const nm = await names(ctx, "geo_target_constant", [...g.keys()].filter(Boolean));
      return { rows: [...g.entries()].map(([k, { sum }]) => ({ place: k ? nm.get(k) ?? k : "Inconnue", ...perf(sum) })).sort(sortCost) };
    },
  },
  {
    id: "par-region", title: "Par région",
    description: "Les mêmes chiffres par région : la part de la dépense et le coût par conversion de chacune, pour ajuster les enchères par zone.",
    category: "rapports", level: "Débutant", frequency: "Mensuel", channels: "Tous types",
    columns: [{ key: "place", label: "Région", ...TXT }, ...PERF_COLS, { key: "share", label: "Part dépense", ...PCT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT segments.geo_target_region, metrics.clicks, metrics.cost_micros, metrics.conversions FROM geographic_view WHERE ${during(range)} AND metrics.clicks > 0`);
      const g = groupSum(rows, (r) => r.segments?.geoTargetRegion ?? "", M);
      const nm = await names(ctx, "geo_target_constant", [...g.keys()].filter(Boolean));
      const total = [...g.values()].reduce((s, x) => s + x.sum.cost, 0);
      return { rows: [...g.entries()].map(([k, { sum }]) => ({ place: k ? nm.get(k) ?? k : "Inconnue", ...perf(sum), share: r2(ratio(sum.cost, total)) })).sort(sortCost) };
    },
  },
  // ======================================================= Tendances
  {
    id: "campagnes-en-baisse", title: "Campagnes en baisse",
    description: "Les campagnes dont les conversions baissent chaque semaine depuis 4 semaines (au moins 3 au départ), avec l'évolution de la première à la dernière semaine.",
    category: "diagnostic", level: "Débutant", frequency: "Hebdomadaire", channels: "Tous types",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, ...WEEK_COLS],
    run: (ctx) => declining(ctx, "campaign.name", "campaign", (r) => r.campaign?.name ?? "", (r) => ({ campaign: r.campaign?.name ?? "" }), "conversions", 3),
  },
  {
    id: "groupes-en-baisse", title: "Groupes en baisse",
    description: "Les groupes d'annonces dont les clics baissent chaque semaine depuis 4 semaines (au moins 20 clics au départ) : la glissade se voit avant la chute.",
    category: "diagnostic", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "Search, Display",
    columns: [{ key: "where", label: "Campagne › groupe", ...TXT }, ...WEEK_COLS],
    run: (ctx) => declining(ctx, "campaign.name, ad_group.id, ad_group.name", "ad_group", (r) => String(r.adGroup?.id), (r) => ({ where: `${r.campaign?.name} › ${r.adGroup?.name}` }), "clicks", 20),
  },
  {
    id: "mots-cles-en-baisse", title: "Mots-clés en baisse",
    description: "Les mots-clés dont les clics baissent chaque semaine depuis 4 semaines (au moins 10 au départ) : enchère dépassée, concurrent arrivé ou demande qui s'essouffle.",
    category: "mots_cles", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "Search",
    columns: [{ key: "keyword", label: "Mot-clé", ...TXT }, ...WEEK_COLS],
    run: (ctx) => declining(ctx, "ad_group.id, ad_group_criterion.criterion_id, ad_group_criterion.keyword.text", "keyword_view", (r) => `${r.adGroup?.id}|${r.adGroupCriterion?.criterionId}`, (r) => ({ keyword: r.adGroupCriterion?.keyword?.text ?? "" }), "clicks", 10),
  },
  // ======================================================= Liens cassés (sur clic)
  {
    id: "liens-casses", title: "Liens cassés",
    description: "Stratyx ouvre chaque page de vos annonces, groupes P-Max et liens annexes : pages introuvables, erreurs du serveur et redirections, avec la destination finale.",
    category: "diagnostic", level: "Débutant", frequency: "Quotidien", channels: "Search, Shopping, PMax",
    confirm: "Vérifier les pages (jusqu'à 60 adresses, ~30 s)",
    columns: [{ key: "url", label: "Adresse", ...TXT }, { key: "status", label: "Réponse", type: "int" }, { key: "verdict", label: "Lecture", ...TXT }, { key: "location", label: "Redirige vers", ...TXT }, { key: "source", label: "Utilisée par", ...TXT }],
    async run(ctx) {
      const [ads, groups, links] = await Promise.all([
        q(ctx, `SELECT campaign.name, ad_group_ad.ad.final_urls FROM ad_group_ad WHERE ${ENABLED} AND ad_group.status = 'ENABLED' AND ad_group_ad.status = 'ENABLED'`),
        q(ctx, `SELECT campaign.name, asset_group.final_urls FROM asset_group WHERE ${ENABLED} AND asset_group.status = 'ENABLED'`),
        q(ctx, `SELECT campaign.name, asset.final_urls FROM campaign_asset WHERE ${ENABLED} AND campaign_asset.status = 'ENABLED' AND campaign_asset.field_type = 'SITELINK'`),
      ]);
      const src = new Map<string, Set<string>>();
      const add = (urls: string[] | undefined, s: string) => (urls ?? []).forEach((u) => { if (!src.has(u)) src.set(u, new Set()); src.get(u)!.add(s); });
      ads.forEach((r) => add(r.adGroupAd?.ad?.finalUrls, `Annonce · ${r.campaign?.name}`));
      groups.forEach((r) => add(r.assetGroup?.finalUrls, `P-Max · ${r.campaign?.name}`));
      links.forEach((r) => add(r.asset?.finalUrls, `Lien annexe · ${r.campaign?.name}`));
      const urls = [...src.keys()].slice(0, 60);
      const check = async (url: string) => {
        try {
          const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
          const res = await fetch(url, { method: "GET", redirect: "manual", signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; StratyxLinkCheck/1.0)" } });
          clearTimeout(t);
          return { status: res.status, location: res.headers.get("location") ?? "" };
        } catch (e) { return { status: 0, location: e instanceof Error ? e.message : "erreur" }; }
      };
      const out: Row[] = [];
      for (let i = 0; i < urls.length; i += 10) {
        const res = await Promise.all(urls.slice(i, i + 10).map(check));
        res.forEach((r, j) => { const url = urls[i + j];
          const verdict = r.status === 0 ? "injoignable" : r.status >= 500 ? "erreur serveur" : r.status === 404 || r.status === 410 ? "page introuvable" : r.status >= 400 ? "accès refusé" : r.status >= 300 ? "redirection" : "OK";
          out.push({ url, status: r.status, verdict, location: r.location, source: [...src.get(url)!].slice(0, 3).join(" · ") }); });
      }
      const bad = out.filter((r) => r.verdict !== "OK" && r.verdict !== "redirection").length;
      return { rows: out.sort((a, b) => (a.verdict === "OK" ? 1 : 0) - (b.verdict === "OK" ? 1 : 0)), summary: `${out.length} adresse(s) vérifiée(s) sur ${src.size}, ${bad} en erreur.` };
    },
  },
  // ======================================================= IA (sur clic, consomme des crédits)
  {
    id: "analyse-ia-recherches", title: "Analyse IA des recherches",
    description: "L'IA relit vos recherches : celles à exclure, en exact ou en expression, avec la raison et le coût, et celles à ne surtout pas exclure. Consomme quelques crédits IA.",
    category: "recherches", level: "Débutant", frequency: "Hebdomadaire", channels: "Search, Shopping",
    confirm: "Lancer l'analyse IA (environ 1 à 3 crédits)",
    columns: [{ key: "term", label: "Recherche", ...TXT }, { key: "decision", label: "Décision", ...TXT }, { key: "match", label: "Négatif", ...TXT }, { key: "reason", label: "Raison", ...TXT }, { key: "cost", label: "Coût", type: "eur" }, { key: "conversions", label: "Conv.", type: "num" }],
    async run(ctx, range) {
      const billing = await getGlobalBilling();
      if (!billing.allowed) throw new Error(billing.reason ?? "Plafond IA atteint.");
      const rows = await q(ctx, `SELECT search_term_view.search_term, campaign.name, metrics.clicks, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE ${during(range)} AND metrics.clicks > 0`);
      const g = groupSum(rows, (r) => r.searchTermView?.searchTerm ?? "", M);
      const terms = [...g.entries()].map(([term, { sum }]) => ({ term, cost: r2(sum.cost)!, clicks: sum.clicks, conversions: r2(sum.conversions)! })).sort((a, b) => b.cost - a.cost).slice(0, 150);
      if (!terms.length) return { rows: [], summary: "Aucune recherche sur la période." };
      const camps = [...new Set(rows.map((r) => r.campaign?.name))].join(", ");
      const model = "claude-haiku-4-5-20251001";
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const res = await client.messages.create({
        model, max_tokens: 4000,
        system: "Tu es un expert Google Ads pour des entreprises françaises. Tu réponds uniquement en JSON valide, sans texte autour.",
        messages: [{ role: "user", content:
          `Campagnes : ${camps}.\nVoici les recherches payées (coût €, clics, conversions) :\n${terms.map((t) => `${t.term} | ${t.cost} | ${t.clicks} | ${t.conversions}`).join("\n")}\n\n` +
          `Classe chaque recherche qui mérite une décision : "exclure" (hors cible : emploi, formation, bricolage, gratuit, concurrent, autre métier, autre zone…) ou "garder" (à ne surtout pas exclure, car elle convertit ou correspond à l'offre). Ignore les recherches neutres.\n` +
          `Réponds en JSON : [{"term":"...","decision":"exclure|garder","match":"exact|expression|","reason":"courte raison en français"}]` }],
      });
      const usage = calcCost(model, res.usage.input_tokens, res.usage.output_tokens);
      await addMonthlyCost(usage.costUsd, "copilote", null);
      const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
      let parsed: { term: string; decision: string; match?: string; reason?: string }[] = [];
      try { parsed = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)); } catch { throw new Error("Réponse IA illisible, relance l'analyse."); }
      const byTerm = new Map(terms.map((t) => [t.term, t]));
      return { rows: parsed.map((p) => ({ term: p.term, decision: p.decision === "exclure" ? "Exclure" : "Garder", match: p.decision === "exclure" ? (p.match === "exact" ? `[${p.term}]` : `"${p.term}"`) : "", reason: p.reason ?? "", cost: byTerm.get(p.term)?.cost ?? null, conversions: byTerm.get(p.term)?.conversions ?? null }))
        .sort((a, b) => (a.decision === "Exclure" ? 0 : 1) - (b.decision === "Exclure" ? 0 : 1) || Number(b.cost ?? 0) - Number(a.cost ?? 0)),
        summary: `${terms.length} recherches analysées par l'IA · coût ${Math.max(1, Math.round(usage.costUsd / 0.05))} crédit(s). Vérifie avant d'exclure.` };
    },
  },
];
