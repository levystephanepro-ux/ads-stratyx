// Règles du diagnostic : fonctions pures, testables, sans IA.
import { detectWaste, formatNegatives, pZeroConversions } from "@/lib/waste/detect";
import { negativeConflicts } from "./negatives";
import type { AuditCategory, AuditData, AuditResult, Constat, Severity } from "./types";

export interface AuditOptions {
  /** CPA cible (€). Sinon CPA moyen du compte. */
  targetCpa?: number;
  alpha?: number;
}

const r0 = (n: number) => Math.round(n);
const eur = (n: number) => `${r0(n).toLocaleString("fr-FR")} €`;
const pct = (x: number) => `${Math.round(x * 100)} %`;

function accountStats(data: AuditData) {
  const cost = data.campaigns.reduce((s, c) => s + c.cost, 0);
  const clicks = data.campaigns.reduce((s, c) => s + c.clicks, 0);
  const conv = data.campaigns.reduce((s, c) => s + c.conversions, 0);
  return { cost, clicks, conv, cvr: clicks > 0 ? conv / clicks : 0, cpa: conv > 0 ? cost / conv : null };
}

// ---------------------------------------------------------------- Recherches
function searchTermRules(data: AuditData, cpaRef: number, alpha: number) {
  const report = detectWaste(data.searchTerms, { targetCpa: cpaRef, alpha });
  const constats: Constat[] = report.findings.map((f) => ({
    id: `recherche:${f.category}:${f.key.toLowerCase()}`,
    category: "recherches" as const,
    severity: (f.level === "prouve" ? "important" : "mineur") as Severity,
    title:
      f.category === "intention"
        ? `Recherches « ${f.key} » : dépense sans client possible`
        : `« ${f.key} »${f.terms.length > 1 ? ` et ${f.terms.length - 1} variante(s)` : ""} : dépense sans convertir`,
    detail: `${f.reason}${f.terms.length > 1 ? ` Exemples : ${f.terms.slice(0, 4).join(" · ")}.` : ""}`,
    campaign: f.campaigns.length === 1 ? f.campaigns[0] : null,
    amount: f.cost,
    action:
      f.level === "prouve"
        ? "Ajoute le négatif proposé."
        : "Trop tôt pour conclure : surveille, ou exclus si l'intention est clairement hors cible.",
    paste: formatNegatives(f.negatives),
  }));
  return { constats, proven: report.wasteProven, watch: report.wasteWatch };
}

