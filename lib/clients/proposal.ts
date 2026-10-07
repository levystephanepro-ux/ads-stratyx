// Synthèse de découverte + proposition commerciale, à partir du questionnaire.
// Les calculs de rentabilité sont faits ici (sans IA) ; l'IA rédige à partir de ces chiffres.
import Anthropic from "@anthropic-ai/sdk";
import { calcCost, addMonthlyCost } from "@/lib/agent/cost";
import { getSetting, setSetting } from "@/lib/agent/store";
import { analyzeSite, type SiteAudit } from "@/lib/audit/site";
import { ALL_QUESTIONS, INTERNAL_KEYS } from "./questions";
import type { Client } from "./store";

export interface Economics {
  valeurClient: number | null; margePct: number | null; closing: number | null;
  valeurDemande: number | null;   // marge moyenne rapportée par une demande
  cplMaxRentable: number | null;  // au-delà, la pub perd de l'argent
  cplCible: number | null; budget: number | null;
  demandesBudget: number | null;  // demandes/mois au CPL cible (ou à la moitié du seuil)
  clientsBudget: number | null; capacite: number | null;
}

export interface Proposal {
  resume: string;
  enjeux: string[];
  strategie: string;
  campagnes: { nom: string; objectif: string; ciblage: string; budget_pct: number }[];
  budget_mensuel: number;
  budget_justification: string;
  objectifs_90j: string[];
  prerequis: string[];
  plan: { periode: string; actions: string }[];
  risques: string[];
  prochaine_etape: string;
}

export interface StoredProposal { proposal: Proposal; economics: Economics; site: Pick<SiteAudit, "score" | "finalUrl" | "error"> & { fails: string[] } | null; model: string; at: string }

const key = (clientId: string) => `proposal:${clientId}`;
const n = (v?: string) => { const x = Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return v && Number.isFinite(x) && x > 0 ? x : null; };

export function economics(a: Record<string, string>): Economics {
  const valeurClient = n(a.valeur_lead), margePct = n(a.marge), closing10 = n(a.closing);
  const closing = closing10 !== null ? Math.min(closing10, 10) / 10 : null;
  const valeurDemande = valeurClient !== null && closing !== null ? valeurClient * (margePct !== null ? margePct / 100 : 1) * closing : null;
  const cplCible = n(a.cpl_cible), budget = n(a.budget), capacite = n(a.capacite);
  const cplRef = cplCible ?? (valeurDemande !== null ? valeurDemande / 2 : null);
  const demandesBudget = budget !== null && cplRef ? budget / cplRef : null;
  return {
    valeurClient, margePct, closing, valeurDemande, cplMaxRentable: valeurDemande, cplCible, budget,
    demandesBudget, clientsBudget: demandesBudget !== null && closing !== null ? demandesBudget * closing : null, capacite,
  };
}

const eur = (x: number | null) => (x === null ? "inconnu" : `${Math.round(x).toLocaleString("fr-FR")} €`);

