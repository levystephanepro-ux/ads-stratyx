// Lot 1 · Rapports de performance (calendrier, appareils, conversions, mots-clés,
// recherches, budget). Tous lisent la période choisie (7, 30 ou 90 jours).
import { during, groupSum, micros, num, perf, PERF_COLS, previousRange, q, r2, ratio, DAY_LABEL, DAY_ORDER, DEVICE_LABEL, MATCH_LABEL } from "./helpers";
import type { Row, ScriptDef } from "./types";

const ENABLED = "campaign.status = 'ENABLED'";
const M = (r: { metrics?: Record<string, unknown> }) => ({
  cost: micros(r.metrics?.costMicros),
  clicks: num(r.metrics?.clicks),
  impressions: num(r.metrics?.impressions),
  conversions: num(r.metrics?.conversions),
});
const sortCost = (a: Row, b: Row) => Number(b.cost ?? 0) - Number(a.cost ?? 0);

/** CPA du compte sur la période (référence pour les seuils). */
async function accountCpa(ctx: Parameters<ScriptDef["run"]>[0], range: Parameters<ScriptDef["run"]>[1]) {
  const t = await q(ctx, `SELECT metrics.cost_micros, metrics.conversions, metrics.clicks FROM customer WHERE ${during(range)}`);
  const cost = t.reduce((s, r) => s + micros(r.metrics?.costMicros), 0);
  const conv = t.reduce((s, r) => s + num(r.metrics?.conversions), 0);
  const clicks = t.reduce((s, r) => s + num(r.metrics?.clicks), 0);
  return { cost, conv, clicks, cpa: conv > 0 ? cost / conv : null, cpc: clicks > 0 ? cost / clicks : null };
}

