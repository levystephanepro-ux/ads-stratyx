// Classement des recherches par intention (règles, sans IA) et n-grammes.
import { normKw } from "@/lib/audit/negatives";

export type Intent = "achat" | "aides" | "concurrent" | "emploi" | "gratuit" | "info" | "autre";

export const INTENTS: Record<Intent, { label: string; verdict: "garder" | "surveiller" | "exclure"; hint: string }> = {
  achat: { label: "Achat", verdict: "garder", hint: "prix, devis, pose, sur mesure, produit + ville" },
  aides: { label: "Aides et financement", verdict: "surveiller", hint: "prime, MaPrimeRénov, subvention, crédit d'impôt" },
  concurrent: { label: "Concurrent", verdict: "exclure", hint: "marques et enseignes concurrentes" },
  emploi: { label: "Emploi et formation", verdict: "exclure", hint: "emploi, recrutement, salaire, formation" },
  gratuit: { label: "Gratuit et bricolage", verdict: "exclure", hint: "gratuit, occasion, tuto, soi-même" },
  info: { label: "Information", verdict: "surveiller", hint: "définition, norme, comment, différence" },
  autre: { label: "Autres recherches", verdict: "surveiller", hint: "à relire" },
};

/** Minuscules, sans accents ni ponctuation. */
export const fold = (s: string) => normKw(s).normalize("NFD").replace(/\p{M}/gu, "");

const has = (t: string, words: string[]) => words.some((w) => ` ${t} `.includes(` ${w} `) || (w.length > 6 && t.includes(w)));

const BRANDS = [
  "technal", "pierret", "internorm", "schuco", "kline", "k line", "garofoli", "bertolotto", "atulam", "tryba", "lapeyre",
  "leroy merlin", "leroy", "castorama", "brico depot", "bricodepot", "bricomarche", "point p", "art et fenetres", "franciaflex", "bubendorff", "somfy", "velux", "monsieur store", "kparK", "kpark",
  "france fermetures", "grosfillex", "millet", "zilten", "reynaers", "wicona", "veka", "rehau", "profils systemes",
  "ikea", "amazon", "manomano", "cedeo",
].map((b) => fold(b));
const AIDES = ["prime", "primes", "maprimerenov", "ma prime renov", "aide", "aides", "subvention", "credit d impot", "cee", "anah", "eco ptz", "financement", "tva 5 5", "renov"];
const EMPLOI = ["emploi", "emplois", "recrutement", "recrute", "job", "jobs", "salaire", "formation", "stage", "alternance", "apprenti", "offre d emploi", "interim", "indeed"];
const GRATUIT = ["gratuit", "gratuite", "gratuits", "occasion", "occas", "tuto", "tutoriel", "soi meme", "diy", "le bon coin", "leboncoin", "pdf", "youtube", "fabriquer soi meme"];
const INFO = ["definition", "c est quoi", "qu est ce", "norme", "normes", "difference", "comment", "pourquoi", "dimension", "dimensions", "taille", "wikipedia", "avis"];

export function classify(term: string): Intent {
  const t = fold(term);
  if (BRANDS.some((b) => ` ${t} `.includes(` ${b} `))) return "concurrent";
  if (has(t, EMPLOI)) return "emploi";
  if (has(t, GRATUIT)) return "gratuit";
  if (has(t, AIDES)) return "aides";
  if (has(t, INFO)) return "info";
  return "achat";
}

const STOP = new Set(["de", "la", "le", "les", "l", "d", "a", "à", "au", "aux", "en", "et", "du", "des", "pour", "sur", "un", "une", "avec", "par", "pas", "sans", "dans"]);

/** N-grammes (n mots consécutifs) d'une recherche, sans mots vides en bord. */
export function ngrams(term: string, n: number): string[] {
  const words = fold(term).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) {
    const g = words.slice(i, i + n);
    if (STOP.has(g[0]) || STOP.has(g[g.length - 1])) continue;
    out.add(g.join(" "));
  }
  return [...out];
}