function prompt(c: Client, e: Economics, site: StoredProposal["site"]): string {
  const answers = ALL_QUESTIONS.filter((q) => c.answers[q.key]).map((q) => `${INTERNAL_KEYS.has(q.key) ? "[NOTE INTERNE, ne pas citer] " : ""}${q.label} ${c.answers[q.key]}`).join("\n");
  return [
    `Tu es un consultant senior en acquisition payante (Google Ads, Meta Ads) en France, qui travaille pour STRATYXMEDIA. Tu rédiges la synthèse de découverte et la proposition d'accompagnement pour le prospect « ${c.name} », à remettre après le rendez-vous.`,
    ``,
    `Réponses du questionnaire de découverte :`, answers || "(aucune)",
    c.website ? `Site : ${c.website}` : "",
    c.notes ? `[NOTES INTERNES, ne pas citer] ${c.notes}` : "",
    ``,
    `Calculs de rentabilité (déjà faits, à utiliser tels quels, ne les recalcule pas) :`,
    `- Marge moyenne rapportée par une demande : ${eur(e.valeurDemande)} (valeur client ${eur(e.valeurClient)}, marge ${e.margePct ?? "non renseignée"} %, ${e.closing !== null ? Math.round(e.closing * 100) + " %" : "taux inconnu"} des demandes signées)`,
    `- Coût par demande au-delà duquel la publicité perd de l'argent : ${eur(e.cplMaxRentable)}`,
    `- Coût par demande visé par le client : ${eur(e.cplCible)}`,
    `- Budget envisagé : ${eur(e.budget)} par mois, soit environ ${e.demandesBudget !== null ? Math.round(e.demandesBudget) : "?"} demandes et ${e.clientsBudget !== null ? e.clientsBudget.toFixed(1).replace(".", ",") : "?"} clients par mois${e.capacite ? `, capacité de traitement ${e.capacite} demandes par mois` : ""}`,
    site ? (site.error ? `- Audit de la page : ${site.error}` : `- Audit de la page : score ${site.score}/100, points à corriger : ${site.fails.join(" ; ") || "aucun"}`) : "",
    ``,
    `Règles :`,
    `1. Français professionnel, direct, sans jargon inutile, vouvoiement. Pas de tirets longs. Pas d'emoji.`,
    `2. N'invente aucun fait, chiffre de marché ou promesse de résultat. Les objectifs sont des fourchettes prudentes tirées des calculs ci-dessus.`,
    `3. Les notes internes servent à calibrer ton discours (risques, budget) mais ne doivent jamais apparaître ni être paraphrasées de façon reconnaissable.`,
    `4. Si le budget est incohérent avec l'objectif ou la rentabilité, dis-le avec tact et propose un budget justifié.`,
    `5. Les prérequis concrets d'abord (suivi des conversions, rappel rapide des demandes, page d'atterrissage) si les réponses montrent un manque.`,
    `6. 1 à 4 campagnes, dont la somme des budget_pct fait 100.`,
    ``,
    `Réponds UNIQUEMENT avec ce JSON valide :`,
    `{"resume":"3 à 5 phrases : situation, besoin, objectif","enjeux":["3 à 5 enjeux clés"],"strategie":"4 à 6 phrases : la stratégie d'acquisition recommandée et pourquoi","campagnes":[{"nom":"...","objectif":"...","ciblage":"...","budget_pct":60}],"budget_mensuel":900,"budget_justification":"2 à 3 phrases","objectifs_90j":["3 à 4 objectifs chiffrés prudents"],"prerequis":["..."],"plan":[{"periode":"Semaine 1","actions":"..."},{"periode":"Semaines 2 à 4","actions":"..."},{"periode":"Mois 2 et 3","actions":"..."}],"risques":["2 à 4 points de vigilance formulés pour le client"],"prochaine_etape":"1 phrase"}`,
  ].filter((l) => l !== "").join("\n");
}

const CHAIN = [process.env.BUILDER_MODEL ?? "claude-sonnet-5-5", "claude-sonnet-4-6"];

export async function generateProposal(c: Client): Promise<StoredProposal> {
  const e = economics(c.answers ?? {});
  const url = c.website || c.answers?.site;
  let site: StoredProposal["site"] = null;
  if (url) {
    const s = await analyzeSite(url).catch(() => null);
    if (s) site = { score: s.score, finalUrl: s.finalUrl, error: s.error, fails: s.checks.filter((x) => !x.ok && x.level !== "mineur").map((x) => x.label) };
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let res: Awaited<ReturnType<typeof client.messages.create>> | null = null, model = "", last: unknown = null;
  for (const m of [...new Set(CHAIN)]) {
    try { model = m; res = await client.messages.create({ model: m, max_tokens: 4000, messages: [{ role: "user", content: prompt(c, e, site) }] }); break; }
    catch (err) { last = err; if (!/model|not_found|404/i.test(String(err))) throw err; }
  }
  if (!res || !("content" in res)) throw new Error(`Aucun modèle disponible : ${String(last).slice(0, 160)}`);
  const usage = calcCost(model, res.usage.input_tokens, res.usage.output_tokens);
  await addMonthlyCost(usage.costUsd, "copilote", null).catch(() => undefined);
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  let p: Proposal;
  try { p = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { throw new Error("Réponse de l'IA illisible, relance."); }
  const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).replace(/\s*—\s*/g, ", ")) : []);
  const clean: Proposal = {
    resume: String(p.resume ?? ""), enjeux: arr(p.enjeux), strategie: String(p.strategie ?? ""),
    campagnes: Array.isArray(p.campagnes) ? p.campagnes.slice(0, 4).map((x) => ({ nom: String(x.nom ?? ""), objectif: String(x.objectif ?? ""), ciblage: String(x.ciblage ?? ""), budget_pct: Number(x.budget_pct) || 0 })) : [],
    budget_mensuel: Number(p.budget_mensuel) || e.budget || 0, budget_justification: String(p.budget_justification ?? ""),
    objectifs_90j: arr(p.objectifs_90j), prerequis: arr(p.prerequis),
    plan: Array.isArray(p.plan) ? p.plan.slice(0, 5).map((x) => ({ periode: String(x.periode ?? ""), actions: String(x.actions ?? "") })) : [],
    risques: arr(p.risques), prochaine_etape: String(p.prochaine_etape ?? ""),
  };
  const stored: StoredProposal = { proposal: clean, economics: e, site, model, at: new Date().toISOString() };
  await setSetting(key(c.id), JSON.stringify(stored), null);
  return stored;
}

export async function getProposal(clientId: string): Promise<StoredProposal | null> {
  const v = await getSetting(key(clientId), null);
  if (!v) return null;
  try { return JSON.parse(v) as StoredProposal; } catch { return null; }
}
