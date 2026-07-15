// Façade Google Ads : le reste de l'app appelle CES fonctions, sans savoir si
// les données viennent du mock ou de l'API réelle. Basculer mock → live ne
// touche que ce fichier (et la config), pas l'UI ni le serveur MCP.
//
// Le mode live appelle l'API REST Google Ads DIRECTEMENT (fetch natif). Choix
// délibéré : (1) la version d'API vit dans l'URL → GOOGLE_ADS_API_VERSION est la
// seule source de vérité (principe anti-déprécation), (2) évite la couche de
// transport de google-ads-api qui échoue derrière certains proxys Windows.
import { adsConfig, isLive, assertLiveConfig } from "./config";
import { MOCK_ACCOUNT, MOCK_CAMPAIGNS, MOCK_METRICS } from "./mock-data";
import type {
  AdsAccount,
  Campaign,
  CampaignChannel,
  CampaignMetrics,
  CampaignStatus,
  DateRange,
} from "./types";

/** Contexte d'appel : quel compte Google Ads, avec quel refresh token. */
export interface AdsContext {
  customerId: string;
  refreshToken?: string | null;
}

export async function getAccount(ctx: AdsContext): Promise<AdsAccount> {
  if (!isLive()) return MOCK_ACCOUNT;
  const rows = await search(
    ctx,
    `SELECT customer.id, customer.descriptive_name, customer.currency_code,
            customer.time_zone
     FROM customer LIMIT 1`,
  );
  const c = rows[0]?.customer ?? {};
  return {
    customerId: String(c.id ?? ctx.customerId),
    descriptiveName: c.descriptiveName ?? `Compte ${ctx.customerId}`,
    currencyCode: c.currencyCode ?? "EUR",
    timeZone: c.timeZone ?? "Europe/Paris",
  };
}

export async function listCampaigns(ctx: AdsContext): Promise<Campaign[]> {
  if (!isLive()) return MOCK_CAMPAIGNS;
  const rows = await search(
    ctx,
    `SELECT campaign.id, campaign.name, campaign.status,
            campaign.advertising_channel_type, campaign_budget.amount_micros
     FROM campaign
     WHERE campaign.status != 'REMOVED'
     ORDER BY campaign.name`,
  );
  return rows.map((r) => ({
    id: String(r.campaign?.id ?? ""),
    name: r.campaign?.name ?? "",
    status: mapStatus(r.campaign?.status),
    channel: mapChannel(r.campaign?.advertisingChannelType),
    dailyBudget: micros(r.campaignBudget?.amountMicros),
  }));
}

export async function getCampaignMetrics(
  ctx: AdsContext,
  range: DateRange,
): Promise<CampaignMetrics[]> {
  if (!isLive()) return MOCK_METRICS;
  const { since, until } = normalizeRange(range);
  const rows = await search(
    ctx,
    `SELECT campaign.id, campaign.name, metrics.impressions, metrics.clicks,
            metrics.cost_micros, metrics.conversions, metrics.conversions_value
     FROM campaign
     WHERE segments.date BETWEEN '${since}' AND '${until}'
       AND campaign.status != 'REMOVED'
     ORDER BY metrics.cost_micros DESC`,
  );
  return rows.map((r) => ({
    campaignId: String(r.campaign?.id ?? ""),
    campaignName: r.campaign?.name ?? "",
    impressions: Number(r.metrics?.impressions ?? 0),
    clicks: Number(r.metrics?.clicks ?? 0),
    cost: micros(r.metrics?.costMicros),
    conversions: Number(r.metrics?.conversions ?? 0),
    conversionsValue: Number(r.metrics?.conversionsValue ?? 0),
  }));
}

export interface ManagedAccount {
  customerId: string;
  name: string;
  currencyCode: string | null;
  isManager: boolean;
}

// Cache mémoire des comptes gérés (évite un appel customer_client à chaque render).
let managedCache: { accounts: ManagedAccount[]; exp: number } | null = null;

/**
 * Liste les comptes clients sous le manager (MCC) configuré. Si aucun MCC n'est
 * défini, renvoie simplement le compte courant. Résultat mis en cache 5 min.
 */
export async function listManagedAccounts(
  refreshToken?: string | null,
): Promise<ManagedAccount[]> {
  if (!isLive()) {
    return [
      {
        customerId: MOCK_ACCOUNT.customerId,
        name: MOCK_ACCOUNT.descriptiveName,
        currencyCode: MOCK_ACCOUNT.currencyCode,
        isManager: false,
      },
    ];
  }
  if (managedCache && managedCache.exp > Date.now()) return managedCache.accounts;

  const mcc = adsConfig.loginCustomerId || adsConfig.customerId;
  const rows = await search(
    { customerId: mcc, refreshToken },
    `SELECT customer_client.id, customer_client.descriptive_name,
            customer_client.currency_code, customer_client.manager,
            customer_client.level, customer_client.status
     FROM customer_client
     WHERE customer_client.status = 'ENABLED'`,
  );
  const accounts: ManagedAccount[] = rows
    .map((r) => r.customerClient!)
    .filter((c) => c && !c.manager) // on ne garde que les comptes clients
    .map((c) => ({
      customerId: String(c.id),
      name: c.descriptiveName ?? `Compte ${c.id}`,
      currencyCode: c.currencyCode ?? null,
      isManager: false,
    }));

  // Repli : si le MCC n'a pas de clients listables, on expose au moins le compte courant.
  const result = accounts.length
    ? accounts
    : [{ customerId: adsConfig.customerId, name: `Compte ${adsConfig.customerId}`, currencyCode: null, isManager: false }];

  managedCache = { accounts: result, exp: Date.now() + 5 * 60_000 };
  return result;
}

