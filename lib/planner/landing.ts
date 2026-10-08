// Contenu de landing page cohérent avec la structure d'annonces (message match) :
// chaque groupe d'annonces retrouve sa promesse, ses mots-clés et son appel à l'action sur la page.
// Payant (API Anthropic), soumis au plafond IA de l'owner.
import Anthropic from "@anthropic-ai/sdk";
import { calcCost, addMonthlyCost } from "@/lib/agent/cost";
import type { AdGroupSpec } from "./create";

export interface LandingInput {
  campaignName: string; url: string; objectif: "leads" | "ventes"; places: string[];
  groups: AdGroupSpec[]; callouts: string[]; phone?: string; accountContext: string;
}

export interface LandingBrief {
  titrePage: string; metaTitle: string; metaDescription: string;
  hero: { titre: string; sousTitre: string; cta: string; preuvesRapides: string[] };
  sections: { groupe: string; ancre: string; titre: string; texte: string; points: string[]; titresAnnonceRepris: string[] }[];
  benefices: string[]; etapes: string[]; preuves: string[];
  faq: { q: string; r: string }[];
  formulaire: { champs: string[]; bouton: string; reassurance: string };
  ctaFinal: string; aFournir: string[]; notes: string;
}

const TOOL = {
  name: "contenu_landing",
  description: "Contenu complet de la landing page, aligné sur les annonces.",
  input_schema: {
    type: "object" as const,
    properties: {
      titrePage: { type: "string" }, metaTitle: { type: "string" }, metaDescription: { type: "string" },
      hero: { type: "object", properties: { titre: { type: "string" }, sousTitre: { type: "string" }, cta: { type: "string" }, preuvesRapides: { type: "array", items: { type: "string" } } }, required: ["titre", "sousTitre", "cta", "preuvesRapides"] },
      sections: { type: "array", items: { type: "object", properties: {
        groupe: { type: "string" }, ancre: { type: "string" }, titre: { type: "string" }, texte: { type: "string" },
        points: { type: "array", items: { type: "string" } }, titresAnnonceRepris: { type: "array", items: { type: "string" } },
      }, required: ["groupe", "ancre", "titre", "texte", "points", "titresAnnonceRepris"] } },
      benefices: { type: "array", items: { type: "string" } }, etapes: { type: "array", items: { type: "string" } },
      preuves: { type: "array", items: { type: "string" } },
      faq: { type: "array", items: { type: "object", properties: { q: { type: "string" }, r: { type: "string" } }, required: ["q", "r"] } },
      formulaire: { type: "object", properties: { champs: { type: "array", items: { type: "string" } }, bouton: { type: "string" }, reassurance: { type: "string" } }, required: ["champs", "bouton", "reassurance"] },
      ctaFinal: { type: "string" }, aFournir: { type: "array", items: { type: "string" } }, notes: { type: "string" },
    },
    required: ["titrePage", "metaTitle", "metaDescription", "hero", "sections", "benefices", "etapes", "preuves", "faq", "formulaire", "ctaFinal", "aFournir", "notes"],
  },
};

const CHAIN = [process.env.BUILDER_MODEL ?? "claude-sonnet-5-5", "claude-sonnet-4-6"];
const s = (v: unknown) => String(v ?? "").replace(/\s*—\s*/g, ", ").trim();
const arr = (v: unknown) => (Array.isArray(v) ? v.map(s).filter(Boolean) : []);

