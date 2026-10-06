// Lot 2 · CPC et CPA, mots-clés, recherches, rapports, enchères (34 scripts).
import { during, groupSum, micros, num, perf, PERF_COLS, previousRange, q, r2, ratio, MATCH_LABEL } from "./helpers";
import type { Row, ScriptDef, ScriptRange } from "./types";
import type { AdsContext, RawRow } from "@/lib/google-ads/client";

const ENABLED = "campaign.status = 'ENABLED'";
type Ctx = AdsContext;
const M = (r: RawRow) => ({
  cost: micros(r.metrics?.costMicros), clicks: num(r.metrics?.clicks),
  impressions: num(r.metrics?.impressions), conversions: num(r.metrics?.conversions),
});
const V = (r: RawRow) => ({ ...M(r), value: num(r.metrics?.conversionsValue) });
const sortCost = (a: Row, b: Row) => Number(b.cost ?? 0) - Number(a.cost ?? 0);
const EMPTY = { cost: 0, clicks: 0, impressions: 0, conversions: 0 };

async function account(ctx: Ctx, range: ScriptRange) {
  const t = await q(ctx, `SELECT metrics.cost_micros, metrics.conversions, metrics.clicks, metrics.impressions FROM customer WHERE ${during(range)}`);
  const s = t.reduce((a, r) => { const m = M(r); return { cost: a.cost + m.cost, clicks: a.clicks + m.clicks, impressions: a.impressions + m.impressions, conversions: a.conversions + m.conversions }; }, { ...EMPTY });
  return { ...s, cpa: s.conversions > 0 ? s.cost / s.conversions : null, cpc: ratio(s.cost, s.clicks), ctr: ratio(s.clicks, s.impressions) };
}

/** Compare deux périodes ligne à ligne (clé commune). */
async function compare(ctx: Ctx, range: ScriptRange, gaql: (d: string) => string, key: (r: RawRow) => string) {
  const prev = previousRange(range);
  const [a, b] = await Promise.all([q(ctx, gaql(during(range))), q(ctx, gaql(during(prev)))]);
  return { now: groupSum(a, key, M), before: groupSum(b, key, M), prev };
}
const delta = (n: number, p: number) => (p ? r2((n - p) / p) : null);

const PCT = { type: "pct" as const };
const TXT = { type: "text" as const };

