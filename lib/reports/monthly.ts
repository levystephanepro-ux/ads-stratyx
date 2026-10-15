// Compte rendu mensuel (modèle Ades) : résultats du mois vs même nombre de jours du
// mois précédent, journal des modifications (change_event) avec l'auteur, et texte
// client rédigé par l'IA à partir de ces seules données.
import Anthropic from "@anthropic-ai/sdk";
import { isLive } from "@/lib/google-ads/config";
import { searchRaw } from "@/lib/google-ads/client";
import { readChanges, CHANGE_KINDS, type ChangeLine } from "./changes";
import { listActions } from "@/lib/fixes/store";
import { getSetting, setSetting } from "@/lib/agent/store";
import { calcCost, addMonthlyCost } from "@/lib/agent/cost";
import { getGlobalBilling } from "@/lib/billing";
import { getAccountContext } from "@/lib/account-context";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export type Author = "manuel" | "stratyx" | "api" | "google" | "script";
export const AUTHORS: Record<Author, { label: string; hint: string }> = {
  manuel: { label: "Manuel", hint: "interface Google Ads, Editor, appli mobile, import" },
  stratyx: { label: "Stratyx", hint: "correction envoyée depuis Stratyx (journal des corrections)" },
  api: { label: "API", hint: "autre application connectée" },
  google: { label: "Auto Google", hint: "recommandations appliquées automatiquement, outils internes" },
  script: { label: "Script / règle", hint: "script ou règle automatique Google Ads" },
};

export interface MonthLine extends ChangeLine { by: Author }

export interface MonthFrame { month: string; start: string; end: string; pStart: string; pEnd: string; days: number; label: string; ready: boolean }

/** Mois AAAA-MM : du 1er à hier (ou fin du mois), comparé au même nombre de jours du mois d'avant. */
export function monthFrame(month: string, now = new Date()): MonthFrame {
  const [yy, mm] = month.split("-").map(Number);
  const start = new Date(Date.UTC(yy, mm - 1, 1));
  const monthEnd = new Date(Date.UTC(yy, mm, 0));
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const end = monthEnd < yesterday ? monthEnd : yesterday;
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 864e5) + 1);
  const pStart = new Date(Date.UTC(yy, mm - 2, 1));
  const pEnd = new Date(pStart); pEnd.setUTCDate(pStart.getUTCDate() + days - 1);
  return {
    month, start: iso(start), end: iso(end), pStart: iso(pStart), pEnd: iso(pEnd), days, ready: end >= start,
    label: start.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}

export function recentMonths(n = 3, now = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))).slice(0, 7));
}

export interface Totals { cost: number; conv: number; clicks: number; impressions: number }

export interface MonthlyReport {
  frame: MonthFrame;
  res: Totals;
  prev: Totals;
  lines: MonthLine[];
  /** Date à partir de laquelle le journal est lu (Google ne garde que 30 jours). */
  since: string;
}

function authorOf(tool: string, stratyxDays: Set<string>, date: string): Author {
  if (tool === "API") return stratyxDays.has(date) ? "stratyx" : "api";
  if (tool === "Recos Google" || tool === "Google") return "google";
  if (tool === "Script" || tool === "Règle auto") return "script";
  return "manuel";
}

export async function getMonthlyReport(customerId: string, month: string): Promise<MonthlyReport> {
  const frame = monthFrame(month);
  const zero = (): Totals => ({ cost: 0, conv: 0, clicks: 0, impressions: 0 });
  if (!frame.ready) return { frame, res: zero(), prev: zero(), lines: [], since: frame.start };
  if (!isLive()) return demoReport(frame);
  const sel = "SELECT metrics.cost_micros, metrics.conversions, metrics.clicks, metrics.impressions FROM customer WHERE ";
  const tot = (rows: { metrics?: Record<string, unknown> }[]): Totals => rows.reduce((a, r) => ({
    cost: a.cost + Number(r.metrics?.costMicros ?? 0) / 1e6,
    conv: a.conv + Number(r.metrics?.conversions ?? 0),
    clicks: a.clicks + Number(r.metrics?.clicks ?? 0),
    impressions: a.impressions + Number(r.metrics?.impressions ?? 0),
  }), zero());
  const [ch, a, b, actions] = await Promise.all([
    readChanges({ customerId }, frame.start, frame.end),
    searchRaw({ customerId }, `${sel} segments.date BETWEEN '${frame.start}' AND '${frame.end}'`),
    searchRaw({ customerId }, `${sel} segments.date BETWEEN '${frame.pStart}' AND '${frame.pEnd}'`),
    listActions(customerId, 500).catch(() => []),
  ]);
  // Jours où Stratyx a envoyé une correction : les modifications « API » de ces jours-là viennent de Stratyx.
  const stratyxDays = new Set(actions.filter((x) => x.status !== "failed").map((x) => x.created_at.slice(0, 10)));
  const lines: MonthLine[] = ch.lines.map((l) => ({ ...l, by: authorOf(l.tool, stratyxDays, l.date) }));
  return { frame, res: tot(a), prev: tot(b), lines, since: ch.clampedSince };
}

// ── Texte client rédigé par l'IA ─────────────────────────────────────────

const draftKey = (customerId: string, month: string) => `compte_rendu:${customerId}:${month}`;
export interface Draft { at: string; text: string }

export async function readDraft(customerId: string, month: string): Promise<Draft | null> {
  try { const raw = await getSetting(draftKey(customerId, month)); return raw ? (JSON.parse(raw) as Draft) : null; } catch { return null; }
}