function prompt(i: LandingInput): string {
  const groups = i.groups.map((g, k) => [
    `Groupe ${k + 1} « ${g.name} »`,
    `  mots-clés : ${g.keywords.slice(0, 15).join(", ")}`,
    `  titres d'annonce : ${g.headlines.join(" | ")}`,
    `  descriptions : ${g.descriptions.join(" | ")}`,
  ].join("\n")).join("\n");
  return [
    `Tu es un expert en landing pages pour la publicité Google Ads (conversion, message match), en France. Rédige le contenu d'une landing page dédiée à la campagne « ${i.campaignName} ».`,
    ``, `Contexte :`,
    `- Objectif : ${i.objectif === "ventes" ? "ventes en ligne" : "demandes (formulaire, appel, rendez-vous)"}`,
    `- Zone : ${i.places.join(", ") || "non précisée"}`,
    i.url ? `- Site ou page actuelle : ${i.url}` : "",
    i.phone ? `- Téléphone : ${i.phone}` : "",
    i.callouts.length ? `- Accroches de la campagne : ${i.callouts.join(" | ")}` : "",
    i.accountContext ? `- Ce que le client a dit de son activité :\n${i.accountContext.slice(0, 4000)}` : "",
    ``, `Structure des annonces (la page doit tenir exactement ces promesses) :`, groups,
    ``, `Règles :`,
    `1. Message match : le titre principal (H1) reprend l'intention du groupe principal et son mot-clé ; chaque groupe d'annonces a SA section avec une ancre courte en minuscules sans accent (ex. "pergola-bioclimatique"), qui reprend ses titres d'annonce et ses promesses mot pour mot quand c'est possible. Liste dans titresAnnonceRepris les titres d'annonce effectivement repris.`,
    `2. Tout ce que promettent les annonces et accroches (devis gratuit, délai, garantie, zone) apparaît sur la page, au-dessus de la ligne de flottaison si possible.`,
    `3. N'invente aucun fait (prix, années d'expérience, certifications, chiffres, avis) absent du contexte ou des annonces. Quand une preuve manque, mets-la dans aFournir (ex. "3 photos de chantiers récents", "note et nombre d'avis Google").`,
    `4. Formulaire court : 3 à 5 champs, adaptés au métier. Un seul appel à l'action principal, répété.`,
    `5. metaTitle 60 caractères max, metaDescription 155 max. Français clair, vouvoiement, pas de tirets longs, pas d'emoji.`,
    `6. notes : 2 phrases sur la logique de la page et l'URL finale à mettre dans chaque groupe (page#ancre).`,
    ``, `Réponds en appelant l'outil contenu_landing.`,
  ].filter((l) => l !== "").join("\n");
}

export async function proposeLanding(input: LandingInput): Promise<{ brief: LandingBrief; costUsd: number; model: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let res: Awaited<ReturnType<typeof client.messages.create>> | null = null, model = "", last: unknown = null;
  for (const m of [...new Set(CHAIN)]) {
    try {
      model = m;
      res = await client.messages.create({ model: m, max_tokens: 8000, tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name }, messages: [{ role: "user", content: prompt(input) }] });
      break;
    } catch (e) { last = e; if (!/model|not_found|404/i.test(String(e))) throw e; }
  }
  if (!res || !("content" in res)) throw new Error(`Aucun modèle disponible : ${String(last).slice(0, 160)}`);
  const usage = calcCost(model, res.usage.input_tokens, res.usage.output_tokens);
  await addMonthlyCost(usage.costUsd, "copilote", null).catch(() => undefined);
  const block = res.content.find((b) => b.type === "tool_use");
  const r = (block && block.type === "tool_use" ? block.input : null) as Record<string, unknown> | null;
  if (!r) throw new Error(res.stop_reason === "max_tokens" ? "Réponse de l'IA coupée, relance." : "Réponse de l'IA illisible, relance.");
  const h = (r.hero ?? {}) as Record<string, unknown>, f = (r.formulaire ?? {}) as Record<string, unknown>;
  const brief: LandingBrief = {
    titrePage: s(r.titrePage), metaTitle: s(r.metaTitle).slice(0, 70), metaDescription: s(r.metaDescription).slice(0, 170),
    hero: { titre: s(h.titre), sousTitre: s(h.sousTitre), cta: s(h.cta), preuvesRapides: arr(h.preuvesRapides) },
    sections: (Array.isArray(r.sections) ? r.sections : []).map((x: Record<string, unknown>) => ({
      groupe: s(x.groupe), ancre: s(x.ancre).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
      titre: s(x.titre), texte: s(x.texte), points: arr(x.points), titresAnnonceRepris: arr(x.titresAnnonceRepris),
    })),
    benefices: arr(r.benefices), etapes: arr(r.etapes), preuves: arr(r.preuves),
    faq: (Array.isArray(r.faq) ? r.faq : []).map((x: Record<string, unknown>) => ({ q: s(x.q), r: s(x.r) })).filter((x) => x.q),
    formulaire: { champs: arr(f.champs), bouton: s(f.bouton), reassurance: s(f.reassurance) },
    ctaFinal: s(r.ctaFinal), aFournir: arr(r.aFournir), notes: s(r.notes),
  };
  if (!brief.hero.titre || !brief.sections.length) throw new Error("L'IA n'a pas produit de contenu exploitable, relance.");
  return { brief, costUsd: usage.costUsd, model };
}

export { messageMatchGaps, landingToMarkdown } from "./landing-text";