export const LOT2_SCRIPTS: ScriptDef[] = [
  // ======================================================= CPC et CPA
  {
    id: "cpc-par-campagne", title: "CPC par campagne",
    description: "Le CPC moyen de chaque campagne, du plus cher au moins cher, avec la dépense et le coût par conversion.",
    category: "cpc_cpa", level: "Débutant", frequency: "Hebdomadaire", channels: "Search, Shopping, Display",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "cpc", label: "CPC moyen", type: "eur" }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.name, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE ${during(range)} AND metrics.clicks > 0`);
      return { rows: rows.map((r) => { const m = M(r); return { campaign: r.campaign?.name ?? "", cpc: r2(ratio(m.cost, m.clicks)), ...perf(m) }; })
        .sort((a, b) => Number(b.cpc) - Number(a.cpc)) };
    },
  },
  {
    id: "cpc-qui-flambent", title: "CPC qui flambent",
    description: "Les mots-clés dont le CPC dépasse d'au moins 50 % celui du compte (5 clics au moins) : là où chaque clic coûte trop cher.",
    category: "cpc_cpa", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "Search, Shopping",
    columns: [{ key: "keyword", label: "Mot-clé", ...TXT }, { key: "where", label: "Campagne › groupe", ...TXT }, { key: "cpc", label: "CPC", type: "eur" }, { key: "vs", label: "vs compte", ...PCT }, ...PERF_COLS],
    async run(ctx, range) {
      const [acc, rows] = await Promise.all([account(ctx, range), q(ctx, `
        SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM keyword_view WHERE ${during(range)} AND metrics.clicks >= 5`)]);
      if (!acc.cpc) return { rows: [] };
      const out = rows.map((r) => { const m = M(r); const cpc = m.cost / m.clicks; return {
        keyword: r.adGroupCriterion?.keyword?.text ?? "", where: `${r.campaign?.name} › ${r.adGroup?.name}`,
        cpc: r2(cpc), vs: r2(cpc / acc.cpc! - 1), ...perf(m) }; }).filter((r) => Number(r.vs) >= 0.5).sort(sortCost);
      return { rows: out, summary: `CPC du compte : ${acc.cpc.toFixed(2)} €.` };
    },
  },
  {
    id: "pic-de-cpc", title: "Pic de CPC",
    description: "Le CPC de chaque campagne sur la période face à la période d'avant : une hausse brutale trahit un nouveau concurrent ou une enchère qui dérape.",
    category: "cpc_cpa", level: "Débutant", frequency: "Quotidien", channels: "Search, Shopping, Display",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "cpc", label: "CPC", type: "eur" }, { key: "cpcBefore", label: "CPC avant", type: "eur" }, { key: "delta", label: "Évolution", ...PCT }, { key: "clicks", label: "Clics", type: "int" }],
    async run(ctx, range) {
      const { now, before } = await compare(ctx, range, (d) => `SELECT campaign.name, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE ${d} AND metrics.clicks > 0`, (r) => r.campaign?.name ?? "");
      const out = [...now.entries()].map(([k, { sum }]) => {
        const p = before.get(k)?.sum ?? EMPTY;
        const c = ratio(sum.cost, sum.clicks), cb = ratio(p.cost, p.clicks);
        return { campaign: k, cpc: r2(c), cpcBefore: r2(cb), delta: c !== null && cb ? r2(c / cb - 1) : null, clicks: sum.clicks };
      }).sort((a, b) => Number(b.delta ?? -9) - Number(a.delta ?? -9));
      return { rows: out };
    },
  },
  {
    id: "encheres-max", title: "Enchères max",
    description: "Les enchères manuelles les plus hautes de vos mots-clés, face au CPC vraiment payé : l'assurance contre le 5 € devenu 50 €.",
    category: "cpc_cpa", level: "Débutant", frequency: "Quotidien", channels: "Search",
    columns: [{ key: "keyword", label: "Mot-clé", ...TXT }, { key: "where", label: "Campagne › groupe", ...TXT }, { key: "bid", label: "Enchère max", type: "eur" }, { key: "cpc", label: "CPC payé", type: "eur" }, { key: "strategy", label: "Stratégie", ...TXT }],
    async run(ctx, range) {
      const [kws, perfRows] = await Promise.all([
        q(ctx, `SELECT campaign.name, campaign.bidding_strategy_type, ad_group.id, ad_group.name, ad_group_criterion.criterion_id,
                       ad_group_criterion.keyword.text, ad_group_criterion.effective_cpc_bid_micros
                FROM ad_group_criterion WHERE ${ENABLED} AND ad_group.status = 'ENABLED' AND ad_group_criterion.type = 'KEYWORD'
                  AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status = 'ENABLED'`),
        q(ctx, `SELECT ad_group.id, ad_group_criterion.criterion_id, metrics.cost_micros, metrics.clicks FROM keyword_view WHERE ${during(range)} AND metrics.clicks > 0`),
      ]);
      const pm = groupSum(perfRows, (r) => `${r.adGroup?.id}|${r.adGroupCriterion?.criterionId}`, M);
      const out = kws.filter((k) => ["MANUAL_CPC", "ENHANCED_CPC"].includes(k.campaign?.biddingStrategyType)).map((k) => {
        const s = pm.get(`${k.adGroup?.id}|${k.adGroupCriterion?.criterionId}`)?.sum;
        return { keyword: k.adGroupCriterion?.keyword?.text ?? "", where: `${k.campaign?.name} › ${k.adGroup?.name}`,
          bid: micros(k.adGroupCriterion?.effectiveCpcBidMicros), cpc: s ? r2(ratio(s.cost, s.clicks)) : null, strategy: k.campaign?.biddingStrategyType };
      }).sort((a, b) => Number(b.bid) - Number(a.bid)).slice(0, 100);
      return { rows: out, summary: out.length ? undefined : "Aucune campagne en enchères manuelles : Google fixe les enchères." };
    },
  },
  {
    id: "cpa-hors-controle", title: "CPA hors de contrôle",
    description: "Les groupes d'annonces dont le coût par conversion dépasse 1,8 fois celui du compte : là où les conversions coûtent trop cher.",
    category: "cpc_cpa", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "Search, Shopping, Display",
    columns: [{ key: "where", label: "Campagne › groupe", ...TXT }, ...PERF_COLS, { key: "vs", label: "vs compte", ...PCT }],
    async run(ctx, range) {
      const [acc, rows] = await Promise.all([account(ctx, range), q(ctx, `SELECT campaign.name, ad_group.name, metrics.clicks, metrics.cost_micros, metrics.conversions FROM ad_group WHERE ${during(range)} AND metrics.conversions > 0`)]);
      if (!acc.cpa) return { rows: [], summary: "Aucune conversion sur la période." };
      return { rows: rows.map((r) => { const p = perf(M(r)); return { where: `${r.campaign?.name} › ${r.adGroup?.name}`, ...p, vs: r2(Number(p.cpa) / acc.cpa! - 1) }; })
        .filter((r) => Number(r.cpa) > acc.cpa! * 1.8).sort(sortCost), summary: `CPA du compte : ${Math.round(acc.cpa)} €.` };
    },
  },
  {
    id: "groupes-champions", title: "Groupes champions",
    description: "Les groupes d'annonces qui convertissent à moins de 60 % du CPA du compte : ceux qui méritent plus de budget.",
    category: "cpc_cpa", level: "Intermédiaire", frequency: "Mensuel", channels: "Search, Shopping, Display",
    columns: [{ key: "where", label: "Campagne › groupe", ...TXT }, ...PERF_COLS],
    async run(ctx, range) {
      const [acc, rows] = await Promise.all([account(ctx, range), q(ctx, `SELECT campaign.name, ad_group.name, metrics.clicks, metrics.cost_micros, metrics.conversions FROM ad_group WHERE ${during(range)} AND metrics.conversions > 0`)]);
      if (!acc.cpa) return { rows: [], summary: "Aucune conversion sur la période." };
      return { rows: rows.map((r) => ({ where: `${r.campaign?.name} › ${r.adGroup?.name}`, ...perf(M(r)) }))
        .filter((r) => Number(r.cpa) <= acc.cpa! * 0.6).sort((a, b) => Number(b.conversions) - Number(a.conversions)) };
    },
  },
  {
    id: "pages-gouffres", title: "Pages gouffres",
    description: "Les pages de destination qui ont coûté au moins un CPA sans convertir : c'est peut-être la page, pas le mot-clé, qui bloque.",
    category: "cpc_cpa", level: "Débutant", frequency: "Mensuel", channels: "Search, Shopping, Display",
    columns: [{ key: "page", label: "Page", ...TXT }, ...PERF_COLS],
    async run(ctx, range) {
      const [acc, rows] = await Promise.all([account(ctx, range), q(ctx, `SELECT landing_page_view.unexpanded_final_url, metrics.clicks, metrics.cost_micros, metrics.conversions FROM landing_page_view WHERE ${during(range)} AND metrics.cost_micros > 0`)]);
      const seuil = acc.cpa ?? 50;
      const g = groupSum(rows, (r) => r.landingPageView?.unexpandedFinalUrl ?? "", M);
      return { rows: [...g.entries()].map(([page, { sum }]) => ({ page, ...perf(sum) })).filter((r) => Number(r.conversions) === 0 && Number(r.cost) >= seuil).sort(sortCost) };
    },
  },
  {
    id: "roas-par-campagne", title: "ROAS par campagne",
    description: "Coût, valeur de conversion et ROAS de chaque campagne : pour la vente en ligne, la rentabilité réelle campagne par campagne.",
    category: "cpc_cpa", level: "Débutant", frequency: "Hebdomadaire", channels: "Search, Shopping, PMax",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "cost", label: "Coût", type: "eur" }, { key: "value", label: "Valeur conv.", type: "eur" }, { key: "roas", label: "ROAS", type: "num" }, { key: "conversions", label: "Conv.", type: "num" }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.name, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.clicks, metrics.impressions FROM campaign WHERE ${during(range)} AND metrics.cost_micros > 0`);
      return { rows: rows.map((r) => { const v = V(r); return { campaign: r.campaign?.name ?? "", cost: v.cost, value: r2(v.value), roas: r2(ratio(v.value, v.cost)), conversions: r2(v.conversions) }; }).sort(sortCost) };
    },
  },
  {
    id: "lin-rodnitzky", title: "Ratio Lin-Rodnitzky",
    description: "Coût total ÷ coût des recherches qui convertissent, par campagne : sous 1,5 vous êtes trop prudent, au-delà de 2 trop de budget part dans des recherches sans conversion.",
    category: "cpc_cpa", level: "Avancé", frequency: "Mensuel", channels: "Search, Shopping",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "cost", label: "Coût", type: "eur" }, { key: "costConv", label: "Coût des recherches qui convertissent", type: "eur" }, { key: "ratio", label: "Ratio", type: "num" }, { key: "verdict", label: "Lecture", ...TXT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.name, search_term_view.search_term, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE ${during(range)} AND metrics.cost_micros > 0`);
      const terms = groupSum(rows, (r) => `${r.campaign?.name}|${r.searchTermView?.searchTerm}`, M);
      const camp = new Map<string, { cost: number; conv: number }>();
      terms.forEach(({ first, sum }) => { const c = camp.get(first.campaign?.name) ?? { cost: 0, conv: 0 }; c.cost += sum.cost; if (sum.conversions > 0) c.conv += sum.cost; camp.set(first.campaign?.name, c); });
      return { rows: [...camp.entries()].map(([campaign, c]) => { const x = c.conv > 0 ? c.cost / c.conv : null; return { campaign, cost: r2(c.cost), costConv: r2(c.conv), ratio: r2(x),
        verdict: x === null ? "aucune recherche convertie" : x < 1.5 ? "trop prudent" : x <= 2 ? "équilibré" : "trop de dépense sans conversion" }; }).sort(sortCost) };
    },
  },
  // ======================================================= Mots-clés
  {
    id: "concentration-mots-cles", title: "Concentration de la dépense",
    description: "La part de la dépense de chaque mot-clé : quand trois mots-clés portent tout le compte, la moindre baisse sur l'un d'eux se voit partout.",
    category: "mots_cles", level: "Débutant", frequency: "Mensuel", channels: "Search",
    columns: [{ key: "keyword", label: "Mot-clé", ...TXT }, { key: "cost", label: "Coût", type: "eur" }, { key: "share", label: "Part", ...PCT }, { key: "cumul", label: "Cumul", ...PCT }, { key: "conversions", label: "Conv.", type: "num" }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, metrics.cost_micros, metrics.conversions, metrics.clicks FROM keyword_view WHERE ${during(range)} AND metrics.cost_micros > 0`);
      const g = groupSum(rows, (r) => `${r.adGroupCriterion?.keyword?.text} (${MATCH_LABEL[r.adGroupCriterion?.keyword?.matchType] ?? ""})`, M);
      const total = [...g.values()].reduce((s, x) => s + x.sum.cost, 0);
      let cumul = 0;
      const out = [...g.entries()].sort((a, b) => b[1].sum.cost - a[1].sum.cost).map(([keyword, { sum }]) => { cumul += sum.cost; return { keyword, cost: r2(sum.cost), share: r2(sum.cost / total), cumul: r2(cumul / total), conversions: r2(sum.conversions) }; });
      const top3 = out.slice(0, 3).reduce((s, r) => s + Number(r.share), 0);
      return { rows: out, summary: `Les 3 premiers mots-clés portent ${Math.round(top3 * 100)} % de la dépense.` };
    },
  },
  {
    id: "mots-cles-rares", title: "Mots-clés rarement diffusés",
    description: "Les mots-clés actifs que Google ne diffuse presque jamais, faute de volume de recherche : à élargir ou à retirer.",
    category: "mots_cles", level: "Débutant", frequency: "Mensuel", channels: "Search",
    columns: [{ key: "where", label: "Campagne › groupe", ...TXT }, { key: "keyword", label: "Mot-clé", ...TXT }, { key: "match", label: "Corresp.", ...TXT }],
    async run(ctx) {
      const rows = await q(ctx, `SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type
        FROM ad_group_criterion WHERE ${ENABLED} AND ad_group.status = 'ENABLED' AND ad_group_criterion.status = 'ENABLED'
          AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.system_serving_status = 'RARELY_SERVED'`);
      return { rows: rows.map((r) => ({ where: `${r.campaign?.name} › ${r.adGroup?.name}`, keyword: r.adGroupCriterion?.keyword?.text ?? "", match: MATCH_LABEL[r.adGroupCriterion?.keyword?.matchType] ?? "" })) };
    },
  },
  {
    id: "depense-par-correspondance", title: "Dépense par correspondance",
    description: "Exact, expression, large : comment la dépense et les conversions se répartissent entre vos types de correspondance.",
    category: "mots_cles", level: "Débutant", frequency: "Mensuel", channels: "Search",
    columns: [{ key: "match", label: "Correspondance", ...TXT }, ...PERF_COLS, { key: "share", label: "Part dépense", ...PCT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT ad_group_criterion.keyword.match_type, metrics.clicks, metrics.cost_micros, metrics.conversions FROM keyword_view WHERE ${during(range)}`);
      const g = groupSum(rows, (r) => r.adGroupCriterion?.keyword?.matchType ?? "", M);
      const total = [...g.values()].reduce((s, x) => s + x.sum.cost, 0);
      return { rows: [...g.entries()].map(([m, { sum }]) => ({ match: MATCH_LABEL[m] ?? m, ...perf(sum), share: r2(ratio(sum.cost, total)) })).sort(sortCost) };
    },
  },
  {
    id: "prix-premiere-page", title: "Prix de la première page",
    description: "Ce que Google estime pour chaque mot-clé : le CPC pour paraître en première page, en haut de page et en première position.",
    category: "mots_cles", level: "Intermédiaire", frequency: "Mensuel", channels: "Search",
    columns: [{ key: "keyword", label: "Mot-clé", ...TXT }, { key: "where", label: "Campagne › groupe", ...TXT }, { key: "first", label: "1re page", type: "eur" }, { key: "top", label: "Haut de page", type: "eur" }, { key: "pos1", label: "1re position", type: "eur" }],
    async run(ctx) {
      const rows = await q(ctx, `SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text,
          ad_group_criterion.position_estimates.first_page_cpc_micros, ad_group_criterion.position_estimates.top_of_page_cpc_micros,
          ad_group_criterion.position_estimates.first_position_cpc_micros
        FROM ad_group_criterion WHERE ${ENABLED} AND ad_group.status = 'ENABLED' AND ad_group_criterion.status = 'ENABLED'
          AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE`);
      const pe = (r: RawRow) => r.adGroupCriterion?.positionEstimates ?? {};
      return { rows: rows.map((r) => ({ keyword: r.adGroupCriterion?.keyword?.text ?? "", where: `${r.campaign?.name} › ${r.adGroup?.name}`,
        first: pe(r).firstPageCpcMicros ? micros(pe(r).firstPageCpcMicros) : null, top: pe(r).topOfPageCpcMicros ? micros(pe(r).topOfPageCpcMicros) : null,
        pos1: pe(r).firstPositionCpcMicros ? micros(pe(r).firstPositionCpcMicros) : null })).sort((a, b) => Number(b.pos1 ?? 0) - Number(a.pos1 ?? 0)) };
    },
  },
  {
    id: "mots-cles-qui-bougent", title: "Mots-clés qui bougent",
    description: "Coût et conversions de chaque mot-clé face à la période d'avant : ceux qui décollent et ceux qui chutent.",
    category: "mots_cles", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "Search",
    columns: [{ key: "keyword", label: "Mot-clé", ...TXT }, { key: "cost", label: "Coût", type: "eur" }, { key: "costBefore", label: "Coût avant", type: "eur" }, { key: "dCost", label: "Évol. coût", ...PCT }, { key: "conv", label: "Conv.", type: "num" }, { key: "convBefore", label: "Conv. avant", type: "num" }],
    async run(ctx, range) {
      const { now, before } = await compare(ctx, range, (d) => `SELECT ad_group_criterion.keyword.text, metrics.clicks, metrics.cost_micros, metrics.conversions FROM keyword_view WHERE ${d} AND metrics.impressions > 0`, (r) => r.adGroupCriterion?.keyword?.text ?? "");
      const keys = new Set([...now.keys(), ...before.keys()]);
      return { rows: [...keys].map((k) => { const n = now.get(k)?.sum ?? EMPTY, p = before.get(k)?.sum ?? EMPTY;
        return { keyword: k, cost: r2(n.cost), costBefore: r2(p.cost), dCost: delta(n.cost, p.cost), conv: r2(n.conversions), convBefore: r2(p.conversions), _abs: Math.abs(n.cost - p.cost) }; })
        .sort((a, b) => b._abs - a._abs).map(({ _abs, ...r }) => r) };
    },
  },
  {
    id: "mots-cles-boudes", title: "Mots-clés boudés",
    description: "Les mots-clés dont le taux de clic tombe sous la moitié de celui du compte (100 impressions au moins) : affichés, mais ignorés.",
    category: "mots_cles", level: "Débutant", frequency: "Mensuel", channels: "Search",
    columns: [{ key: "keyword", label: "Mot-clé", ...TXT }, { key: "where", label: "Campagne › groupe", ...TXT }, { key: "impressions", label: "Impr.", type: "int" }, { key: "ctr", label: "CTR", ...PCT }, { key: "cost", label: "Coût", type: "eur" }],
    async run(ctx, range) {
      const [acc, rows] = await Promise.all([account(ctx, range), q(ctx, `SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM keyword_view WHERE ${during(range)} AND metrics.impressions >= 100`)]);
      if (!acc.ctr) return { rows: [] };
      return { rows: rows.map((r) => ({ keyword: r.adGroupCriterion?.keyword?.text ?? "", where: `${r.campaign?.name} › ${r.adGroup?.name}`, ...perf(M(r)) }))
        .filter((r) => Number(r.ctr) < acc.ctr! / 2).sort((a, b) => Number(b.impressions) - Number(a.impressions)), summary: `CTR du compte : ${(acc.ctr * 100).toFixed(1)} %.` };
    },
  },
  {
    id: "haut-de-page", title: "En haut de page",
    description: "Pour chaque mot-clé, la part de ses impressions en haut de page et tout en haut : là où vous êtes visible, ou relégué en bas.",
    category: "mots_cles", level: "Débutant", frequency: "Hebdomadaire", channels: "Search",
    columns: [{ key: "keyword", label: "Mot-clé", ...TXT }, { key: "impressions", label: "Impr.", type: "int" }, { key: "top", label: "Haut de page", ...PCT }, { key: "absTop", label: "Tout en haut", ...PCT }, { key: "cost", label: "Coût", type: "eur" }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT ad_group_criterion.keyword.text, metrics.impressions, metrics.top_impression_percentage, metrics.absolute_top_impression_percentage, metrics.cost_micros FROM keyword_view WHERE ${during(range)} AND metrics.impressions > 0`);
      // moyennes pondérées par les impressions
      const g = new Map<string, { i: number; t: number; a: number; c: number }>();
      rows.forEach((r) => { const k = r.adGroupCriterion?.keyword?.text ?? ""; const i = num(r.metrics?.impressions); const x = g.get(k) ?? { i: 0, t: 0, a: 0, c: 0 };
        x.i += i; x.t += i * num(r.metrics?.topImpressionPercentage); x.a += i * num(r.metrics?.absoluteTopImpressionPercentage); x.c += micros(r.metrics?.costMicros); g.set(k, x); });
      return { rows: [...g.entries()].map(([keyword, x]) => ({ keyword, impressions: x.i, top: r2(x.t / x.i), absTop: r2(x.a / x.i), cost: r2(x.c) })).sort((a, b) => b.impressions - a.impressions) };
    },
  },
  // ======================================================= Recherches
  {
    id: "variantes-inutiles", title: "Variantes inutiles",
    description: "Les recherches que Google a rapprochées de vos mots-clés exacts ou expression sans qu'elles convertissent : les négatifs les plus précis du compte.",
    category: "recherches", level: "Avancé", frequency: "Hebdomadaire", channels: "Search",
    columns: [{ key: "term", label: "Recherche", ...TXT }, { key: "type", label: "Rapprochement", ...TXT }, { key: "campaign", label: "Campagne", ...TXT }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT search_term_view.search_term, segments.search_term_match_type, campaign.name, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM search_term_view WHERE ${during(range)} AND metrics.cost_micros > 0`);
      const LBL: Record<string, string> = { NEAR_EXACT: "Variante d'exact", NEAR_PHRASE: "Variante d'expression" };
      const g = groupSum(rows.filter((r) => r.segments?.searchTermMatchType in LBL), (r) => `${r.searchTermView?.searchTerm}|${r.segments?.searchTermMatchType}|${r.campaign?.name}`, M);
      return { rows: [...g.values()].map(({ first, sum }) => ({ term: first.searchTermView?.searchTerm ?? "", type: LBL[first.segments?.searchTermMatchType], campaign: first.campaign?.name ?? "", ...perf(sum) }))
        .filter((r) => Number(r.conversions) === 0).sort(sortCost) };
    },
  },
  {
    id: "vraie-correspondance", title: "Vraie correspondance",
    description: "Combien de la dépense passe par des recherches exactes, des variantes proches ou la requête large : quand les variantes prennent le dessus, Google élargit votre ciblage sans le dire.",
    category: "recherches", level: "Avancé", frequency: "Hebdomadaire", channels: "Search",
    columns: [{ key: "type", label: "Type de rapprochement", ...TXT }, ...PERF_COLS, { key: "share", label: "Part dépense", ...PCT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT segments.search_term_match_type, metrics.clicks, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE ${during(range)} AND metrics.cost_micros > 0`);
      const LBL: Record<string, string> = { EXACT: "Exact", NEAR_EXACT: "Variante d'exact", PHRASE: "Expression", NEAR_PHRASE: "Variante d'expression", BROAD: "Large", AUTO: "Automatique" };
      const g = groupSum(rows, (r) => r.segments?.searchTermMatchType ?? "", M);
      const total = [...g.values()].reduce((s, x) => s + x.sum.cost, 0);
      return { rows: [...g.entries()].map(([t, { sum }]) => ({ type: LBL[t] ?? t, ...perf(sum), share: r2(ratio(sum.cost, total)) })).sort(sortCost) };
    },
  },
  {
    id: "recherches-en-doublon", title: "Recherches en doublon",
    description: "Les recherches servies par deux campagnes ou plus, avec le coût de chacune : décidez laquelle la garde et excluez-la des autres.",
    category: "recherches", level: "Intermédiaire", frequency: "Mensuel", channels: "Search",
    columns: [{ key: "term", label: "Recherche", ...TXT }, { key: "count", label: "Campagnes", type: "int" }, { key: "detail", label: "Coût par campagne", ...TXT }, { key: "cost", label: "Coût total", type: "eur" }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT search_term_view.search_term, campaign.name, metrics.cost_micros, metrics.clicks, metrics.conversions FROM search_term_view WHERE ${during(range)} AND metrics.clicks > 0`);
      const g = groupSum(rows, (r) => `${r.searchTermView?.searchTerm}|${r.campaign?.name}`, M);
      const byTerm = new Map<string, { c: string; cost: number; conv: number }[]>();
      g.forEach(({ first, sum }) => { const t = first.searchTermView?.searchTerm ?? ""; byTerm.set(t, [...(byTerm.get(t) ?? []), { c: first.campaign?.name ?? "", cost: sum.cost, conv: sum.conversions }]); });
      return { rows: [...byTerm.entries()].filter(([, l]) => l.length > 1).map(([term, l]) => ({ term, count: l.length,
        detail: l.map((x) => `${x.c} : ${Math.round(x.cost)} € (${Math.round(x.conv * 10) / 10} conv.)`).join(" · "), cost: r2(l.reduce((s, x) => s + x.cost, 0)) })).sort(sortCost) };
    },
  },
  {
    id: "recherches-qui-bougent", title: "Recherches qui bougent",
    description: "Les recherches dont les clics ont le plus changé face à la période d'avant : les nouvelles tendances, et celles qui s'éteignent.",
    category: "recherches", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "Search",
    columns: [{ key: "term", label: "Recherche", ...TXT }, { key: "clicks", label: "Clics", type: "int" }, { key: "clicksBefore", label: "Clics avant", type: "int" }, { key: "diff", label: "Écart", type: "int" }, { key: "conv", label: "Conv.", type: "num" }],
    async run(ctx, range) {
      const { now, before } = await compare(ctx, range, (d) => `SELECT search_term_view.search_term, metrics.clicks, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE ${d} AND metrics.clicks > 0`, (r) => r.searchTermView?.searchTerm ?? "");
      const keys = new Set([...now.keys(), ...before.keys()]);
      return { rows: [...keys].map((k) => { const n = now.get(k)?.sum ?? EMPTY, p = before.get(k)?.sum ?? EMPTY; return { term: k, clicks: n.clicks, clicksBefore: p.clicks, diff: n.clicks - p.clicks, conv: r2(n.conversions) }; })
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 200) };
    },
  },
  {
    id: "motifs-de-recherche", title: "Motifs de recherche",
    description: "Les mots et suites de 2 ou 3 mots qui reviennent dans vos recherches, coût et conversions additionnés : un mot qui coûte sans convertir se voit, même éparpillé sur 50 recherches.",
    category: "recherches", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "Search, Shopping",
    columns: [{ key: "pattern", label: "Motif", ...TXT }, { key: "terms", label: "Recherches", type: "int" }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT search_term_view.search_term, metrics.clicks, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE ${during(range)} AND metrics.clicks > 0`);
      const STOP = new Set(["les", "des", "une", "pour", "avec", "sur", "dans", "par", "pas", "est", "aux", "mon", "ma", "mes", "pres", "chez", "moi", "de", "la", "le", "du", "en", "et", "a"]);
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
      const bucket = new Map<string, { terms: Set<string>; cost: number; clicks: number; conversions: number }>();
      for (const r of rows) {
        const t = norm(r.searchTermView?.searchTerm ?? ""); const w = t.split(" "); const grams = new Set<string>();
        for (let n = 1; n <= 3; n++) for (let i = 0; i + n <= w.length; i++) { const gram = w.slice(i, i + n).join(" "); if (n === 1 && (gram.length < 3 || STOP.has(gram))) continue; grams.add(gram); }
        const m = M(r);
        grams.forEach((g) => { const b = bucket.get(g) ?? { terms: new Set<string>(), cost: 0, clicks: 0, conversions: 0 }; b.terms.add(t); b.cost += m.cost; b.clicks += m.clicks; b.conversions += m.conversions; bucket.set(g, b); });
      }
      return { rows: [...bucket.entries()].filter(([, b]) => b.terms.size >= 2).map(([pattern, b]) => ({ pattern, terms: b.terms.size, ...perf(b) })).sort(sortCost).slice(0, 300) };
    },
  },
  // ======================================================= Rapports
  {
    id: "jour-par-jour", title: "Jour par jour",
    description: "Impressions, clics, coût et conversions de chaque jour de la période, pour repérer le jour où tout a basculé.",
    category: "rapports", level: "Débutant", frequency: "Quotidien", channels: "Tous types",
    columns: [{ key: "date", label: "Jour", ...TXT }, { key: "impressions", label: "Impr.", type: "int" }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM customer WHERE ${during(range)}`);
      const g = groupSum(rows, (r) => r.segments?.date ?? "", M);
      return { rows: [...g.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, { sum }]) => ({ date, ...perf(sum) })) };
    },
  },
  {
    id: "semaine-par-semaine", title: "Semaine par semaine",
    description: "Les mêmes chiffres semaine par semaine : le bon rythme pour un point client.",
    category: "rapports", level: "Débutant", frequency: "Hebdomadaire", channels: "Tous types",
    columns: [{ key: "week", label: "Semaine du", ...TXT }, { key: "impressions", label: "Impr.", type: "int" }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT segments.week, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM customer WHERE ${during(range)}`);
      const g = groupSum(rows, (r) => r.segments?.week ?? "", M);
      return { rows: [...g.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([week, { sum }]) => ({ week, ...perf(sum) })) };
    },
  },
  {
    id: "treize-mois", title: "13 mois, mois par mois",
    description: "Les 13 derniers mois : chaque mois face au même mois de l'an dernier, pour séparer la saison de la vraie tendance.",
    category: "rapports", level: "Débutant", frequency: "Mensuel", channels: "Tous types",
    columns: [{ key: "month", label: "Mois", ...TXT }, { key: "cost", label: "Coût", type: "eur" }, { key: "conversions", label: "Conv.", type: "num" }, { key: "cpa", label: "CPA", type: "eur" }, { key: "costN1", label: "Coût N-1", type: "eur" }, { key: "convN1", label: "Conv. N-1", type: "num" }, { key: "dConv", label: "Évol. conv.", ...PCT }],
    async run(ctx) {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      const rows = await q(ctx, `SELECT segments.month, metrics.clicks, metrics.cost_micros, metrics.conversions FROM customer WHERE segments.date BETWEEN '${start}' AND '${end}'`);
      const g = groupSum(rows, (r) => String(r.segments?.month ?? "").slice(0, 7), M);
      const out = [];
      for (let i = 0; i < 13; i++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const key = d.toISOString().slice(0, 7);
        const n1 = new Date(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), 1)).toISOString().slice(0, 7);
        const a = g.get(key)?.sum ?? EMPTY, b = g.get(n1)?.sum ?? EMPTY;
        out.push({ month: key, cost: r2(a.cost), conversions: r2(a.conversions), cpa: r2(a.conversions ? a.cost / a.conversions : null), costN1: r2(b.cost), convN1: r2(b.conversions), dConv: delta(a.conversions, b.conversions) });
      }
      return { rows: out, summary: "Le mois en cours est incomplet." };
    },
  },
  {
    id: "depense-par-type", title: "Dépense par type de campagne",
    description: "Recherche, Performance Max, Display, Demand Gen : ce que chaque type de campagne coûte et rapporte.",
    category: "rapports", level: "Débutant", frequency: "Mensuel", channels: "Tous types",
    columns: [{ key: "type", label: "Type", ...TXT }, ...PERF_COLS, { key: "share", label: "Part dépense", ...PCT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.advertising_channel_type, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE ${during(range)} AND metrics.cost_micros > 0`);
      const g = groupSum(rows, (r) => r.campaign?.advertisingChannelType ?? "", M);
      const total = [...g.values()].reduce((s, x) => s + x.sum.cost, 0);
      return { rows: [...g.entries()].map(([type, { sum }]) => ({ type, ...perf(sum), share: r2(ratio(sum.cost, total)) })).sort(sortCost) };
    },
  },
  {
    id: "concentration-campagnes", title: "Concentration par campagne",
    description: "La part de la dépense de chaque campagne : un compte qui tient sur une seule campagne est fragile.",
    category: "rapports", level: "Débutant", frequency: "Mensuel", channels: "Tous types",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "cost", label: "Coût", type: "eur" }, { key: "share", label: "Part", ...PCT }, { key: "conversions", label: "Conv.", type: "num" }, { key: "convShare", label: "Part conv.", ...PCT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.name, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE ${during(range)} AND metrics.cost_micros > 0`);
      const tc = rows.reduce((s, r) => s + M(r).cost, 0), tv = rows.reduce((s, r) => s + M(r).conversions, 0);
      return { rows: rows.map((r) => { const m = M(r); return { campaign: r.campaign?.name ?? "", cost: m.cost, share: r2(ratio(m.cost, tc)), conversions: r2(m.conversions), convShare: r2(ratio(m.conversions, tv)) }; }).sort(sortCost) };
    },
  },
  {
    id: "reseaux", title: "Google, partenaires et Display",
    description: "Chaque campagne découpée par réseau : la recherche Google, les sites partenaires, le Display. Les partenaires convertissent souvent moins bien.",
    category: "rapports", level: "Intermédiaire", frequency: "Mensuel", channels: "Search, PMax",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "network", label: "Réseau", ...TXT }, ...PERF_COLS],
    async run(ctx, range) {
      const LBL: Record<string, string> = { SEARCH: "Recherche Google", SEARCH_PARTNERS: "Partenaires", CONTENT: "Display", YOUTUBE: "YouTube", MIXED: "Mixte", GOOGLE_TV: "Google TV" };
      const rows = await q(ctx, `SELECT campaign.name, segments.ad_network_type, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.impressions FROM campaign WHERE ${during(range)} AND metrics.impressions > 0`);
      const g = groupSum(rows, (r) => `${r.campaign?.name}|${r.segments?.adNetworkType}`, M);
      return { rows: [...g.values()].map(({ first, sum }) => ({ campaign: first.campaign?.name ?? "", network: LBL[first.segments?.adNetworkType] ?? first.segments?.adNetworkType, ...perf(sum) }))
        .sort((a, b) => String(a.campaign).localeCompare(String(b.campaign)) || sortCost(a, b)) };
    },
  },
  {
    id: "match-des-campagnes", title: "Le match des campagnes",
    description: "Coût, conversions et CPA de chaque campagne face à la période d'avant : qui progresse, qui recule.",
    category: "rapports", level: "Débutant", frequency: "Hebdomadaire", channels: "Tous types",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "cost", label: "Coût", type: "eur" }, { key: "dCost", label: "Évol.", ...PCT }, { key: "conv", label: "Conv.", type: "num" }, { key: "dConv", label: "Évol.", ...PCT }, { key: "cpa", label: "CPA", type: "eur" }, { key: "cpaBefore", label: "CPA avant", type: "eur" }],
    async run(ctx, range) {
      const { now, before } = await compare(ctx, range, (d) => `SELECT campaign.name, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE ${d} AND metrics.cost_micros > 0`, (r) => r.campaign?.name ?? "");
      const keys = new Set([...now.keys(), ...before.keys()]);
      return { rows: [...keys].map((k) => { const n = now.get(k)?.sum ?? EMPTY, p = before.get(k)?.sum ?? EMPTY;
        return { campaign: k, cost: r2(n.cost), dCost: delta(n.cost, p.cost), conv: r2(n.conversions), dConv: delta(n.conversions, p.conversions),
          cpa: r2(n.conversions ? n.cost / n.conversions : null), cpaBefore: r2(p.conversions ? p.cost / p.conversions : null) }; }).sort(sortCost) };
    },
  },
  {
    id: "pages-de-destination", title: "Pages de destination",
    description: "La dépense, les clics et les conversions de chaque page, de la plus chère à la moins chère : les pages qui coûtent sans convertir sautent aux yeux.",
    category: "rapports", level: "Débutant", frequency: "Hebdomadaire", channels: "Search, Shopping",
    columns: [{ key: "page", label: "Page", ...TXT }, ...PERF_COLS, { key: "cvr", label: "Taux conv.", ...PCT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT landing_page_view.unexpanded_final_url, metrics.clicks, metrics.cost_micros, metrics.conversions FROM landing_page_view WHERE ${during(range)} AND metrics.clicks > 0`);
      const g = groupSum(rows, (r) => r.landingPageView?.unexpandedFinalUrl ?? "", M);
      return { rows: [...g.entries()].map(([page, { sum }]) => ({ page, ...perf(sum) })).sort(sortCost) };
    },
  },
  {
    id: "clics-invalides", title: "Clics invalides",
    description: "La part des clics que Google a filtrés comme invalides, par campagne. Ils ne sont pas facturés, mais un taux élevé signale du trafic de robots ou de concurrents.",
    category: "diagnostic", level: "Débutant", frequency: "Hebdomadaire", channels: "Tous types",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "clicks", label: "Clics", type: "int" }, { key: "invalid", label: "Clics invalides", type: "int" }, { key: "rate", label: "Taux", ...PCT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.name, metrics.clicks, metrics.invalid_clicks, metrics.invalid_click_rate FROM campaign WHERE ${during(range)} AND metrics.clicks > 0`);
      return { rows: rows.map((r) => ({ campaign: r.campaign?.name ?? "", clicks: num(r.metrics?.clicks), invalid: num(r.metrics?.invalidClicks), rate: r2(num(r.metrics?.invalidClickRate)) })).sort((a, b) => Number(b.rate) - Number(a.rate)) };
    },
  },
  // ======================================================= Enchères et budget
  {
    id: "strategies-encheres", title: "Stratégies d'enchères",
    description: "La stratégie d'enchères de chaque campagne active, avec sa dépense et son coût par conversion sur la période.",
    category: "encheres_budget", level: "Intermédiaire", frequency: "Mensuel", channels: "Tous types",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "strategy", label: "Stratégie", ...TXT }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.name, campaign.bidding_strategy_type, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE ${during(range)} AND ${ENABLED}`);
      return { rows: rows.map((r) => ({ campaign: r.campaign?.name ?? "", strategy: r.campaign?.biddingStrategyType ?? "", ...perf(M(r)) })).sort(sortCost) };
    },
  },
  {
    id: "cibles-face-au-reel", title: "Cibles face au réel",
    description: "Le CPA ou le ROAS cible de chaque campagne face à ce qu'elle a vraiment fait : une cible trop serrée étouffe le volume.",
    category: "encheres_budget", level: "Intermédiaire", frequency: "Mensuel", channels: "Tous types",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "strategy", label: "Stratégie", ...TXT }, { key: "target", label: "Cible", ...TXT }, { key: "actual", label: "Réel", ...TXT }, { key: "verdict", label: "Lecture", ...TXT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.name, campaign.bidding_strategy_type, campaign.target_cpa.target_cpa_micros, campaign.maximize_conversions.target_cpa_micros,
          campaign.target_roas.target_roas, campaign.maximize_conversion_value.target_roas, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.clicks, metrics.impressions
        FROM campaign WHERE ${during(range)} AND ${ENABLED}`);
      const out = rows.map((r) => {
        const c = r.campaign ?? {}; const v = V(r);
        const tCpa = micros(c.targetCpa?.targetCpaMicros) || micros(c.maximizeConversions?.targetCpaMicros);
        const tRoas = num(c.targetRoas?.targetRoas) || num(c.maximizeConversionValue?.targetRoas);
        if (tCpa) { const cpa = v.conversions ? v.cost / v.conversions : null;
          return { campaign: c.name, strategy: c.biddingStrategyType, target: `CPA ${tCpa.toFixed(0)} €`, actual: cpa ? `CPA ${cpa.toFixed(0)} €` : "aucune conversion",
            verdict: cpa === null ? "pas assez de données" : cpa > tCpa * 1.2 ? "cible non tenue" : cpa < tCpa * 0.8 ? "cible peut-être trop serrée (volume bridé)" : "dans la cible" }; }
        if (tRoas) { const roas = v.cost ? v.value / v.cost : null;
          return { campaign: c.name, strategy: c.biddingStrategyType, target: `ROAS ${Math.round(tRoas * 100)} %`, actual: roas ? `ROAS ${Math.round(roas * 100)} %` : "aucune valeur",
            verdict: roas === null ? "pas assez de données" : roas < tRoas * 0.8 ? "cible non tenue" : roas > tRoas * 1.2 ? "cible peut-être trop haute (volume bridé)" : "dans la cible" }; }
        return null;
      }).filter(Boolean) as Row[];
      return { rows: out, summary: out.length ? undefined : "Aucune campagne avec un CPA ou un ROAS cible." };
    },
  },
  {
    id: "budgets-partages", title: "Budgets partagés",
    description: "Chaque budget partagé et les campagnes qui puisent dedans : pour voir qui mange le budget des autres.",
    category: "encheres_budget", level: "Débutant", frequency: "Mensuel", channels: "Search, Shopping, Display",
    columns: [{ key: "budget", label: "Budget", ...TXT }, { key: "amount", label: "Montant/jour", type: "eur" }, { key: "campaign", label: "Campagne", ...TXT }, { key: "cost", label: "Coût", type: "eur" }, { key: "share", label: "Part du budget consommé", ...PCT }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign_budget.name, campaign_budget.amount_micros, campaign.name, metrics.cost_micros FROM campaign
        WHERE ${during(range)} AND campaign_budget.explicitly_shared = TRUE`);
      const g = groupSum(rows, (r) => `${r.campaignBudget?.name}|${r.campaign?.name}`, (r) => ({ cost: micros(r.metrics?.costMicros) }));
      const tot = new Map<string, number>();
      g.forEach(({ first, sum }) => tot.set(first.campaignBudget?.name, (tot.get(first.campaignBudget?.name) ?? 0) + sum.cost));
      return { rows: [...g.values()].map(({ first, sum }) => ({ budget: first.campaignBudget?.name ?? "", amount: micros(first.campaignBudget?.amountMicros), campaign: first.campaign?.name ?? "", cost: r2(sum.cost), share: r2(ratio(sum.cost, tot.get(first.campaignBudget?.name) ?? 0)) })),
        summary: rows.length ? undefined : "Aucun budget partagé : chaque campagne a le sien." };
    },
  },
  {
    id: "modificateurs-fantomes", title: "Modificateurs fantômes",
    description: "Les ajustements d'enchères (appareil, zone, horaires) posés sur des campagnes en enchères automatiques, qui les ignorent : ils ne font qu'embrouiller.",
    category: "encheres_budget", level: "Débutant", frequency: "Mensuel", channels: "Search, Shopping, Display",
    columns: [{ key: "campaign", label: "Campagne", ...TXT }, { key: "strategy", label: "Stratégie", ...TXT }, { key: "type", label: "Ajustement", ...TXT }, { key: "modifier", label: "Valeur", ...TXT }],
    async run(ctx) {
      const rows = await q(ctx, `SELECT campaign.name, campaign.bidding_strategy_type, campaign_criterion.type, campaign_criterion.bid_modifier, campaign_criterion.device.type
        FROM campaign_criterion WHERE ${ENABLED} AND campaign_criterion.type IN ('DEVICE', 'LOCATION', 'AD_SCHEDULE', 'PROXIMITY')`);
      const MANUAL = ["MANUAL_CPC", "MANUAL_CPM", "MANUAL_CPV", "ENHANCED_CPC", "TARGET_IMPRESSION_SHARE"];
      return { rows: rows.filter((r) => { const b = r.campaignCriterion?.bidModifier; return b !== undefined && b !== null && Number(b) !== 1 && Number(b) !== 0 && !MANUAL.includes(r.campaign?.biddingStrategyType); })
        .map((r) => ({ campaign: r.campaign?.name ?? "", strategy: r.campaign?.biddingStrategyType ?? "", type: r.campaignCriterion?.type === "DEVICE" ? `Appareil ${r.campaignCriterion?.device?.type ?? ""}` : r.campaignCriterion?.type,
          modifier: `${Math.round((Number(r.campaignCriterion?.bidModifier) - 1) * 100)} %` })) };
    },
  },
];
