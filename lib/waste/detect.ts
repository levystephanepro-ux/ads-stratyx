// Waste Detector : calcul DÉTERMINISTE du budget gaspillé, sans IA (0 crédit).
//
// Principe : un terme (ou un groupe de termes) est "prouvé" quand, avec le taux
// de conversion moyen du compte, la probabilité d'obtenir 0 conversion sur ce
// nombre de clics est inférieure à ALPHA (5 % par défaut).
// Sur les petits comptes (artisans), le volume est souvent trop faible pour
// conclure : on ajoute un niveau "à surveiller", basé sur le coût rapporté au CPA.
//
// Les totaux sont calculés sur l'UNION des termes signalés (un terme couvert par
// une intention ET un n-gram n'est compté qu'une fois).

export interface WasteInputRow {
  campaignId: string;
  campaignName: string;
  term: string;
  clicks: number;
  /** Coût en unités de devise (pas en micros). */
  cost: number;
  conversions: number;
}

export type WasteLevel = "prouve" | "a_surveiller";
export type WasteCategory = "intention" | "ngram" | "terme";

export interface WasteFinding {
  category: WasteCategory;
  level: WasteLevel;
  /** Terme exact, n-gram, ou nom d'intention. */
  key: string;
  /** Négatifs proposés (exact pour un terme, expression pour un groupe). */
  negatives: { text: string; matchType: "EXACT" | "PHRASE" }[];
  campaigns: string[];
  terms: string[];
  clicks: number;
  cost: number;
  /** Probabilité d'avoir 0 conversion "par hasard" avec le taux du compte. */
  pZeroConv: number;
  reason: string;
}

export interface WasteReport {
  accountCvr: number;
  cpaRef: number;
  totalCost: number;
  wasteProven: number;
  wasteWatch: number;
  findings: WasteFinding[];
}

export interface WasteOptions {
  /** Seuil statistique (défaut 0,05). */
  alpha?: number;
  /** Plancher du taux de conversion du compte (défaut 1 %). */
  minCvr?: number;
  /** "À surveiller" si coût >= N × CPA de référence (défaut 1,5). */
  watchCpaMultiple?: number;
  /** CPA cible en devise ; sinon CPA moyen du compte (repli 50). */
  targetCpa?: number;
  /** Nombre max de constats renvoyés (défaut 40). */
  maxFindings?: number;
}

// Intentions sans valeur commerciale pour un artisan / une TPE locale.
// Motifs normalisés (minuscules, sans accents), mots entiers.
export const NEGATIVE_INTENTS: Record<string, string[]> = {
  emploi: ["emploi", "recrutement", "recrute", "salaire", "offre d emploi", "alternance", "stage", "interim", "cv"],
  formation: ["formation", "cap", "bp", "devenir", "ecole", "cours", "diplome", "cpf", "apprentissage"],
  bricolage: ["tuto", "tutoriel", "soi meme", "comment faire", "diy", "youtube", "pdf", "video"],
  gratuit: ["gratuit", "gratuite", "free"],
  "achat materiel": ["leroy merlin", "castorama", "brico depot", "bricomarche", "amazon", "manomano"],
};

const STOPWORDS = new Set([
  "les", "des", "une", "pour", "avec", "sur", "dans", "par", "pas", "est", "qui",
  "que", "aux", "mon", "ma", "mes", "son", "sa", "ses", "vos", "votre", "nos",
  "notre", "pres", "chez", "moi", "and", "the", "for",
]);

export function normalize(term: string): string {
  return term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function pZeroConversions(clicks: number, cvr: number): number {
  return Math.pow(1 - cvr, clicks);
}

function ngrams(words: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + n <= words.length; i++) out.push(words.slice(i, i + n).join(" "));
  return out;
}

function hasPhrase(norm: string, phrase: string): boolean {
  return ` ${norm} `.includes(` ${phrase} `);
}

interface TermAgg {
  norm: string;
  label: string; // terme tel que tapé (première occurrence)
  clicks: number;
  cost: number;
  conversions: number;
  campaigns: Set<string>;
}

