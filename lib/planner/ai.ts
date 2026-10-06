// Structure de campagne proposée par l'IA (comme le Forecast d'Ades) : groupes
// d'annonces par intention, annonces responsives, négatifs de départ.
// Payant (API Anthropic), soumis au plafond IA de l'owner.
import Anthropic from "@anthropic-ai/sdk";
import { calcCost, addMonthlyCost } from "@/lib/agent/cost";
import { negativeBlocks } from "@/lib/audit/negatives";
import type { AdGroupSpec } from "./create";

export interface StructureInput {
  url: string;
  objectif: "leads" | "ventes";
  country: string;
  language: string;
  places: string[];
  monthlyBudget: number;
  panier: number | null;
  marge: number | null;
  closing: number | null;
  accountContext: string;
  ideas: { text: string; searches: number; cpcLow: number | null; cpcHigh: number | null; selected: boolean }[];
}

export interface Structure {
  campaignName: string;
  groups: AdGroupSpec[];
  negatives: string[];
  notes: string;
}

const MODEL = process.env.BUILDER_MODEL ?? "claude-sonnet-4-6";
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";

function prompt(i: StructureInput): string {
  const kw = i.ideas.map((x) => `${x.selected ? "*" : " "} ${x.text} | ${x.searches} rech./mois | CPC ${x.cpcLow ?? "?"}-${x.cpcHigh ?? "?"} €`).join("\n");
  return [
    `Tu es un media buyer Google Ads senior en France. Propose la structure d'une campagne Search (réseau de recherche seul) prête à créer.`,
    ``,
    `Contexte :`,
    `- Page d'atterrissage : ${i.url || "non fournie"}`,
    `- Objectif : ${i.objectif === "ventes" ? "ventes en ligne" : "leads (formulaires, appels, rendez-vous)"}`,
    `- Zone : ${i.places.length ? i.places.join(", ") : i.country} · langue : ${i.language}`,
    `- Budget mensuel : ${Math.round(i.monthlyBudget)} €`,
    i.panier ? `- Panier moyen : ${i.panier} €, marge ${i.marge ?? "?"} %, ${i.closing ?? "?"} % des leads deviennent clients` : "",
    i.accountContext ? `- Ce que le client a dit de son activité :\n${i.accountContext.slice(0, 1500)}` : "",
    ``,
    `Mots-clés du planificateur Google (* = retenus par l'utilisateur) :`,
    kw,
    ``,
    `Règles :`,
    `1. 2 à 6 groupes d'annonces, un par intention distincte (produit, service, urgence, zone…). Pas de groupe fourre-tout.`,
    `2. Chaque groupe : 3 à 20 mots-clés, en minuscules, tirés en priorité des mots-clés retenus (*), tu peux en ajouter de la liste s'ils sont pertinents. Aucun mot-clé dans deux groupes. Écarte le hors cible (emploi, formation, gratuit, bricolage, occasion, marques concurrentes).`,
    `3. Chaque groupe : 12 à 15 titres de 30 caractères MAXIMUM (espaces compris, compte bien), variés : mot-clé principal, zone, bénéfice, preuve, appel à l'action. Pas de point d'exclamation dans les titres, pas de MAJUSCULES abusives, pas de « n°1 » ni « meilleur » sans preuve.`,
    `4. Chaque groupe : 4 descriptions de 90 caractères MAXIMUM, complètes, avec un appel à l'action.`,
    `5. path1 et path2 : 15 caractères maximum, sans espace (ex. "fenetres", "toulon").`,
    `6. 10 à 30 négatifs de campagne (expressions courtes) qui ne bloquent aucun des mots-clés retenus.`,
    `7. N'invente aucun fait (prix, années d'expérience, certifications) absent du contexte ; reste générique sinon.`,
    ``,
    `Réponds UNIQUEMENT avec un JSON valide, sans texte autour :`,
    `{"campaignName": "...", "notes": "2 phrases : logique de la structure et ce qu'il faut vérifier", "negatives": ["..."], "groups": [{"name": "...", "keywords": ["..."], "headlines": ["..."], "descriptions": ["..."], "path1": "...", "path2": "..."}]}`,
  ].filter((l) => l !== "").join("\n");
}

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Nettoie la réponse : longueurs Google, doublons, négatifs qui bloqueraient un mot-clé. */
export function sanitize(raw: unknown): Structure {
  const r = (raw ?? {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const groups: AdGroupSpec[] = (Array.isArray(r.groups) ? r.groups : []).slice(0, 8).map((g: Record<string, unknown>, i: number) => {
    const keywords = (Array.isArray(g.keywords) ? g.keywords : []).map((k) => clean(k).toLowerCase().replace(/^[\["+]+|[\]"]+$/g, ""))
      .filter((k) => k && k.length <= 80 && !seen.has(k) && (seen.add(k), true)).slice(0, 30);
    const headlines = [...new Set((Array.isArray(g.headlines) ? g.headlines : []).map(clean).filter((h) => h && h.length <= 30))].slice(0, 15);
    const descriptions = [...new Set((Array.isArray(g.descriptions) ? g.descriptions : []).map(clean).filter((d) => d && d.length <= 90))].slice(0, 4);
    const path = (v: unknown) => clean(v).replace(/\s+/g, "-").slice(0, 15) || undefined;
    return { name: clean(g.name) || `Groupe ${i + 1}`, keywords, headlines, descriptions, path1: path(g.path1), path2: path(g.path2) };
  }).filter((g) => g.keywords.length);
  const allKw = groups.flatMap((g) => g.keywords);
  const negatives = [...new Set((Array.isArray(r.negatives) ? r.negatives : []).map((n) => clean(n).toLowerCase()))]
    .filter((n) => n && n.length <= 80 && !allKw.some((k) => negativeBlocks(n, "PHRASE", k))).slice(0, 40);
  return { campaignName: clean(r.campaignName).slice(0, 120), groups, negatives, notes: clean(r.notes).slice(0, 600) };
}

export async function proposeStructure(input: StructureInput): Promise<{ structure: Structure; costUsd: number; model: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const call = (model: string) => client.messages.create({ model, max_tokens: 6000, messages: [{ role: "user", content: prompt(input) }] });
  let model = MODEL;
  let res;
  try { res = await call(model); }
  catch (e) {
    // modèle indisponible sur la clé : repli sur Haiku
    if (/model|not_found|404/i.test(String(e))) { model = FALLBACK_MODEL; res = await call(model); } else throw e;
  }
  const usage = calcCost(model, res.usage.input_tokens, res.usage.output_tokens);
  await addMonthlyCost(usage.costUsd, "copilote", null).catch(() => undefined);
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error("Réponse de l'IA illisible, relance la proposition."); }
  const structure = sanitize(parsed);
  if (!structure.groups.length) throw new Error("L'IA n'a proposé aucun groupe exploitable, relance.");
  return { structure, costUsd: usage.costUsd, model };
}