const MODEL = "claude-haiku-4-5-20251001";
const eur = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;

/** Rédige le compte rendu client (≈ 1 crédit) et l'enregistre. N'utilise que les chiffres et actions fournis. */
export async function writeDraft(customerId: string, accountName: string, month: string): Promise<Draft> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Clé API Anthropic manquante (ANTHROPIC_API_KEY).");
  const billing = await getGlobalBilling();
  if (!billing.allowed) throw new Error(billing.reason ?? "Plafond IA du mois atteint.");
  const r = await getMonthlyReport(customerId, month);
  if (!r.frame.ready) throw new Error("Le mois vient de commencer : rien à résumer avant demain.");
  const ctx = await getAccountContext(customerId, null).catch(() => "");
  const facts = [
    `Compte : ${accountName}`,
    ctx ? `Contexte de l'entreprise : ${ctx.slice(0, 1500)}` : "",
    `Période : du ${r.frame.start} au ${r.frame.end} (${r.frame.days} jours), comparée au ${r.frame.pStart} → ${r.frame.pEnd}.`,
    `Résultats : dépense ${eur(r.res.cost)} (avant ${eur(r.prev.cost)}), ${r.res.conv.toFixed(1)} conversion(s) (avant ${r.prev.conv.toFixed(1)}), ${r.res.clicks} clics (avant ${r.prev.clicks}), ${r.res.impressions} impressions (avant ${r.prev.impressions}).`,
    r.res.conv ? `Coût par conversion : ${eur(r.res.cost / r.res.conv)}${r.prev.conv ? ` (avant ${eur(r.prev.cost / r.prev.conv)})` : ""}.` : "Aucune conversion sur la période.",
    "",
    "Actions menées (journal Google Ads, regroupées) :",
    ...r.lines.slice(0, 80).map((l) => `- ${l.date} · ${CHANGE_KINDS[l.kind] ?? l.kind} · ${l.text}${l.detail.length ? ` : ${l.detail.slice(0, 6).join(", ")}` : ""} [${AUTHORS[l.by].label}]`),
    r.since > r.frame.start ? `(Journal disponible seulement à partir du ${r.since} : Google garde 30 jours.)` : "",
  ].filter(Boolean).join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: MODEL, max_tokens: 1400,
    system: "Tu rédiges le compte rendu mensuel Google Ads qu'un consultant envoie à son client, une entreprise française. Ton clair, concret, professionnel, sans jargon (explique en mots simples), sans tiret long, sans emoji. Tu n'utilises QUE les chiffres et actions fournis : n'invente rien, ne promets rien.",
    messages: [{ role: "user", content: `${facts}\n\nRédige en texte simple (pas de markdown, titres en majuscules suivis de deux-points) :\nRÉSULTATS DU MOIS : 3 à 4 phrases, chiffres et évolution.\nCE QUI A ÉTÉ FAIT : les actions regroupées par thème, et pourquoi elles servent le client.\nPROCHAINES ÉTAPES : 2 ou 3 actions prévues, déduites des résultats.\n250 mots maximum. Commence par « Bonjour, » et termine par une phrase de disponibilité.` }],
  });
  const usage = calcCost(MODEL, res.usage.input_tokens, res.usage.output_tokens);
  await addMonthlyCost(usage.costUsd, "agent", null).catch(() => undefined);
  const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
  const draft = { at: new Date().toISOString(), text };
  await setSetting(draftKey(customerId, month), JSON.stringify(draft));
  return draft;
}

// Démo (mode mock) : un mois type sur un compte de menuiserie.
function demoReport(frame: MonthFrame): MonthlyReport {
  const d = (n: number) => { const x = new Date(frame.end + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() - n); return iso(x); };
  const C = "D2B - Fenêtres - La-Farlède";
  const L = (date: string, time: string, kind: string, text: string, detail: string[], tool: string, by: Author): MonthLine =>
    ({ date, time, campaign: C, kind, text, detail, author: by === "manuel" ? "stephane@exemple.fr" : "", tool, by });
  const lines: MonthLine[] = [
    L(d(1), "17:42", "negatifs", `4 négatifs de campagne ajoutés dans « ${C} »`, ["[pierret portes et fenêtres]", "[kline fenetre]", "[fenetre internorm]", "[portes garofoli]"], "API", "stratyx"),
    L(d(1), "09:10", "extensions", `extension modifiée dans « ${C} »`, [], "Interface", "manuel"),
    L(d(3), "11:05", "mots_cles", `2 mots-clés ajoutés dans « ${C} »`, ['"fenetre la crau"', "[menuiserie la farlede]"], "Interface", "manuel"),
    L(d(3), "11:02", "mots_cles", `mot-clé mis en pause dans « ${C} »`, ['"fenetre oscillo battant"'], "Interface", "manuel"),
    L(d(6), "08:30", "annonces", `annonce modifiée dans « ${C} »`, [], "Editor", "manuel"),
    L(d(9), "14:20", "encheres", `enchère de mot-clé modifiée dans « ${C} »`, ['"porte fenetre" : 3,50 € → 3,00 €'], "Recos Google", "google"),
    L(d(12), "10:00", "budget", `budget modifié dans « ${C} »`, ["25 € → 30 € par jour"], "Interface", "manuel"),
  ].filter((l) => l.date >= frame.start);
  return { frame, res: { cost: 402.47, conv: 0, clicks: 86, impressions: 1202 }, prev: { cost: 389.1, conv: 2, clicks: 71, impressions: 1015 }, lines, since: frame.start };
}