/** Liste les IDs de comptes accessibles avec un refresh token (post-OAuth). */
export async function listAccessibleCustomerIds(
  refreshToken: string,
): Promise<string[]> {
  assertLiveConfig();
  const token = await getAccessToken(refreshToken);
  const res = await fetch(
    `https://googleads.googleapis.com/${adsConfig.apiVersion}/customers:listAccessibleCustomers`,
    { headers: { Authorization: `Bearer ${token}`, "developer-token": adsConfig.developerToken } },
  );
  const j = await res.json();
  if (!res.ok) throw new Error(gaError(j));
  return (j.resourceNames ?? []).map((r: string) => r.split("/")[1]);
}

// ---------------------------------------------------------------------------
// Lecture enrichie : search terms, ad groups
// ---------------------------------------------------------------------------

export interface SearchTermRow {
  term: string;
  campaignName: string;
  clicks: number;
  cost: number;
  conversions: number;
}

export async function getSearchTerms(
  ctx: AdsContext,
  range: DateRange,
  limit = 30,
): Promise<SearchTermRow[]> {
  if (!isLive()) return [];
  const { since, until } = normalizeRange(range);
  const rows = await search(
    ctx,
    `SELECT search_term_view.search_term, campaign.name, metrics.clicks,
            metrics.cost_micros, metrics.conversions
     FROM search_term_view
     WHERE segments.date BETWEEN '${since}' AND '${until}'
       AND campaign.status != 'REMOVED'
     ORDER BY metrics.cost_micros DESC
     LIMIT ${limit}`,
  );
  return rows.map((r) => ({
    term: r.searchTermView?.searchTerm ?? "",
    campaignName: r.campaign?.name ?? "",
    clicks: Number(r.metrics?.clicks ?? 0),
    cost: micros(r.metrics?.costMicros),
    conversions: Number(r.metrics?.conversions ?? 0),
  }));
}

export interface AdGroupRow {
  id: string;
  name: string;
  campaignName: string;
  status: string;
  cost: number;
  conversions: number;
}