// ---------------------------------------------------------------- Mots-clés
function keywordRules(data: AuditData, cvr: number, cpaRef: number, alpha: number): Constat[] {
  const out: Constat[] = [];
  for (const k of data.keywords) {
    const label = k.matchType === "EXACT" ? `[${k.text}]` : k.matchType === "PHRASE" ? `"${k.text}"` : k.text;
    if (k.conversions === 0 && k.cost > 0) {
      const p = pZeroConversions(k.clicks, Math.max(cvr, 0.01));
      if (p < alpha) {
        out.push({
          id: `kw:nonconv:${k.adGroupId}:${k.text}`,
          category: "mots_cles",
          severity: "important",
          title: `${label} : ${eur(k.cost)} dépensés sans conversion`,
          detail: `${k.clicks} clics, 0 conversion : ${pct(p)} de chance que ce soit le hasard. ${k.campaign} › ${k.adGroup}.`,
          campaign: k.campaign,
          amount: k.cost,
          action: "Mets-le en pause ou resserre la correspondance, puis vérifie les recherches qu'il déclenche.",
        });
      } else if (k.cost >= cpaRef * 0.5) {
        out.push({
          id: `kw:watch:${k.adGroupId}:${k.text}`,
          category: "mots_cles",
          severity: "mineur",
          title: `${label} : dépense sans convertir`,
          detail: `${eur(k.cost)}, ${k.clicks} clics, 0 conversion. Trop tôt pour conclure. ${k.campaign} › ${k.adGroup}.`,
          campaign: k.campaign,
          amount: k.cost,
          action: "Surveille : si rien ne convertit d'ici 2 semaines, baisse l'enchère ou mets en pause.",
        });
      }
    }
    if (k.qualityScore !== null && k.qualityScore <= 3 && k.impressions >= 20) {
      out.push({
        id: `kw:qs:${k.adGroupId}:${k.text}`,
        category: "mots_cles",
        severity: "mineur",
        title: `${label} : Quality Score de ${k.qualityScore}/10`,
        detail: `Tu paies chaque clic plus cher que tes concurrents. ${k.impressions} impressions, CPC moyen ${k.clicks ? eur(k.cost / k.clicks) : "–"}.`,
        campaign: k.campaign,
        amount: null,
        action: "Rapproche l'annonce et la page de ce mot-clé (le mot dans le titre, une page dédiée).",
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- Budgets
function budgetRules(data: AuditData, acctCpa: number | null, cvr: number, alpha: number): Constat[] {
  const out: Constat[] = [];
  for (const c of data.campaigns) {
    if (c.cost <= 0) continue;
    const cpa = c.conversions > 0 ? c.cost / c.conversions : null;
    const lb = c.lostBudget ?? 0;
    if (lb >= 0.1 && c.conversions > 0 && (acctCpa === null || (cpa ?? Infinity) <= acctCpa * 1.2)) {
      const is = c.impressionShare ?? 0;
      const perDay = c.cost / 30;
      const needed = is > 0 ? (perDay * (is + lb)) / is : null;
      out.push({
        id: `budget:limite:${c.id}`,
        category: "budgets",
        severity: "important",
        title: `« ${c.name} » convertit mais manque de budget`,
        detail:
          `${pct(lb)} d'impressions perdues faute de budget. CPA ${cpa ? eur(cpa) : "–"}` +
          `${acctCpa ? ` (compte ${eur(acctCpa)})` : ""}, budget actuel ${eur(c.dailyBudget)} par jour.`,
        campaign: c.name,
        amount: null,
        action: needed
          ? `Si ce CPA te convient, monte vers ${eur(needed)} par jour, ou resserre le ciblage pour rester au même budget.`
          : "Si ce CPA te convient, augmente le budget ou resserre le ciblage.",
      });
    } else if (lb >= 0.1 && c.conversions === 0) {
      out.push({
        id: `budget:limite-sansconv:${c.id}`,
        category: "budgets",
        severity: "mineur",
        title: `« ${c.name} » est limitée par le budget mais ne convertit pas`,
        detail: `${pct(lb)} d'impressions perdues faute de budget, ${eur(c.cost)} dépensés, 0 conversion.`,
        campaign: c.name,
        amount: null,
        action: "N'augmente pas le budget : corrige d'abord ce qui ne convertit pas.",
      });
    }
    if (c.conversions === 0 && pZeroConversions(c.clicks, Math.max(cvr, 0.01)) < alpha) {
      out.push({
        id: `budget:campagne-sansconv:${c.id}`,
        category: "budgets",
        severity: "important",
        title: `« ${c.name} » : ${eur(c.cost)} sans aucune conversion`,
        detail: `${c.clicks} clics sur 30 jours, 0 conversion, alors que le compte convertit ailleurs.`,
        campaign: c.name,
        amount: c.cost,
        action: "Vérifie la page de destination et le suivi, puis réduis le budget tant que rien ne convertit.",
      });
    }
    if ((c.lostRank ?? 0) >= 0.3 && c.conversions > 0) {
      out.push({
        id: `budget:rang:${c.id}`,
        category: "budgets",
        severity: "mineur",
        title: `« ${c.name} » perd ${pct(c.lostRank!)} des impressions au classement`,
        detail: "Enchère ou qualité trop faibles face aux concurrents sur une campagne qui convertit.",
        campaign: c.name,
        amount: null,
        action: "Améliore la qualité (annonces, page) avant de monter les enchères.",
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- Annonces et extensions
function policyRules(data: AuditData): Constat[] {
  return data.policy.map((p) => {
    const refused = p.status === "DISAPPROVED";
    return {
      id: `policy:${p.kind}:${p.campaign ?? "compte"}:${p.label}`,
      category: "annonces" as const,
      severity: (refused ? (p.kind === "annonce" ? "critique" : "important") : "mineur") as Severity,
      title: `${p.kind === "annonce" ? "L'annonce" : "L'extension"} « ${p.label} » est ${refused ? "refusée" : "limitée"} par Google`,
      detail: `${p.campaign ? `Campagne « ${p.campaign} ». ` : ""}${p.reasons.length ? `Motif : ${p.reasons.join(", ")}.` : ""}`,
      campaign: p.campaign,
      amount: null,
      action: refused
        ? "Corrige-la selon le motif indiqué dans Google Ads, puis demande un nouvel examen."
        : "Vérifie la restriction : elle limite la diffusion sans la bloquer.",
    };
  });
}

// ---------------------------------------------------------------- Réglages et suivi
function trackingRules(data: AuditData, acct: ReturnType<typeof accountStats>): Constat[] {
  const out: Constat[] = [];
  if (data.conversionActions === 0) {
    out.push({
      id: "suivi:aucune-action",
      category: "reglages",
      severity: "critique",
      title: "Aucune action de conversion active",
      detail: "Sans conversion mesurée, Google optimise à l'aveugle et aucun gaspillage ne peut être prouvé.",
      campaign: null,
      amount: null,
      action: "Crée ou réactive une conversion (formulaire, appel) et vérifie son déclenchement.",
    });
  }
  const days = [...data.daily].sort((a, b) => a.date.localeCompare(b.date));
  const last7 = days.slice(-7);
  const before = days.slice(0, -7);
  const sum = (arr: typeof days, k: "clicks" | "conversions") => arr.reduce((s, d) => s + d[k], 0);
  if (sum(last7, "clicks") >= 15 && sum(last7, "conversions") === 0 && sum(before, "conversions") >= 2) {
    out.push({
      id: "suivi:rupture-7j",
      category: "reglages",
      severity: "important",
      title: "Aucune conversion depuis 7 jours",
      detail: `${sum(last7, "clicks")} clics sur les 7 derniers jours sans conversion, alors que la période d'avant en comptait ${r0(sum(before, "conversions"))}.`,
      campaign: null,
      amount: null,
      action: "Fais un test de formulaire et d'appel, et vérifie la balise de conversion (GTM) avant de toucher aux campagnes.",
    });
  }
  if (acct.clicks >= 50 && acct.conv === 0 && data.conversionActions !== 0) {
    out.push({
      id: "suivi:zero-30j",
      category: "reglages",
      severity: "important",
      title: "Aucune conversion sur 30 jours",
      detail: `${acct.clicks} clics et ${eur(acct.cost)} dépensés sans une seule conversion mesurée.`,
      campaign: null,
      amount: null,
      action: "Vérifie d'abord le suivi : un compte qui reçoit des appels ou des devis sans conversion mesure mal.",
    });
  }
  return out;
}

// ---------------------------------------------------------------- Score et assemblage
const WEIGHT: Record<Severity, number> = { critique: 15, important: 5, mineur: 1 };
const CATEGORY_CAP = 20;
const SEV_ORDER: Record<Severity, number> = { critique: 0, important: 1, mineur: 2 };

export function healthScore(constats: Constat[]): number {
  const byCat = new Map<AuditCategory, number>();
  for (const c of constats) byCat.set(c.category, (byCat.get(c.category) ?? 0) + WEIGHT[c.severity]);
  let penalty = 0;
  byCat.forEach((v) => (penalty += Math.min(v, CATEGORY_CAP)));
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function runAudit(data: AuditData, opts: AuditOptions = {}): AuditResult {
  const alpha = opts.alpha ?? 0.05;
  const acct = accountStats(data);
  const cpaRef = opts.targetCpa ?? acct.cpa ?? 50;
  const skipped: AuditResult["skipped"] = [];

  const st = searchTermRules(data, cpaRef, alpha);
  const constats = [
    ...negativeConflicts(data),
    ...policyRules(data),
    ...trackingRules(data, acct),
    ...budgetRules(data, acct.cpa, acct.cvr, alpha),
    ...keywordRules(data, acct.cvr, cpaRef, alpha),
    ...st.constats,
  ].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || (b.amount ?? 0) - (a.amount ?? 0));

  return {
    healthScore: healthScore(constats),
    constats,
    wasteProven: st.proven,
    wasteWatch: st.watch,
    totalCost: Math.round(acct.cost * 100) / 100,
    conversions: acct.conv,
    skipped,
  };
}
