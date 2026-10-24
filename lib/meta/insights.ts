// Meta Ads (Facebook / Instagram) : chiffres des 7 derniers jours pour le rapport du lundi.
//
// LECTURE SEULE : un seul appel GET sur /act_{id}/insights, aucune fonction d'écriture.
// Le token (System User, permission ads_read uniquement) vit en env et n'est JAMAIS loggé :
// il passe dans l'en-tête Authorization, pas dans l'URL, et aucun message d'erreur ne le reprend.
//
// Config (env) :
//   META_ACCESS_TOKEN     token System User (ads_read)
//   META_AD_ACCOUNT_IDS   IDs séparés par des virgules, sans le préfixe act_
//   META_GRAPH_VERSION    ex. v23.0 (à ajuster selon la version courante)
import { isLive } from "../google-ads/config";

export interface MetaAccountInsights {
  accountId: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  /** spend / leads, null si aucun lead. */
  cpl: number | null;
}

export interface MetaWeeklyInsights {
  accounts: MetaAccountInsights[];
  /** Comptes en erreur (token expiré, erreur API, timeout...) : ignorés, jamais bloquants. */
  failed: string[];
}

interface MetaAction { action_type?: string; value?: string }
interface MetaInsightsRow { spend?: string; impressions?: string; clicks?: string; actions?: MetaAction[] }
interface MetaInsightsResponse { data?: MetaInsightsRow[]; error?: { message?: string; code?: number } }

const TIMEOUT_MS = 10_000;
const DEFAULT_GRAPH_VERSION = "v23.0";

// Types d'action Meta qui décrivent un lead.
//
// Choix anti double comptage : un même lead remonte souvent sous plusieurs types à la fois
// ("lead" est le total, "onsite_conversion.lead_grouped" le formulaire Meta, "offsite_conversion.fb_pixel_lead"
// le pixel). Les additionner compterait le même lead 2 ou 3 fois. On prend donc le type le plus élevé :
// c'est le plus proche du total réel sans jamais le dépasser.
const LEAD_ACTION_TYPES = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function countLeads(actions: MetaAction[] | undefined): number {
  if (!actions) return 0;
  return LEAD_ACTION_TYPES.reduce((max, type) => {
    const a = actions.find((x) => x.action_type === type);
    return a ? Math.max(max, toNum(a.value)) : max;
  }, 0);
}

function build(accountId: string, spend: number, impressions: number, clicks: number, leads: number): MetaAccountInsights {
  return { accountId, spend, impressions, clicks, leads, cpl: leads > 0 ? spend / leads : null };
}

/** Normalise une liste d'IDs : retire act_, espaces et valeurs non numériques. */
export function parseAccountIds(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().replace(/^act_/, ""))
    .filter((s) => /^\d+$/.test(s));
}

/** IDs configurés dans META_AD_ACCOUNT_IDS. */
export function configuredMetaAccountIds(): string[] {
  return parseAccountIds(process.env.META_AD_ACCOUNT_IDS);
}

async function fetchAccount(accountId: string, token: string, version: string): Promise<MetaAccountInsights> {
  const url = new URL(`https://graph.facebook.com/${version}/act_${accountId}/insights`);
  url.searchParams.set("fields", "spend,impressions,clicks,actions");
  url.searchParams.set("date_preset", "last_7d");
  url.searchParams.set("level", "account");

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as MetaInsightsResponse;
  if (!res.ok || json.error) {
    throw new Error(`Meta ${res.status}${json.error?.code ? ` (code ${json.error.code})` : ""} : ${json.error?.message ?? "erreur API"}`);
  }
  // Aucune ligne = aucune diffusion sur la période : on renvoie des zéros.
  const row = json.data?.[0];
  return build(accountId, toNum(row?.spend), toNum(row?.impressions), toNum(row?.clicks), countLeads(row?.actions));
}

// Données factices réalistes : artisans des Alpes-Maritimes (06) et du Var (83).
const MOCK_PROFILES: Omit<MetaAccountInsights, "accountId" | "cpl">[] = [
  { spend: 186.4, impressions: 24350, clicks: 412, leads: 11 },   // plombier-chauffagiste, Nice
  { spend: 124.9, impressions: 17980, clicks: 266, leads: 6 },    // électricien, Toulon / Hyères
  { spend: 98.2, impressions: 12640, clicks: 171, leads: 0 },     // paysagiste, Fréjus (aucun lead : teste cpl null)
];

function mockInsights(accountIds: string[]): MetaWeeklyInsights {
  const ids = accountIds.length ? accountIds : ["1000000000000001", "1000000000000002"];
  return {
    accounts: ids.map((id, i) => {
      const p = MOCK_PROFILES[i % MOCK_PROFILES.length];
      return build(id, p.spend, p.impressions, p.clicks, p.leads);
    }),
    failed: [],
  };
}

/**
 * Chiffres Meta des 7 derniers jours, un résultat par compte.
 * Fail-soft : un compte en erreur est loggé (sans token) et listé dans `failed`, les autres continuent.
 */
export async function getMetaWeeklyInsights(accountIds: string[]): Promise<MetaWeeklyInsights> {
  if (!isLive()) return mockInsights(accountIds);

  const token = process.env.META_ACCESS_TOKEN;
  const version = process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
  const ids = parseAccountIds(accountIds.join(","));
  if (!token) {
    console.error("[meta] META_ACCESS_TOKEN manquant : bloc Meta ignoré.");
    return { accounts: [], failed: ids };
  }

  const settled = await Promise.allSettled(ids.map((id) => fetchAccount(id, token, version)));
  const accounts: MetaAccountInsights[] = [];
  const failed: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      accounts.push(r.value);
    } else {
      failed.push(ids[i]);
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.error(`[meta] compte act_${ids[i]} en échec : ${msg.replaceAll(token, "***")}`);
    }
  });
  return { accounts, failed };
}