export async function listAdGroups(
  ctx: AdsContext,
  range: DateRange,
): Promise<AdGroupRow[]> {
  if (!isLive()) return [];
  const { since, until } = normalizeRange(range);
  const rows = await search(
    ctx,
    `SELECT ad_group.id, ad_group.name, ad_group.status, campaign.name,
            metrics.cost_micros, metrics.conversions
     FROM ad_group
     WHERE segments.date BETWEEN '${since}' AND '${until}'
       AND ad_group.status != 'REMOVED'
       AND campaign.status != 'REMOVED'
     ORDER BY metrics.cost_micros DESC`,
  );
  return rows.map((r) => ({
    id: String(r.adGroup?.id ?? ""),
    name: r.adGroup?.name ?? "",
    campaignName: r.campaign?.name ?? "",
    status: String(r.adGroup?.status ?? ""),
    cost: micros(r.metrics?.costMicros),
    conversions: Number(r.metrics?.conversions ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Écriture (mutate) — pause/activation de campagne, budget
// ---------------------------------------------------------------------------

/** Passe une campagne en ENABLED ou PAUSED. */
export async function setCampaignStatus(
  ctx: AdsContext,
  campaignId: string,
  status: "ENABLED" | "PAUSED",
): Promise<void> {
  await mutate(ctx, "campaigns", [
    {
      update: {
        resourceName: `customers/${ctx.customerId}/campaigns/${campaignId}`,
        status,
      },
      updateMask: "status",
    },
  ]);
}

/** Change le budget quotidien (en unités de devise) d'une campagne. */
export async function updateCampaignBudget(
  ctx: AdsContext,
  campaignId: string,
  dailyAmount: number,
): Promise<void> {
  // Le budget est une ressource séparée : on récupère d'abord son resource_name.
  const rows = await search(
    ctx,
    `SELECT campaign_budget.resource_name
     FROM campaign
     WHERE campaign.id = ${campaignId}`,
  );
  const budgetRes = rows[0]?.campaignBudget?.resourceName;
  if (!budgetRes) throw new Error(`Budget introuvable pour la campagne ${campaignId}.`);

  await mutate(ctx, "campaignBudgets", [
    {
      update: {
        resourceName: budgetRes,
        amountMicros: String(Math.round(dailyAmount * 1_000_000)),
      },
      updateMask: "amount_micros",
    },
  ]);
}

/** POST bas niveau vers un endpoint :mutate. */
async function mutate(
  ctx: AdsContext,
  resource: string,
  operations: unknown[],
): Promise<void> {
  assertLiveConfig();
  const refresh = ctx.refreshToken ?? adsConfig.refreshToken;
  if (!refresh) throw new Error("Aucun refresh_token pour cette écriture.");
  const token = await getAccessToken(refresh);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": adsConfig.developerToken,
    "Content-Type": "application/json",
  };
  if (adsConfig.loginCustomerId) headers["login-customer-id"] = adsConfig.loginCustomerId;

  const res = await fetch(
    `https://googleads.googleapis.com/${adsConfig.apiVersion}/customers/${ctx.customerId}/${resource}:mutate`,
    { method: "POST", headers, body: JSON.stringify({ operations }) },
  );
  const j = await res.json();
  if (!res.ok) throw new Error(gaError(j));
}

// ---------------------------------------------------------------------------
// Bas niveau REST
// ---------------------------------------------------------------------------

// Cache mémoire des access tokens, par refresh token (évite un refresh par appel).
const tokenCache = new Map<string, { token: string; exp: number }>();

async function getAccessToken(refreshToken: string): Promise<string> {
  const cached = tokenCache.get(refreshToken);
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: adsConfig.oauthClientId,
      client_secret: adsConfig.oauthClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) {
    throw new Error(`OAuth refresh échoué : ${j.error_description ?? j.error ?? res.status}`);
  }
  tokenCache.set(refreshToken, {
    token: j.access_token,
    exp: Date.now() + (Number(j.expires_in ?? 3600) - 60) * 1000,
  });
  return j.access_token;
}

interface GaqlRow {
  campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string };
  campaignBudget?: { amountMicros?: string; resourceName?: string };
  adGroup?: { id?: string; name?: string; status?: string };
  searchTermView?: { searchTerm?: string };
  metrics?: {
    impressions?: string;
    clicks?: string;
    costMicros?: string;
    conversions?: number;
    conversionsValue?: number;
  };
  customer?: {
    id?: string;
    descriptiveName?: string;
    currencyCode?: string;
    timeZone?: string;
  };
  customerClient?: {
    id?: string;
    descriptiveName?: string;
    currencyCode?: string;
    manager?: boolean;
    level?: string;
    status?: string;
  };
}

/** Exécute une requête GAQL (googleAds:search) avec pagination. */
async function search(ctx: AdsContext, query: string): Promise<GaqlRow[]> {
  assertLiveConfig();
  const refresh = ctx.refreshToken ?? adsConfig.refreshToken;
  if (!refresh) {
    throw new Error(
      "Aucun refresh_token pour ce compte. Renseigne GOOGLE_ADS_REFRESH_TOKEN " +
        "ou connecte le compte via OAuth.",
    );
  }
  const token = await getAccessToken(refresh);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": adsConfig.developerToken,
    "Content-Type": "application/json",
  };
  // login-customer-id = compte manager (MCC) quand on interroge un client.
  if (adsConfig.loginCustomerId) headers["login-customer-id"] = adsConfig.loginCustomerId;

  const url = `https://googleads.googleapis.com/${adsConfig.apiVersion}/customers/${ctx.customerId}/googleAds:search`;
  const rows: GaqlRow[] = [];
  let pageToken: string | undefined;

  do {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(pageToken ? { query, pageToken } : { query }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(gaError(j));
    for (const r of j.results ?? []) rows.push(r);
    pageToken = j.nextPageToken;
  } while (pageToken);

  return rows;
}

/** Extrait un message d'erreur lisible d'une GoogleAdsFailure. */
function gaError(j: unknown): string {
  const err = (j as { error?: { message?: string; details?: unknown[] } })?.error;
  const detail = (err?.details?.[0] as { errors?: { message?: string }[] })?.errors?.[0]?.message;
  return `Google Ads API : ${detail ?? err?.message ?? "erreur inconnue"}`;
}

const micros = (v: unknown) => Number(v ?? 0) / 1_000_000;

function mapStatus(s: unknown): CampaignStatus {
  return s === "ENABLED" || s === "PAUSED" ? s : "REMOVED";
}

const KNOWN_CHANNELS: CampaignChannel[] = [
  "SEARCH", "SHOPPING", "PERFORMANCE_MAX", "DISPLAY", "VIDEO", "DEMAND_GEN", "LOCAL_SERVICES",
];
function mapChannel(c: unknown): CampaignChannel {
  return KNOWN_CHANNELS.includes(c as CampaignChannel) ? (c as CampaignChannel) : "OTHER";
}

function normalizeRange(range: DateRange): DateRange {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (range.since && range.until) return range;
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  return { since: range.since || iso(since), until: range.until || iso(until) };
}
