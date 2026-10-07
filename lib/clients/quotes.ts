// Devis : réglages (tes coordonnées et tes offres) et devis par client.
// Tout est stocké dans app_settings (pas de migration).
import { getSetting, setSetting } from "@/lib/agent/store";

export interface QuoteLine { libelle: string; type: "unique" | "mensuel"; montant: number }
export interface Offer { nom: string; lignes: QuoteLine[]; engagementMois: number; notes: string }
export interface QuoteSettings {
  raisonSociale: string; adresse: string; email: string; telephone: string; siret: string;
  mentionTva: string; validiteJours: number; conditionsPaiement: string; garantie: string;
  offres: Offer[];
}
export interface Quote {
  numero: string; date: string; offreNom: string; lignes: QuoteLine[]; engagementMois: number;
  budgetPub: number | null; notes: string; garantie: boolean; statut: "brouillon" | "envoye" | "accepte" | "refuse";
}

export const DEFAULT_SETTINGS: QuoteSettings = {
  raisonSociale: "STRATYX Media", adresse: "1, avenue des Anglais, 06400 Cannes", email: "contact@stratyxmedia.fr", telephone: "", siret: "",
  mentionTva: "TVA non applicable, art. 293 B du CGI", validiteJours: 30,
  conditionsPaiement: "Frais de mise en place payables à la signature. Honoraires mensuels payables d'avance, le 1er de chaque mois, par virement.",
  garantie: "Clause de vérité : si l'objectif de coût par demande fixé ensemble n'est pas atteint à 90 jours, le mois suivant est offert ou vous pouvez arrêter sans pénalité.",
  offres: [
    { nom: "Pilote Google Ads 90 jours", engagementMois: 3, notes: "Le budget publicitaire est payé directement à Google, il n'est pas inclus dans ce devis.",
      lignes: [
        { libelle: "Mise en place : audit, suivi des conversions, structure des campagnes, annonces", type: "unique", montant: 0 },
        { libelle: "Page d'atterrissage et formulaire dédié", type: "unique", montant: 0 },
        { libelle: "Pilotage mensuel : optimisations, rapport mensuel, point mensuel", type: "mensuel", montant: 0 },
      ] },
  ],
};

const SETTINGS_KEY = "quote_settings";
const COUNTER_KEY = "quote_counter";
const quoteKey = (clientId: string) => `quote:${clientId}`;

export async function getQuoteSettings(): Promise<QuoteSettings> {
  const v = await getSetting(SETTINGS_KEY, null);
  if (!v) return DEFAULT_SETTINGS;
  try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(v) as Partial<QuoteSettings>) }; } catch { return DEFAULT_SETTINGS; }
}
export async function saveQuoteSettings(s: QuoteSettings) { await setSetting(SETTINGS_KEY, JSON.stringify(s), null); }

export async function getQuote(clientId: string): Promise<Quote | null> {
  const v = await getSetting(quoteKey(clientId), null);
  if (!v) return null;
  try { return JSON.parse(v) as Quote; } catch { return null; }
}
export async function saveQuote(clientId: string, q: Quote) { await setSetting(quoteKey(clientId), JSON.stringify(q), null); }

/** Numéro DEV-AAAA-NNN, compteur global. */
export async function nextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const raw = await getSetting(COUNTER_KEY, null);
  let { y, n } = (() => { try { return raw ? JSON.parse(raw) as { y: number; n: number } : { y: year, n: 0 }; } catch { return { y: year, n: 0 }; } })();
  if (y !== year) { y = year; n = 0; }
  n += 1;
  await setSetting(COUNTER_KEY, JSON.stringify({ y, n }), null);
  return `DEV-${y}-${String(n).padStart(3, "0")}`;
}

export function totals(q: Pick<Quote, "lignes" | "engagementMois">) {
  const unique = q.lignes.filter((l) => l.type === "unique").reduce((s, l) => s + l.montant, 0);
  const mensuel = q.lignes.filter((l) => l.type === "mensuel").reduce((s, l) => s + l.montant, 0);
  return { unique, mensuel, engagement: unique + mensuel * Math.max(0, q.engagementMois) };
}

/** Lit les lignes d'un formulaire (l0_libelle, l0_type, l0_montant…). */
export function linesFromForm(form: FormData, max = 10): QuoteLine[] {
  const out: QuoteLine[] = [];
  for (let i = 0; i < max; i++) {
    const libelle = String(form.get(`l${i}_libelle`) ?? "").trim();
    if (!libelle) continue;
    const montant = Number(String(form.get(`l${i}_montant`) ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
    out.push({ libelle: libelle.slice(0, 200), type: form.get(`l${i}_type`) === "mensuel" ? "mensuel" : "unique", montant: Math.max(0, Math.round(montant * 100) / 100) });
  }
  return out;
}
