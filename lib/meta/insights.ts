// Chiffres Meta Ads de la semaine pour le rapport du lundi. LECTURE SEULE.
//
// Un seul appel, GET /act_{id}/insights : aucune écriture sur Meta, ici ni ailleurs.
// fetch natif, aucune dépendance. Le jeton passe dans l'en-tête Authorization (jamais dans
// l'URL) et n'est jamais écrit dans les logs.
//
// Config (env) :
//   ADS_DATA_MODE        — même variable que Google Ads : mock = données factices, live = vrais appels.
//   META_ACCESS_TOKEN    — jeton System User, permission ads_read uniquement.
//   META_AD_ACCOUNT_IDS  — IDs des comptes publicitaires séparés par des virgules, sans « act_ ».
//   META_GRAPH_VERSION   — version de l'API Graph, ex. v25.0 (défaut ci-dessous).
import { isLive } from "@/lib/google-ads/config";
import { mapLimit } from "@/lib/concurrency";
import { summarizeRows } from "./parse";
import type { MetaInsightRow, MetaInsightsResult, MetaAccountInsights } from "./parse";

export type { MetaAccountInsights, MetaInsightsResult } from "./parse";

const DEFAULT_GRAPH_VERSION = "v25.0";
const TIMEOUT_MS = 10_000;
const FIELDS = "account_name,account_currency,spend,impressions,clicks,actions";

/** IDs lus dans META_AD_ACCOUNT_IDS (virgules, espaces tolérés). */
export function metaAccountIdsFromEnv(): string[] {
  return (process.env.META_AD_ACCOUNT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Accepte « 123 » ou « act_123 » ; refuse tout le reste (l'ID est inséré dans l'URL). */
function normalizeId(raw: string): string | null {
  const id = raw.trim().replace(/^act_/i, "");
  return /^\d+$/.test(id) ? id : null;
}

function redact(text: string, token: string): string {
  return token ? text.split(token).join("***") : text;
}

async function fetchAccount(id: string, token: string, version: string): Promise<MetaAccountInsights> {
  const url = `https://graph.facebook.com/${version}/act_${id}/insights?` +
    new URLSearchParams({ fields: FIELDS, date_preset: "last_7d", level: "account" });
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error(`délai dépassé (${TIMEOUT_MS / 1000} s)`);
    }
    throw new Error("réseau injoignable");
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string; code?: number } };
      detail = ` (code ${body.error?.code ?? "?"}) ${body.error?.message ?? ""}`.trimEnd();
    } catch { /* corps illisible : on garde le statut seul */ }
    throw new Error(redact(`HTTP ${res.status}${detail}`, token));
  }
  const body = (await res.json()) as { data?: MetaInsightRow[] };
  const rows = Array.isArray(body.data) ? body.data : [];
  // Les totaux additionnent des euros : un compte dans une autre devise fausserait la somme.
  const other = rows.find((r) => r.account_currency && r.account_currency !== "EUR");
  if (other) throw new Error(`devise ${other.account_currency} non prise en charge (EUR attendu)`);
  return summarizeRows(id, rows);
}

// Données factices : mêmes formes que la réponse de l'API, lues par le même code que le live.
// Artisans du 83 et du 06. Le premier compte a des types de lead qui se recoupent (test du
// double comptage), le dernier démarre et n'a encore aucun lead.
const MOCK_ROWS: Record<string, MetaInsightRow[]> = {
  "100000000000083": [{
    account_name: "Démo · Fenêtres et volets, Var (83)", account_currency: "EUR",
    spend: "342.18", impressions: "47210", clicks: "689",
    actions: [
      { action_type: "link_click", value: "689" },
      { action_type: "post_engagement", value: "1410" },
      { action_type: "lead", value: "12" },
      { action_type: "onsite_conversion.lead_grouped", value: "9" },
      { action_type: "offsite_conversion.fb_pixel_lead", value: "3" },
    ],
  }],
  "100000000000006": [{
    account_name: "Démo · Couverture, Alpes-Maritimes (06)", account_currency: "EUR",
    spend: "215.60", impressions: "29840", clicks: "402",
    actions: [
      { action_type: "link_click", value: "402" },
      { action_type: "onsite_conversion.lead_grouped", value: "5" },
    ],
  }],
  "100000000000084": [{
    account_name: "Démo · Salle de bain, Toulon (83)", account_currency: "EUR",
    spend: "96.40", impressions: "13120", clicks: "158",
    actions: [{ action_type: "link_click", value: "158" }],
  }],
};

/**
 * Chiffres des 7 derniers jours par compte. Ne lève jamais d'exception : un compte en échec
 * (jeton expiré, erreur API, délai) est loggé puis listé dans `failed`, les autres continuent.
 */
export async function getMetaWeeklyInsights(accountIds: string[]): Promise<MetaInsightsResult> {
  if (!isLive()) {
    return { accounts: Object.entries(MOCK_ROWS).map(([id, rows]) => summarizeRows(id, rows)), failed: [] };
  }

  const token = process.env.META_ACCESS_TOKEN ?? "";
  const version = (process.env.META_GRAPH_VERSION ?? DEFAULT_GRAPH_VERSION).trim();
  const failedAll = () => ({ accounts: [], failed: accountIds });
  if (!token) { console.error("[meta] META_ACCESS_TOKEN manquant"); return failedAll(); }
  if (!/^v\d+\.\d+$/.test(version)) { console.error("[meta] META_GRAPH_VERSION invalide (attendu : v25.0)"); return failedAll(); }
  if (!accountIds.length) { console.error("[meta] META_AD_ACCOUNT_IDS vide"); return { accounts: [], failed: [] }; }

  const accounts: MetaAccountInsights[] = [];
  const failed: string[] = [];
  const outcomes = await mapLimit(accountIds, 3, async (raw) => {
    const id = normalizeId(raw);
    if (!id) return { raw, error: "identifiant invalide (chiffres attendus, sans act_)" };
    try {
      return { raw, ok: await fetchAccount(id, token, version) };
    } catch (e) {
      return { raw, error: redact(e instanceof Error ? e.message : "erreur inconnue", token) };
    }
  });
  for (const o of outcomes) {
    if ("ok" in o && o.ok) accounts.push(o.ok);
    else {
      failed.push(o.raw);
      console.error(`[meta] compte ${o.raw} indisponible : ${"error" in o ? o.error : "erreur inconnue"}`);
    }
  }
  return { accounts, failed };
}
