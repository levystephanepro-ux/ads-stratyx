// Proposition de devis par l'IA : choisit les prestations du catalogue d'après la découverte.
// L'IA ne fixe aucun prix : elle choisit des prestations et des quantités, tes tarifs restent ceux du catalogue.
import Anthropic from "@anthropic-ai/sdk";
import { calcCost, addMonthlyCost } from "@/lib/agent/cost";
import { ALL_QUESTIONS, INTERNAL_KEYS } from "./questions";
import type { Client } from "./store";
import type { StoredProposal } from "./proposal";
import { lineFromCatalog, varContext, type QuoteLine, type QuoteSettings } from "./quotes";

export interface QuoteSuggestion {
  offreNom: string; lignes: QuoteLine[]; engagementMois: number; budgetPub: number | null; notes: string;
  raisons: string[]; model: string;
}

const CHAIN = [process.env.BUILDER_MODEL ?? "claude-sonnet-5-5", "claude-sonnet-4-6"];

export async function suggestQuote(c: Client, s: QuoteSettings, prop: StoredProposal | null): Promise<QuoteSuggestion> {
  const answers = ALL_QUESTIONS.filter((q) => c.answers?.[q.key])
    .map((q) => `${INTERNAL_KEYS.has(q.key) ? "[note interne] " : ""}${q.label} ${c.answers[q.key]}`).join("\n");
  const p = prop?.proposal;
  const catalogue = s.catalogue.map((it) => `${it.id} | ${it.cat} | ${it.titre} | ${it.type === "mensuel" ? "mensuel" : "une fois"} | quand : ${it.quand}`).join("\n");
  const packs = s.offres.map((o) => `${o.nom} : ${(o.items ?? []).join(", ")}`).join("\n");

  const prompt = [
    `Tu es un consultant senior en paid media multi-canal (Google Ads, Meta Ads, LinkedIn, TikTok), créatives et landing pages, en France. Tu prépares le devis de STRATYXMEDIA pour « ${c.name} ».`,
    `Choisis les prestations du catalogue adaptées à ce client, avec leurs quantités. Tu ne fixes jamais de prix.`,
    ``, `Découverte du client :`, answers || "(questionnaire vide)",
    c.website ? `Site : ${c.website}` : "",
    p ? `Proposition déjà rédigée : ${p.campagnes.length} campagne(s) (${p.campagnes.map((x) => x.nom).join(", ")}), budget conseillé ${p.budget_mensuel} € par mois. Prérequis : ${p.prerequis.join(" ; ") || "aucun"}.` : "",
    prop?.site && !prop.site.error ? `Audit de la page : score ${prop.site.score}/100, problèmes : ${prop.site.fails.join(" ; ") || "aucun"}.` : "",
    ``, `Catalogue (id | catégorie | titre | fréquence | quand la proposer) :`, catalogue,
    ``, `Packs existants :`, packs,
    ``, `Règles :`,
    `1. Uniquement des id du catalogue. Ne propose pas deux fois la même prestation.`,
    `2. Ce qui manque (suivi des conversions, landing page, traitement des demandes) passe avant le reste.`,
    `3. Choisis les canaux selon la découverte : Google quand le besoin est déjà recherché, Meta ou TikTok pour susciter le besoin avec du visuel, LinkedIn pour une cible B2B. Pas de canal sans raison.`,
    `4. Chaque canal retenu a sa création, ses créatives (visuels, vidéos, rédaction) et son pilotage mensuel. Un tracking adapté à chaque canal (pixel Meta pour Meta).`,
    `5. Quantité de « search » = nombre de campagnes Search (1 à 4). Quantités de visuels et vidéos réalistes. Garde le devis cohérent avec le budget publicitaire du client.`,
    `6. Ce qui est utile mais pas indispensable va dans "options" (affiché sans être compté).`,
    `7. Chaque raison tient en une phrase courte, factuelle, tirée de la découverte. Pas de tirets longs.`,
    ``, `Réponds UNIQUEMENT avec ce JSON :`,
    `{"titre":"titre court du devis","engagementMois":3,"budgetPub":900,"items":[{"id":"tracking","qte":1,"raison":"..."}],"options":[{"id":"landing_variante","qte":1,"raison":"..."}],"note":"1 à 2 phrases pour le bas du devis, ou vide"}`,
  ].filter((l) => l !== "").join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let res: Awaited<ReturnType<typeof client.messages.create>> | null = null, model = "", last: unknown = null;
  for (const m of [...new Set(CHAIN)]) {
    try { model = m; res = await client.messages.create({ model: m, max_tokens: 2000, messages: [{ role: "user", content: prompt }] }); break; }
    catch (err) { last = err; if (!/model|not_found|404/i.test(String(err))) throw err; }
  }
  if (!res || !("content" in res)) throw new Error(`Aucun modèle disponible : ${String(last).slice(0, 160)}`);
  const usage = calcCost(model, res.usage.input_tokens, res.usage.output_tokens);
  await addMonthlyCost(usage.costUsd, "copilote", null).catch(() => undefined);

  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  type Pick = { id?: string; qte?: number; raison?: string };
  let j: { titre?: string; engagementMois?: number; budgetPub?: number; items?: Pick[]; options?: Pick[]; note?: string };
  try { j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { throw new Error("Réponse de l'IA illisible, relance."); }

  const budget = Number(j.budgetPub) > 0 ? Number(j.budgetPub) : p?.budget_mensuel || null;
  const nbSearch = (j.items ?? []).find((x) => x.id === "search")?.qte ?? p?.campagnes.length ?? null;
  const ctx = varContext(c, { budget, nbCampagnes: nbSearch ? Number(nbSearch) : null });
  const byId = new Map(s.catalogue.map((it) => [it.id, it]));
  const seen = new Set<string>();
  const lignes: QuoteLine[] = [], raisons: string[] = [];
  const take = (arr: Pick[] | undefined, option: boolean) => {
    for (const x of arr ?? []) {
      const it = x.id ? byId.get(x.id) : undefined;
      if (!it || seen.has(it.id)) continue;
      seen.add(it.id);
      lignes.push(lineFromCatalog(it, ctx, { qte: Number(x.qte) || undefined, option }));
      if (x.raison) raisons.push(`${option ? "Option, " : ""}${it.titre} : ${String(x.raison).replace(/\s*—\s*/g, ", ")}`);
    }
  };
  take(j.items, false);
  take(j.options, true);
  if (!lignes.length) throw new Error("L'IA n'a retenu aucune prestation : complète le questionnaire puis relance.");
  // Ordre du catalogue (les sections se suivent), options à la fin.
  const order = new Map(s.catalogue.map((it, i) => [it.cat, i]));
  lignes.sort((a, b) => Number(!!a.option) - Number(!!b.option) || (order.get(a.section ?? "") ?? 99) - (order.get(b.section ?? "") ?? 99));

  return {
    offreNom: String(j.titre ?? "").trim() || "Accompagnement en acquisition payante",
    lignes, engagementMois: Number.isFinite(Number(j.engagementMois)) ? Math.max(0, Math.round(Number(j.engagementMois))) : 3,
    budgetPub: budget, notes: String(j.note ?? "").replace(/\s*—\s*/g, ", "), raisons, model,
  };
}