interface Bucket {
  terms: Set<string>; // normalisés
  patterns?: Set<string>; // motifs d'intention réellement rencontrés
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function detectWaste(rows: WasteInputRow[], opts: WasteOptions = {}): WasteReport {
  const alpha = opts.alpha ?? 0.05;
  const minCvr = opts.minCvr ?? 0.01;
  const watchMultiple = opts.watchCpaMultiple ?? 1.5;
  const maxFindings = opts.maxFindings ?? 40;

  // 1) Agrégation par terme normalisé (un même terme peut venir de plusieurs campagnes)
  const terms = new Map<string, TermAgg>();
  for (const r of rows) {
    const norm = normalize(r.term);
    if (!norm) continue;
    const t =
      terms.get(norm) ??
      { norm, label: r.term, clicks: 0, cost: 0, conversions: 0, campaigns: new Set<string>() };
    t.clicks += r.clicks;
    t.cost += r.cost;
    t.conversions += r.conversions;
    t.campaigns.add(r.campaignName || r.campaignId);
    terms.set(norm, t);
  }

  const all = [...terms.values()];
  const totalClicks = all.reduce((s, t) => s + t.clicks, 0);
  const totalConv = all.reduce((s, t) => s + t.conversions, 0);
  const totalCost = all.reduce((s, t) => s + t.cost, 0);
  const accountCvr = Math.max(minCvr, totalClicks > 0 ? totalConv / totalClicks : 0);
  const cpaRef = opts.targetCpa ?? (totalConv > 0 ? totalCost / totalConv : 50);

  // 2) Groupes : intentions et n-grams (1 et 2 mots)
  const byIntent = new Map<string, Bucket>();
  const byNgram = new Map<string, Bucket>();
  for (const t of all) {
    for (const [intent, patterns] of Object.entries(NEGATIVE_INTENTS)) {
      const hit = patterns.filter((p) => hasPhrase(t.norm, p));
      if (hit.length) {
        const b = byIntent.get(intent) ?? { terms: new Set<string>(), patterns: new Set<string>() };
        b.terms.add(t.norm);
        hit.forEach((p) => b.patterns!.add(p));
        byIntent.set(intent, b);
      }
    }
    const words = t.norm.split(" ");
    const grams = new Set([...ngrams(words, 1), ...ngrams(words, 2)]);
    for (const g of grams) {
      if (g.length < 3 || STOPWORDS.has(g) || /^\d+$/.test(g)) continue;
      const b = byNgram.get(g) ?? { terms: new Set<string>() };
      b.terms.add(t.norm);
      byNgram.set(g, b);
    }
  }

  const sumOf = (set: Iterable<string>) => {
    let clicks = 0, cost = 0, conversions = 0;
    const campaigns = new Set<string>();
    const labels: string[] = [];
    for (const n of set) {
      const t = terms.get(n)!;
      clicks += t.clicks;
      cost += t.cost;
      conversions += t.conversions;
      t.campaigns.forEach((c) => campaigns.add(c));
      labels.push(t.label);
    }
    return { clicks, cost, conversions, campaigns: [...campaigns], labels };
  };

  const findings: WasteFinding[] = [];
  const proven = new Set<string>(); // termes couverts par un constat "prouvé"
  const watched = new Set<string>(); // termes couverts par un constat "à surveiller"

  const judge = (clicks: number, cost: number): { level: WasteLevel; p: number } | null => {
    const p = pZeroConversions(clicks, accountCvr);
    if (p < alpha) return { level: "prouve", p };
    if (cost >= cpaRef * watchMultiple) return { level: "a_surveiller", p };
    return null;
  };

  const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")} %`;
  const eur = (x: number) => `${Math.round(x)} €`;

  // 2a) Intentions : signalées dès qu'elles coûtent, même à faible volume
  for (const [intent, b] of byIntent) {
    const s = sumOf(b.terms);
    if (s.conversions > 0 || s.clicks === 0) continue;
    const j = judge(s.clicks, s.cost) ?? { level: "a_surveiller" as const, p: pZeroConversions(s.clicks, accountCvr) };
    const set = j.level === "prouve" ? proven : watched;
    b.terms.forEach((n) => set.add(n));
    findings.push({
      category: "intention",
      level: j.level,
      key: intent,
      negatives: [...(b.patterns ?? [])].map((text) => ({ text, matchType: "PHRASE" as const })),
      campaigns: s.campaigns,
      terms: s.labels,
      clicks: s.clicks,
      cost: round2(s.cost),
      pZeroConv: j.p,
      reason:
        j.level === "prouve"
          ? `Intention "${intent}" : ${s.clicks} clics, 0 conversion (${pct(j.p)} de chance que ce soit le hasard).`
          : `Intention "${intent}" sans valeur commerciale pour une entreprise locale : ${eur(s.cost)} dépensés, 0 conversion.`,
    });
  }

  // 2b) N-grams : seulement s'ils regroupent 2+ termes et sont PROUVÉS
  for (const [gram, b] of byNgram) {
    if (b.terms.size < 2) continue;
    const s = sumOf(b.terms);
    if (s.conversions > 0) continue;
    const j = judge(s.clicks, s.cost);
    if (!j || j.level !== "prouve") continue;
    // inutile si tous ses termes sont déjà couverts par une intention prouvée
    if ([...b.terms].every((n) => proven.has(n))) continue;
    b.terms.forEach((n) => proven.add(n));
    findings.push({
      category: "ngram",
      level: "prouve",
      key: gram,
      negatives: [{ text: gram, matchType: "PHRASE" }],
      campaigns: s.campaigns,
      terms: s.labels,
      clicks: s.clicks,
      cost: round2(s.cost),
      pZeroConv: j.p,
      reason: `"${gram}" et ${b.terms.size - 1} variante(s) : ${s.clicks} clics, 0 conversion (${pct(j.p)} de chance que ce soit le hasard).`,
    });
  }

  // 2c) Termes isolés non couverts par un groupe prouvé
  for (const t of all) {
    if (t.conversions > 0 || proven.has(t.norm)) continue;
    const j = judge(t.clicks, t.cost);
    if (!j) continue;
    // déjà couvert par une intention "à surveiller" : on ne le répète que s'il est prouvé seul
    if (watched.has(t.norm) && j.level !== "prouve") continue;
    (j.level === "prouve" ? proven : watched).add(t.norm);
    findings.push({
      category: "terme",
      level: j.level,
      key: t.label,
      negatives: [{ text: t.norm, matchType: "EXACT" }],
      campaigns: [...t.campaigns],
      terms: [t.label],
      clicks: t.clicks,
      cost: round2(t.cost),
      pZeroConv: j.p,
      reason:
        j.level === "prouve"
          ? `${t.clicks} clics sans conversion : ${pct(j.p)} de chance que ce soit le hasard (taux du compte ${pct(accountCvr)}).`
          : `${eur(t.cost)} dépensés sans conversion, soit ${(t.cost / cpaRef).toFixed(1).replace(".", ",")} × le CPA de référence. Volume encore trop faible pour conclure.`,
    });
  }

  // 3) Totaux sur l'union des termes (pas de double comptage)
  const costOf = (set: Set<string>) => [...set].reduce((s, n) => s + (terms.get(n)?.cost ?? 0), 0);
  const watchOnly = new Set([...watched].filter((n) => !proven.has(n)));

  findings.sort((a, b) =>
    a.level === b.level ? b.cost - a.cost : a.level === "prouve" ? -1 : 1,
  );

  return {
    accountCvr,
    cpaRef: round2(cpaRef),
    totalCost: round2(totalCost),
    wasteProven: round2(costOf(proven)),
    wasteWatch: round2(costOf(watchOnly)),
    findings: findings.slice(0, maxFindings),
  };
}

/** Résumé markdown (email du matin). */
export function wasteMarkdown(accountName: string, r: WasteReport): string {
  const eur = (x: number) => `${Math.round(x).toLocaleString("fr-FR")} €`;
  const lines = [
    `## ${accountName}`,
    `Gaspillage prouvé (30 j) : **${eur(r.wasteProven)}** · à surveiller : **${eur(r.wasteWatch)}** · dépense analysée : ${eur(r.totalCost)}`,
  ];
  const top = r.findings.slice(0, 8);
  if (top.length) {
    lines.push("", "| Fuite | Niveau | Clics | Coût | Négatif proposé |", "|---|---|---|---|---|");
    for (const f of top) {
      const lvl = f.level === "prouve" ? "Prouvé" : "À surveiller";
      const neg = formatNegatives(f.negatives);
      lines.push(`| ${f.key} | ${lvl} | ${f.clicks} | ${eur(f.cost)} | ${neg} |`);
    }
  } else {
    lines.push("", "Rien à signaler sur les termes de recherche.");
  }
  return lines.join("\n");
}

/** Négatifs au format Google Ads : [exact], "expression". */
export function formatNegatives(negs: WasteFinding["negatives"]): string {
  return negs.map((n) => (n.matchType === "EXACT" ? `[${n.text}]` : `"${n.text}"`)).join(", ");
}
