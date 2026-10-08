// Structure de campagne proposée par l'IA (comme le Forecast d'Ades) : groupes
// d'annonces par intention, annonces responsives, négatifs de départ.
// Payant (API Anthropic), soumis au plafond IA de l'owner.
import Anthropic from "@anthropic-ai/sdk";
import { calcCost, addMonthlyCost } from "@/lib/agent/cost";
import { negativeBlocks } from "@/lib/audit/negatives";
import type { AdGroupSpec } from "./create";
import { parseAiJson } from "@/lib/ai/json";

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

// Toujours Sonnet ou Opus (jamais Haiku) : la rédaction des annonces compte.
// Chaque niveau a une liste de repli si la clé n'a pas accès au modèle le plus récent.
export type BuilderTier = "sonnet" | "opus";
const CHAINS: Record<BuilderTier, string[]> = {
  sonnet: [process.env.BUILDER_MODEL ?? "claude-sonnet-5-5", "claude-sonnet-4-6"],
  opus: [process.env.BUILDER_MODEL_OPUS ?? "claude-opus-5-5", "claude-opus-4-6", "claude-sonnet-5-5"],
};

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
    i.accountContext ? `- Ce que le client a dit de son activité :\n${i.accountContext.slice(0, 4000)}` : "",
    ``,
    `Mots-clés du planificateur Google (* = retenus par l'utilisateur) :`,
    kw,
    ``,
    `Règles :`,
    `1. 2 à 6 groupes d'annonces, un par intention distincte (produit, service, urgence, zone…). Pas de groupe fourre-tout.`,
    `2. Chaque groupe : 3 à 20 mots-clés, en minuscules, tirés en priorité des mots-clés retenus (*), tu peux en ajouter de la liste s'ils sont pertinents. Aucun mot-clé dans deux groupes. Écarte le hors cible (emploi, formation, gratuit, bricolage, occasion, marques concurrentes).`,
    `3. Chaque groupe : 12 à 15 titres de 30 caractères MAXIMUM (espaces et accents compris, compte chaque caractère ; vise 20 à 30), variés : mot-clé principal, zone, bénéfice, preuve, appel à l'action. Pas de point d'exclamation dans les titres, pas de MAJUSCULES abusives, pas de « n°1 » ni « meilleur » sans preuve.`,
    `4. Chaque groupe : 4 descriptions de 90 caractères MAXIMUM (vise 70 à 90), complètes, avec un appel à l'action.`,
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

// Format de réponse imposé (outil) : l'API garantit un JSON valide et complet.
const STRUCTURE_TOOL = {
  name: "structure_campagne",
  description: "Structure de campagne Search prête à créer.",
  input_schema: {
    type: "object" as const,
    properties: {
      campaignName: { type: "string" },
      notes: { type: "string" },
      negatives: { type: "array", items: { type: "string" } },
      groups: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            keywords: { type: "array", items: { type: "string" } },
            headlines: { type: "array", items: { type: "string" } },
            descriptions: { type: "array", items: { type: "string" } },
            path1: { type: "string" },
            path2: { type: "string" },
          },
          required: ["name", "keywords", "headlines", "descriptions"],
        },
      },
    },
    required: ["campaignName", "groups", "negatives", "notes"],
  },
};

// ---------------------------------------------------------------------------
// Limites Google Ads : une passe de réécriture pour les textes trop longs
// (au lieu de les supprimer, ce qui pouvait laisser moins de 3 titres ou 2 descriptions).
// ---------------------------------------------------------------------------
export const LIMITS = { headline: 30, description: 90, path: 15 } as const;

const FIX_TOOL = {
  name: "textes_corriges",
  description: "Textes réécrits dans la limite de caractères.",
  input_schema: {
    type: "object" as const,
    properties: { items: { type: "array", items: { type: "object", properties: { id: { type: "string" }, texte: { type: "string" } }, required: ["id", "texte"] } } },
    required: ["items"],
  },
};

type RawGroup = { headlines?: unknown[]; descriptions?: unknown[] };