export const PERFORMANCE_SCRIPTS: ScriptDef[] = [
  // ------------------------------------------------------------- Calendrier
  {
    id: "heure-par-heure",
    title: "Heure par heure",
    description: "Impressions, clics, coût et conversions de chaque heure de la journée, pour repérer les heures qui dépensent sans convertir.",
    category: "calendrier", level: "Débutant", frequency: "Mensuel", channels: "Search, Shopping, PMax",
    columns: [{ key: "hour", label: "Heure", type: "text" }, { key: "impressions", label: "Impr.", type: "int" }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT segments.hour, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
                                 FROM campaign WHERE ${during(range)}`);
      const g = groupSum(rows, (r) => String(r.segments?.hour ?? 0), M);
      const out = Array.from({ length: 24 }, (_, h) => {
        const s = g.get(String(h))?.sum ?? { cost: 0, clicks: 0, impressions: 0, conversions: 0 };
        return { hour: `${String(h).padStart(2, "0")} h`, ...perf(s) };
      });
      const dead = out.filter((r) => Number(r.cost) > 0 && Number(r.conversions) === 0).map((r) => r.hour);
      return { rows: out, summary: dead.length ? `Heures qui dépensent sans convertir : ${dead.join(", ")}.` : undefined };
    },
  },
  {
    id: "jours-semaine",
    title: "Jours de la semaine",
    description: "Les mêmes chiffres du lundi au dimanche, pour savoir quels jours méritent plus de budget.",
    category: "calendrier", level: "Débutant", frequency: "Mensuel", channels: "Search, Shopping, PMax",
    columns: [{ key: "day", label: "Jour", type: "text" }, { key: "impressions", label: "Impr.", type: "int" }, ...PERF_COLS, { key: "cvr", label: "Taux conv.", type: "pct" }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT segments.day_of_week, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
                                 FROM campaign WHERE ${during(range)}`);
      const g = groupSum(rows, (r) => r.segments?.dayOfWeek ?? "", M);
      return {
        rows: DAY_ORDER.map((d) => ({ day: DAY_LABEL[d], ...perf(g.get(d)?.sum ?? { cost: 0, clicks: 0, impressions: 0, conversions: 0 }) })),
      };
    },
  },
  // ------------------------------------------------------------- Rapports
  {
    id: "par-appareil",
    title: "Par appareil",
    description: "Chaque campagne sur mobile, ordinateur et tablette : un appareil qui coûte deux fois plus cher par conversion se repère d'un coup d'œil.",
    category: "rapports", level: "Débutant", frequency: "Mensuel", channels: "Search, Shopping, PMax",
    columns: [{ key: "campaign", label: "Campagne", type: "text" }, { key: "device", label: "Appareil", type: "text" }, ...PERF_COLS, { key: "cvr", label: "Taux conv.", type: "pct" }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.name, segments.device, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.impressions
                                 FROM campaign WHERE ${during(range)} AND metrics.impressions > 0`);
      const g = groupSum(rows, (r) => `${r.campaign?.name}|${r.segments?.device}`, M);
      const out = [...g.values()].map(({ first, sum }) => ({
        campaign: first.campaign?.name ?? "", device: DEVICE_LABEL[first.segments?.device] ?? first.segments?.device, ...perf(sum),
      }));
      return { rows: out.sort((a, b) => String(a.campaign).localeCompare(String(b.campaign)) || sortCost(a, b)) };
    },
  },
  {
    id: "cpa-par-campagne",
    title: "CPA par campagne",
    description: "Coût, conversions et coût par conversion de chaque campagne, les plus dépensières d'abord.",
    category: "cpc_cpa", level: "Débutant", frequency: "Hebdomadaire", channels: "Tous types",
    columns: [{ key: "campaign", label: "Campagne", type: "text" }, { key: "impressions", label: "Impr.", type: "int" }, ...PERF_COLS, { key: "cvr", label: "Taux conv.", type: "pct" }],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
                                 FROM campaign WHERE ${during(range)} AND metrics.cost_micros > 0`);
      return { rows: rows.map((r) => ({ campaign: r.campaign?.name ?? "", ...perf(M(r)) })).sort(sortCost) };
    },
  },
  {
    id: "point-semaine",
    title: "Le point de la période",
    description: "Impressions, clics, CTR, CPC, coût, conversions et CPA de la période face à la précédente, avec l'évolution de chacun.",
    category: "rapports", level: "Débutant", frequency: "Hebdomadaire", channels: "Tous types",
    columns: [
      { key: "metric", label: "Indicateur", type: "text" },
      { key: "now", label: "Période", type: "num" },
      { key: "before", label: "Précédente", type: "num" },
      { key: "delta", label: "Évolution", type: "pct" },
    ],
    async run(ctx, range) {
      const prev = previousRange(range);
      const sel = `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM customer WHERE `;
      const [a, b] = await Promise.all([q(ctx, sel + during(range)), q(ctx, sel + during(prev))]);
      const tot = (rows: typeof a) => rows.reduce((s, r) => {
        const m = M(r);
        return { cost: s.cost + m.cost, clicks: s.clicks + m.clicks, impressions: s.impressions + m.impressions, conversions: s.conversions + m.conversions };
      }, { cost: 0, clicks: 0, impressions: 0, conversions: 0 });
      const x = tot(a), y = tot(b);
      const line = (metric: string, n: number | null, p: number | null) => ({
        metric, now: r2(n), before: r2(p), delta: n !== null && p ? r2((n - p) / p) : null,
      });
      return {
        rows: [
          line("Impressions", x.impressions, y.impressions),
          line("Clics", x.clicks, y.clicks),
          line("CTR (%)", ratio(x.clicks, x.impressions) !== null ? ratio(x.clicks, x.impressions)! * 100 : null, ratio(y.clicks, y.impressions) !== null ? ratio(y.clicks, y.impressions)! * 100 : null),
          line("CPC (€)", ratio(x.cost, x.clicks), ratio(y.cost, y.clicks)),
          line("Coût (€)", x.cost, y.cost),
          line("Conversions", x.conversions, y.conversions),
          line("CPA (€)", ratio(x.cost, x.conversions), ratio(y.cost, y.conversions)),
        ],
        summary: `Du ${range.since} au ${range.until}, comparé au ${prev.since} → ${prev.until}.`,
      };
    },
  },
  // ------------------------------------------------------------- Conversions
  {
    id: "conversions-par-action",
    title: "Conversions par action",
    description: "Ce que chaque action de conversion a compté sur la période : une action à zéro depuis des jours signale un suivi cassé.",
    category: "conversions", level: "Débutant", frequency: "Hebdomadaire", channels: "Tous types",
    columns: [
      { key: "action", label: "Action de conversion", type: "text" },
      { key: "conversions", label: "Conversions", type: "num" },
      { key: "allConversions", label: "Toutes conv.", type: "num" },
      { key: "last7", label: "7 derniers jours", type: "num" },
    ],
    async run(ctx, range) {
      const last7 = { ...range, since: new Date(Date.parse(range.until) - 6 * 864e5).toISOString().slice(0, 10), days: 7 };
      const sel = `SELECT segments.conversion_action_name, metrics.conversions, metrics.all_conversions FROM customer WHERE `;
      const [all, week, actions] = await Promise.all([
        q(ctx, sel + during(range)),
        q(ctx, sel + during(last7)),
        q(ctx, `SELECT conversion_action.name FROM conversion_action WHERE conversion_action.status = 'ENABLED'`),
      ]);
      const g = groupSum(all, (r) => r.segments?.conversionActionName ?? "", (r) => ({ c: num(r.metrics?.conversions), a: num(r.metrics?.allConversions) }));
      const w = groupSum(week, (r) => r.segments?.conversionActionName ?? "", (r) => ({ a: num(r.metrics?.allConversions) }));
      const names = new Set([...actions.map((a) => a.conversionAction?.name as string), ...g.keys()]);
      const out = [...names].filter(Boolean).map((n) => ({
        action: n, conversions: r2(g.get(n)?.sum.c ?? 0), allConversions: r2(g.get(n)?.sum.a ?? 0), last7: r2(w.get(n)?.sum.a ?? 0),
      })).sort((a, b) => Number(b.allConversions) - Number(a.allConversions));
      const zero = out.filter((r) => Number(r.last7) === 0).length;
      return { rows: out, summary: zero ? `${zero} action(s) active(s) à zéro sur les 7 derniers jours : vérifie leur déclenchement.` : undefined };
    },
  },
  {
    id: "appels-recus",
    title: "Appels reçus",
    description: "Les appels passés depuis vos annonces, reçus ou manqués, et leur durée : payer des appels sans réponse se voit ici.",
    category: "conversions", level: "Débutant", frequency: "Hebdomadaire", channels: "Search",
    columns: [
      { key: "date", label: "Date", type: "text" },
      { key: "campaign", label: "Campagne", type: "text" },
      { key: "status", label: "Statut", type: "text" },
      { key: "duration", label: "Durée (s)", type: "int" },
      { key: "area", label: "Indicatif", type: "text" },
    ],
    async run(ctx, range) {
      const rows = await q(ctx, `
        SELECT call_view.start_call_date_time, call_view.call_status, call_view.call_duration_seconds,
               call_view.caller_area_code, campaign.name
        FROM call_view
        WHERE call_view.start_call_date_time >= '${range.since} 00:00:00' AND call_view.start_call_date_time <= '${range.until} 23:59:59'
        ORDER BY call_view.start_call_date_time DESC`);
      const out = rows.map((r) => ({
        date: String(r.callView?.startCallDateTime ?? "").slice(0, 16),
        campaign: r.campaign?.name ?? "",
        status: r.callView?.callStatus === "MISSED" ? "Manqué" : r.callView?.callStatus === "RECEIVED" ? "Reçu" : r.callView?.callStatus ?? "",
        duration: num(r.callView?.callDurationSeconds),
        area: r.callView?.callerAreaCode ?? "",
      }));
      const missed = out.filter((r) => r.status === "Manqué").length;
      return { rows: out, summary: out.length ? `${out.length} appel(s), dont ${missed} manqué(s).` : "Aucun appel suivi sur la période (extension d'appel absente ou suivi des appels désactivé)." };
    },
  },
  // ------------------------------------------------------------- Mots-clés
  {
    id: "mots-cles-gouffres",
    title: "Mots-clés gouffres",
    description: "Les mots-clés qui ont dépensé au moins un CPA du compte sans une seule conversion : les premiers à couper ou à revoir.",
    category: "cpc_cpa", level: "Débutant", frequency: "Hebdomadaire", channels: "Search",
    columns: [{ key: "keyword", label: "Mot-clé", type: "text" }, { key: "match", label: "Corresp.", type: "text" }, { key: "where", label: "Campagne › groupe", type: "text" }, ...PERF_COLS],
    async run(ctx, range) {
      const [acc, rows] = await Promise.all([
        accountCpa(ctx, range),
        q(ctx, `SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
                       metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.impressions
                FROM keyword_view WHERE ${during(range)} AND metrics.cost_micros > 0`),
      ]);
      const seuil = acc.cpa ?? 50;
      const out = rows.map((r) => ({
        keyword: r.adGroupCriterion?.keyword?.text ?? "", match: MATCH_LABEL[r.adGroupCriterion?.keyword?.matchType] ?? "",
        where: `${r.campaign?.name} › ${r.adGroup?.name}`, ...perf(M(r)),
      })).filter((r) => Number(r.conversions) === 0 && Number(r.cost) >= seuil).sort(sortCost);
      return { rows: out, summary: `Seuil : ${Math.round(seuil)} € (CPA du compte${acc.cpa ? "" : " inconnu, 50 € par défaut"}).` };
    },
  },
  {
    id: "mots-cles-stars",
    title: "Mots-clés stars",
    description: "Les mots-clés qui convertissent à moins de 60 % du CPA du compte : à protéger, à pousser, à décliner.",
    category: "cpc_cpa", level: "Intermédiaire", frequency: "Mensuel", channels: "Search",
    columns: [{ key: "keyword", label: "Mot-clé", type: "text" }, { key: "match", label: "Corresp.", type: "text" }, { key: "where", label: "Campagne › groupe", type: "text" }, ...PERF_COLS],
    async run(ctx, range) {
      const [acc, rows] = await Promise.all([
        accountCpa(ctx, range),
        q(ctx, `SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
                       metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.impressions
                FROM keyword_view WHERE ${during(range)} AND metrics.conversions > 0`),
      ]);
      if (!acc.cpa) return { rows: [], summary: "Aucune conversion sur la période." };
      const out = rows.map((r) => ({
        keyword: r.adGroupCriterion?.keyword?.text ?? "", match: MATCH_LABEL[r.adGroupCriterion?.keyword?.matchType] ?? "",
        where: `${r.campaign?.name} › ${r.adGroup?.name}`, ...perf(M(r)),
      })).filter((r) => Number(r.cpa) <= acc.cpa! * 0.6).sort((a, b) => Number(b.conversions) - Number(a.conversions));
      return { rows: out, summary: `CPA du compte : ${Math.round(acc.cpa)} €. Seuil « star » : ${Math.round(acc.cpa * 0.6)} €.` };
    },
  },
  {
    id: "score-qualite",
    title: "Score de qualité des mots-clés",
    description: "Le score de qualité de chaque mot-clé et ses trois composantes (annonce, page, taux de clics attendu), du plus cher au moins cher.",
    category: "mots_cles", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "Search",
    columns: [
      { key: "keyword", label: "Mot-clé", type: "text" }, { key: "where", label: "Campagne › groupe", type: "text" },
      { key: "qs", label: "QS", type: "int" }, { key: "ad", label: "Annonce", type: "text" },
      { key: "page", label: "Page", type: "text" }, { key: "ctr", label: "CTR attendu", type: "text" },
      { key: "cost", label: "Coût", type: "eur" },
    ],
    async run(ctx, range) {
      const LBL: Record<string, string> = { BELOW_AVERAGE: "Inférieur", AVERAGE: "Moyen", ABOVE_AVERAGE: "Supérieur" };
      const rows = await q(ctx, `
        SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.quality_info.quality_score,
               ad_group_criterion.quality_info.creative_quality_score, ad_group_criterion.quality_info.post_click_quality_score,
               ad_group_criterion.quality_info.search_predicted_ctr, metrics.cost_micros
        FROM keyword_view WHERE ${during(range)} AND metrics.impressions > 0`);
      const g = groupSum(rows, (r) => `${r.adGroup?.name}|${r.adGroupCriterion?.keyword?.text}`, (r) => ({ cost: micros(r.metrics?.costMicros) }));
      const out = [...g.values()].map(({ first: r, sum }) => {
        const qi = r.adGroupCriterion?.qualityInfo ?? {};
        return {
          keyword: r.adGroupCriterion?.keyword?.text ?? "", where: `${r.campaign?.name} › ${r.adGroup?.name}`,
          qs: qi.qualityScore ?? null, ad: LBL[qi.creativeQualityScore] ?? "–", page: LBL[qi.postClickQualityScore] ?? "–",
          ctr: LBL[qi.searchPredictedCtr] ?? "–", cost: r2(sum.cost),
        };
      }).sort(sortCost);
      const low = out.filter((r) => r.qs !== null && Number(r.qs) <= 4).length;
      return { rows: out, summary: low ? `${low} mot(s)-clé(s) avec un score de qualité de 4 ou moins.` : undefined };
    },
  },
  // ------------------------------------------------------------- Recherches
  {
    id: "recherches-gouffres",
    title: "Recherches gouffres",
    description: "Les 200 recherches les plus chères sans aucune conversion sur la période.",
    category: "recherches", level: "Débutant", frequency: "Hebdomadaire", channels: "Search, Shopping",
    columns: [{ key: "term", label: "Recherche", type: "text" }, { key: "campaign", label: "Campagne", type: "text" }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT search_term_view.search_term, campaign.name, metrics.clicks, metrics.cost_micros, metrics.conversions
                                 FROM search_term_view WHERE ${during(range)} AND metrics.cost_micros > 0`);
      const g = groupSum(rows, (r) => `${r.searchTermView?.searchTerm}|${r.campaign?.name}`, M);
      const out = [...g.values()].map(({ first, sum }) => ({ term: first.searchTermView?.searchTerm ?? "", campaign: first.campaign?.name ?? "", ...perf(sum) }))
        .filter((r) => Number(r.conversions) === 0).sort(sortCost).slice(0, 200);
      const total = out.reduce((s, r) => s + Number(r.cost), 0);
      return { rows: out, summary: `${Math.round(total)} € dépensés sur ${out.length} recherche(s) sans conversion.` };
    },
  },
  {
    id: "recherches-stars",
    title: "Recherches stars",
    description: "Les recherches qui ont converti, des plus convertissantes aux moins, avec leur coût par conversion.",
    category: "recherches", level: "Débutant", frequency: "Hebdomadaire", channels: "Search",
    columns: [{ key: "term", label: "Recherche", type: "text" }, { key: "campaign", label: "Campagne", type: "text" }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT search_term_view.search_term, campaign.name, metrics.clicks, metrics.cost_micros, metrics.conversions
                                 FROM search_term_view WHERE ${during(range)} AND metrics.conversions > 0`);
      const g = groupSum(rows, (r) => `${r.searchTermView?.searchTerm}|${r.campaign?.name}`, M);
      return { rows: [...g.values()].map(({ first, sum }) => ({ term: first.searchTermView?.searchTerm ?? "", campaign: first.campaign?.name ?? "", ...perf(sum) }))
        .sort((a, b) => Number(b.conversions) - Number(a.conversions)) };
    },
  },
  {
    id: "recherches-a-ajouter",
    title: "Recherches à ajouter",
    description: "Les recherches qui convertissent mais ne sont pas encore des mots-clés : les ajouter vous rend la main sur leur enchère.",
    category: "recherches", level: "Débutant", frequency: "Hebdomadaire", channels: "Search, Shopping",
    columns: [{ key: "term", label: "Recherche", type: "text" }, { key: "where", label: "Campagne › groupe", type: "text" }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT search_term_view.search_term, search_term_view.status, campaign.name, ad_group.name,
                                        metrics.clicks, metrics.cost_micros, metrics.conversions
                                 FROM search_term_view WHERE ${during(range)} AND metrics.conversions > 0`);
      const g = groupSum(rows.filter((r) => (r.searchTermView?.status ?? "NONE") === "NONE"),
        (r) => `${r.searchTermView?.searchTerm}|${r.adGroup?.name}`, M);
      return { rows: [...g.values()].map(({ first, sum }) => ({ term: first.searchTermView?.searchTerm ?? "", where: `${first.campaign?.name} › ${first.adGroup?.name}`, ...perf(sum) }))
        .sort((a, b) => Number(b.conversions) - Number(a.conversions)) };
    },
  },
  {
    id: "motifs-sans-conversion",
    title: "Motifs sans conversion",
    description: "Les mots et suites de 2 ou 3 mots présents dans au moins 2 recherches qui n'ont jamais converti, du plus cher au moins cher : vos meilleurs candidats négatifs.",
    category: "recherches", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "Search, Shopping",
    columns: [{ key: "pattern", label: "Motif", type: "text" }, { key: "terms", label: "Recherches", type: "int" }, ...PERF_COLS],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT search_term_view.search_term, metrics.clicks, metrics.cost_micros, metrics.conversions
                                 FROM search_term_view WHERE ${during(range)} AND metrics.clicks > 0`);
      const STOP = new Set(["les", "des", "une", "pour", "avec", "sur", "dans", "par", "pas", "est", "aux", "mon", "ma", "mes", "pres", "chez", "moi", "de", "la", "le", "du", "en", "et", "a"]);
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
      const bucket = new Map<string, { terms: Set<string>; cost: number; clicks: number; conversions: number }>();
      for (const r of rows) {
        const t = norm(r.searchTermView?.searchTerm ?? "");
        const w = t.split(" ");
        const grams = new Set<string>();
        for (let n = 1; n <= 3; n++) for (let i = 0; i + n <= w.length; i++) {
          const gram = w.slice(i, i + n).join(" ");
          if (n === 1 && (gram.length < 3 || STOP.has(gram))) continue;
          grams.add(gram);
        }
        const m = M(r);
        grams.forEach((g) => {
          const b = bucket.get(g) ?? { terms: new Set<string>(), cost: 0, clicks: 0, conversions: 0 };
          b.terms.add(t); b.cost += m.cost; b.clicks += m.clicks; b.conversions += m.conversions;
          bucket.set(g, b);
        });
      }
      const out = [...bucket.entries()].filter(([, b]) => b.terms.size >= 2 && b.conversions === 0)
        .map(([pattern, b]) => ({ pattern, terms: b.terms.size, ...perf(b) })).sort(sortCost).slice(0, 200);
      return { rows: out };
    },
  },
  // ------------------------------------------------------------- Enchères et budget
  {
    id: "parts-impressions",
    title: "Parts d'impressions",
    description: "Pour chaque campagne de recherche : la part des impressions obtenues, celle perdue faute de budget, celle perdue par le classement, et la présence en haut de page.",
    category: "encheres_budget", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "Search",
    columns: [
      { key: "campaign", label: "Campagne", type: "text" }, { key: "is", label: "Part obtenue", type: "pct" },
      { key: "lostBudget", label: "Perdue (budget)", type: "pct" }, { key: "lostRank", label: "Perdue (classement)", type: "pct" },
      { key: "top", label: "Haut de page", type: "pct" }, { key: "absTop", label: "1re position", type: "pct" },
    ],
    async run(ctx, range) {
      const rows = await q(ctx, `
        SELECT campaign.name, metrics.search_impression_share, metrics.search_budget_lost_impression_share,
               metrics.search_rank_lost_impression_share, metrics.search_top_impression_share,
               metrics.search_absolute_top_impression_share, metrics.cost_micros
        FROM campaign WHERE ${during(range)} AND campaign.advertising_channel_type = 'SEARCH' AND metrics.impressions > 0`);
      const v = (x: unknown) => (x === undefined || x === null ? null : r2(Number(x)));
      return { rows: rows.map((r) => ({
        campaign: r.campaign?.name ?? "", is: v(r.metrics?.searchImpressionShare), lostBudget: v(r.metrics?.searchBudgetLostImpressionShare),
        lostRank: v(r.metrics?.searchRankLostImpressionShare), top: v(r.metrics?.searchTopImpressionShare), absTop: v(r.metrics?.searchAbsoluteTopImpressionShare),
      })) };
    },
  },
  {
    id: "campagnes-bridees",
    title: "Campagnes bridées par le budget",
    description: "Les campagnes qui perdent plus de 10 % de leurs impressions faute de budget, avec leur budget du jour et leur coût par conversion.",
    category: "encheres_budget", level: "Intermédiaire", frequency: "Hebdomadaire", channels: "Search",
    columns: [
      { key: "campaign", label: "Campagne", type: "text" }, { key: "lostBudget", label: "Perdue (budget)", type: "pct" },
      { key: "budget", label: "Budget/jour", type: "eur" }, ...PERF_COLS,
    ],
    async run(ctx, range) {
      const rows = await q(ctx, `
        SELECT campaign.name, campaign_budget.amount_micros, metrics.search_budget_lost_impression_share,
               metrics.cost_micros, metrics.clicks, metrics.conversions
        FROM campaign WHERE ${during(range)} AND campaign.advertising_channel_type = 'SEARCH' AND ${ENABLED}`);
      return { rows: rows.filter((r) => Number(r.metrics?.searchBudgetLostImpressionShare ?? 0) > 0.1).map((r) => ({
        campaign: r.campaign?.name ?? "", lostBudget: r2(Number(r.metrics?.searchBudgetLostImpressionShare)),
        budget: micros(r.campaignBudget?.amountMicros), ...perf(M(r)),
      })) };
    },
  },
  {
    id: "mois-en-cours",
    title: "Le mois en cours",
    description: "La dépense du mois de chaque campagne et sa projection de fin de mois au rythme actuel, face au budget : le plafond mensuel que Google n'a pas.",
    category: "encheres_budget", level: "Débutant", frequency: "Quotidien", channels: "Tous types",
    columns: [
      { key: "campaign", label: "Campagne", type: "text" }, { key: "spent", label: "Dépensé ce mois", type: "eur" },
      { key: "projection", label: "Projection fin de mois", type: "eur" }, { key: "budgetMonth", label: "Budget mensuel", type: "eur" },
      { key: "gap", label: "Écart", type: "pct" },
    ],
    async run(ctx) {
      const rows = await q(ctx, `SELECT campaign.name, campaign_budget.amount_micros, metrics.cost_micros
                                 FROM campaign WHERE segments.date DURING THIS_MONTH AND ${ENABLED}`);
      const now = new Date();
      const day = Math.max(1, now.getUTCDate() - 1); // jours complets écoulés
      const dim = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
      const out = rows.map((r) => {
        const spent = micros(r.metrics?.costMicros);
        const budgetMonth = r2(micros(r.campaignBudget?.amountMicros) * 30.4)!;
        const projection = r2((spent / day) * dim)!;
        return { campaign: r.campaign?.name ?? "", spent, projection, budgetMonth, gap: budgetMonth ? r2((projection - budgetMonth) / budgetMonth) : null };
      }).sort(sortCost);
      const s = out.reduce((a, r) => ({ spent: a.spent + r.spent, proj: a.proj + Number(r.projection) }), { spent: 0, proj: 0 });
      return { rows: out, summary: `Total : ${Math.round(s.spent)} € dépensés, ${Math.round(s.proj)} € projetés en fin de mois.` };
    },
  },
  {
    id: "budget-jour-depasse",
    title: "Budget du jour dépassé",
    description: "Les jours où une campagne a dépensé au moins 20 % de plus que son budget du jour (Google peut aller jusqu'au double), avec les conversions obtenues ces jours-là.",
    category: "encheres_budget", level: "Débutant", frequency: "Quotidien", channels: "Tous types",
    columns: [
      { key: "date", label: "Jour", type: "text" }, { key: "campaign", label: "Campagne", type: "text" },
      { key: "budget", label: "Budget/jour", type: "eur" }, { key: "cost", label: "Dépensé", type: "eur" },
      { key: "over", label: "Dépassement", type: "pct" }, { key: "conversions", label: "Conv.", type: "num" },
    ],
    async run(ctx, range) {
      const rows = await q(ctx, `SELECT segments.date, campaign.name, campaign_budget.amount_micros, metrics.cost_micros, metrics.conversions
                                 FROM campaign WHERE ${during(range)} AND metrics.cost_micros > 0`);
      return { rows: rows.map((r) => {
        const budget = micros(r.campaignBudget?.amountMicros);
        const cost = micros(r.metrics?.costMicros);
        return { date: r.segments?.date ?? "", campaign: r.campaign?.name ?? "", budget, cost, over: budget ? r2((cost - budget) / budget) : null, conversions: r2(num(r.metrics?.conversions)) };
      }).filter((r) => r.over !== null && r.over >= 0.2).sort((a, b) => String(b.date).localeCompare(String(a.date))) };
    },
  },
  // ------------------------------------------------------------- Annonces
  {
    id: "annonces-refusees",
    title: "Annonces refusées",
    description: "Les annonces actives refusées ou limitées par Google, avec les règles en cause, avant qu'un groupe d'annonces cesse de diffuser.",
    category: "annonces", level: "Débutant", frequency: "Quotidien", channels: "Search, Display, YouTube",
    columns: [
      { key: "where", label: "Campagne › groupe", type: "text" }, { key: "ad", label: "Annonce", type: "text" },
      { key: "status", label: "Statut", type: "text" }, { key: "topics", label: "Règles en cause", type: "text" },
    ],
    async run(ctx) {
      const rows = await q(ctx, `
        SELECT campaign.name, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.type,
               ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.policy_topic_entries
        FROM ad_group_ad
        WHERE ${ENABLED} AND ad_group.status = 'ENABLED' AND ad_group_ad.status = 'ENABLED'
          AND ad_group_ad.policy_summary.approval_status IN ('DISAPPROVED', 'APPROVED_LIMITED', 'AREA_OF_INTEREST_ONLY')`);
      return { rows: rows.map((r) => ({
        where: `${r.campaign?.name} › ${r.adGroup?.name}`, ad: `${r.adGroupAd?.ad?.type ?? ""} #${r.adGroupAd?.ad?.id ?? ""}`,
        status: r.adGroupAd?.policySummary?.approvalStatus === "DISAPPROVED" ? "Refusée" : "Limitée",
        topics: (r.adGroupAd?.policySummary?.policyTopicEntries ?? []).map((e: { topic?: string }) => e.topic).filter(Boolean).join(", "),
      })) };
    },
  },
];
