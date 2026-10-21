// Croise les termes de recherche payants (Google Ads) avec les requêtes naturelles
// (Search Console) : où tu paies un clic que tu aurais gratuitement, et où un
// contenu naturel manque alors que le payant convertit.
import type { TermRow } from "./data";
import type { ScRow } from "@/lib/search-console/client";

const STOP = new Set(["de", "la", "le", "les", "l", "d", "a", "au", "aux", "en", "et", "du", "des", "pour", "sur", "un", "une", "avec", "par", "sans", "dans", "pas", "ou"]);
const GENERIC = /^(renovation|services?|sarl|sas|eurl|menuiserie|menuiseries|france|group|groupe|entreprise|artisan|batiment|construction|habitat|maison|ads|google)$/;

export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Clé de rapprochement : sans accents ni mots vides, mots triés (« prix fenêtre pvc » = « fenetre pvc prix »). */
export function normKey(s: string): string {
  return [...new Set(fold(s).split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)))].sort().join(" ");
}

/** Mots de marque tirés du nom du compte (ex. « D2B Rénovation » → d2b). */
export function brandWordsOf(name: string): string[] {
  return [...new Set(fold(name).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !GENERIC.test(w)))];
}

export interface Organic { query: string; position: number; clicks: number; impressions: number }
export interface Joined {
  key: string;
  term: string;
  cost: number;
  clicks: number;
  conv: number;
  brand: boolean;
  org: Organic | null;
}

export function joinPaidOrganic(terms: TermRow[], organic: ScRow[], brand: string[]): Joined[] {
  const orgBy = new Map<string, { q: string; clicks: number; imp: number; posW: number; best: number }>();
  for (const r of organic) {
    const q = r.query ?? "";
    const k = normKey(q);
    if (!k) continue;
    const e = orgBy.get(k) ?? { q, clicks: 0, imp: 0, posW: 0, best: r.impressions };
    e.clicks += r.clicks; e.imp += r.impressions; e.posW += r.position * Math.max(1, r.impressions);
    if (r.impressions > e.best) { e.best = r.impressions; e.q = q; }
    orgBy.set(k, e);
  }
  const paid = new Map<string, Joined>();
  for (const t of terms) {
    const k = normKey(t.term);
    if (!k) continue;
    const e = paid.get(k) ?? { key: k, term: t.term, cost: 0, clicks: 0, conv: 0, brand: brand.some((w) => fold(t.term).includes(w)), org: null };
    e.cost += t.cur.cost; e.clicks += t.cur.clicks; e.conv += t.cur.conversions;
    if (t.cur.cost > 0 && t.cur.cost > (paid.get(k)?.cost ?? 0) - t.cur.cost) e.term = e.term || t.term;
    paid.set(k, e);
  }
  for (const [k, e] of paid) {
    const o = orgBy.get(k);
    if (o) e.org = { query: o.q, position: o.posW / Math.max(1, o.imp || 1), clicks: o.clicks, impressions: o.imp };
  }
  return [...paid.values()];
}

/** Requêtes naturelles de démonstration (mode mock), qui recoupent les termes payants de démonstration. */
export function demoOrganic(): ScRow[] {
  const r = (query: string, clicks: number, impressions: number, position: number): ScRow => ({ query, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position });
  return [
    r("menuisier toulon", 41, 620, 2.4), r("fenetre alu la farlede", 12, 140, 1.8), r("porte fenetre", 18, 2100, 9.6),
    r("prix porte fenetre pvc", 6, 480, 4.9), r("prime renov fenetre", 3, 900, 14.2), r("fenetre pvc renovation", 9, 530, 3.1),
    r("double vitrage renovation", 4, 760, 11.0),
  ];
}