async function fixLengths(client: Anthropic, model: string, raw: unknown): Promise<number> {
  const groups = ((raw as { groups?: RawGroup[] })?.groups ?? []);
  const todo: { id: string; kind: "titre" | "description"; max: number; text: string; set: (v: string) => void }[] = [];
  groups.forEach((g, gi) => {
    (["headlines", "descriptions"] as const).forEach((field) => {
      const arr = Array.isArray(g[field]) ? g[field]! : [];
      const max = field === "headlines" ? LIMITS.headline : LIMITS.description;
      arr.forEach((v, k) => {
        const t = clean(v);
        if (t.length > max) todo.push({ id: `${gi}-${field[0]}-${k}`, kind: field === "headlines" ? "titre" : "description", max, text: t, set: (nv) => { arr[k] = nv; } });
      });
    });
  });
  if (!todo.length) return 0;
  const list = todo.map((x) => `${x.id} | ${x.kind} | ${x.max} caractères max | actuellement ${x.text.length} | ${x.text}`).join("\n");
  const res = await client.messages.create({
    model, max_tokens: 4000, tools: [FIX_TOOL], tool_choice: { type: "tool", name: FIX_TOOL.name },
    messages: [{ role: "user", content: [
      "Ces textes d'annonces Google Ads dépassent la limite de caractères (espaces compris).",
      "Réécris chacun pour tenir dans sa limite, en gardant le sens, le mot-clé principal et le ton. Abrège intelligemment, ne coupe pas un mot.",
      "Compte précisément les caractères. Pas de point d'exclamation dans les titres.",
      "", "id | type | limite | longueur actuelle | texte", list,
    ].join("\n") }],
  });
  const usage = calcCost(model, res.usage.input_tokens, res.usage.output_tokens);
  await addMonthlyCost(usage.costUsd, "copilote", null).catch(() => undefined);
  const block = res.content.find((b) => b.type === "tool_use");
  const items = ((block && block.type === "tool_use" ? block.input : null) as { items?: { id?: string; texte?: string }[] } | null)?.items ?? [];
  const byId = new Map(items.map((x) => [String(x.id), clean(x.texte)]));
  let fixed = 0;
  for (const x of todo) {
    const nv = byId.get(x.id);
    if (nv && nv.length <= x.max) { x.set(nv); fixed++; }
  }
  return fixed;
}

export async function proposeStructure(input: StructureInput, tier: BuilderTier = "sonnet"): Promise<{ structure: Structure; costUsd: number; model: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const call = (model: string) => client.messages.create({
    model, max_tokens: 16000,
    tools: [STRUCTURE_TOOL], tool_choice: { type: "tool", name: STRUCTURE_TOOL.name },
    messages: [{ role: "user", content: prompt(input) + "\n\nRéponds en appelant l'outil structure_campagne." }],
  });
  let model = "";
  let res: Awaited<ReturnType<typeof call>> | null = null;
  let lastErr: unknown = null;
  for (const m of [...new Set(CHAINS[tier])]) {
    try { model = m; res = await call(m); break; }
    catch (e) {
      lastErr = e;
      if (!/model|not_found|404/i.test(String(e))) throw e; // autre erreur : on ne change pas de modèle
    }
  }
  if (!res) throw new Error(`Aucun modèle ${tier} disponible sur la clé API : ${String(lastErr).slice(0, 200)}`);
  const usage = calcCost(model, res.usage.input_tokens, res.usage.output_tokens);
  await addMonthlyCost(usage.costUsd, "copilote", null).catch(() => undefined);

  // 1. Réponse structurée (outil). 2. Repli : texte lu de façon tolérante.
  const toolBlock = res.content.find((b) => b.type === "tool_use");
  let parsed: unknown = toolBlock && toolBlock.type === "tool_use" ? toolBlock.input : null;
  if (!parsed) {
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    try { parsed = parseAiJson(text); }
    catch {
      console.error("[planner] réponse IA illisible", { model, stop: res.stop_reason, len: text.length, head: text.slice(0, 300) });
      throw new Error(res.stop_reason === "max_tokens"
        ? "La réponse de l'IA était trop longue et a été coupée. Retire quelques mots-clés retenus ou relance."
        : "Réponse de l'IA illisible, relance la proposition.");
    }
  }
  // Textes trop longs : réécriture ciblée (les textes encore trop longs seront écartés par sanitize).
  await fixLengths(client, model, parsed).catch((e) => console.error("[planner] réécriture des longueurs", String(e).slice(0, 200)));
  const structure = sanitize(parsed);
  if (!structure.groups.length) {
    console.error("[planner] aucun groupe exploitable", { model, stop: res.stop_reason });
    throw new Error(res.stop_reason === "max_tokens"
      ? "La réponse de l'IA a été coupée avant la fin. Retire quelques mots-clés retenus ou relance."
      : "L'IA n'a proposé aucun groupe exploitable, relance.");
  }
  return { structure, costUsd: usage.costUsd, model };
}
