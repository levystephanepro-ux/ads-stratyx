// Façade Google Ads : le reste de l'app appelle CES fonctions, sans savoir si
// les données viennent du mock ou de l'API réelle. Basculer mock → live ne
// touche que ce fichier (et la config), pas l'UI ni le serveur MCP.
//
// Le mode live appelle l'API REST Google Ads DIRECTEMENT (fetch natif). Choix
// délibéré : (1) la version d'API vit dans l'URL → GOOGLE_ADS_API_VERSION est la
// seule source de vérité (principe anti-déprécation), (2) évite la couche de
// transport de google-ads-api qui échoue derrière certains proxys Windows.
import { adsConfig, isLive, assertLiveConfig } from "./config";
import { MOCK_ACCOUNT, MOCK_CAMPAIGNS, MOCK_METRICS, MOCK_SEARCH_TERMS } from "./mock-data";
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
  /** login-customer-id explicite ; sinon déduit (MCC, ou le compte lui-même en accès direct). */
  loginCustomerId?: string | null;
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
  /** « mcc » = sous le MCC configuré ; « direct » = accès donné directement à ton email Google. */
  source?: "mcc" | "direct";
  /** login-customer-id à envoyer pour ce compte. */
  loginId?: string;
}

// Cache mémoire des comptes gérés (évite un appel customer_client à chaque render).
let managedCache: { accounts: ManagedAccount[]; exp: number } | null = null;
// compte → login-customer-id (rempli par listManagedAccounts)
const loginMap = new Map<string, string>();

/** login-customer-id à utiliser pour un compte (requêtes de l'owner). */
async function loginFor(ctx: AdsContext): Promise<string | null> {
  if (ctx.loginCustomerId !== undefined) return ctx.loginCustomerId;
  if (ctx.refreshToken) return adsConfig.loginCustomerId || null; // comptes connectés en OAuth : comportement d'origine
  if (!loginMap.has(ctx.customerId) && !(managedCache && managedCache.exp > Date.now())) {
    try { await listManagedAccounts(); } catch { /* repli ci-dessous */ }
  }
  return loginMap.get(ctx.customerId) ?? (adsConfig.loginCustomerId || null);
}

async function authHeaders(ctx: AdsContext): Promise<Record<string, string>> {
  const refresh = ctx.refreshToken ?? adsConfig.refreshToken;
  if (!refresh) {
    throw new Error("Aucun refresh_token pour ce compte. Renseigne GOOGLE_ADS_REFRESH_TOKEN ou connecte le compte via OAuth.");
  }
  const token = await getAccessToken(refresh);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": adsConfig.developerToken,
    "Content-Type": "application/json",
  };
  const login = await loginFor(ctx);
  if (login) headers["login-customer-id"] = login;
  return headers;
}

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
  const clientsOf = async (manager: string, source: "mcc" | "direct"): Promise<ManagedAccount[]> => {
    const rows = await search(
      { customerId: manager, refreshToken, loginCustomerId: manager },
      `SELECT customer_client.id, customer_client.descriptive_name,
              customer_client.currency_code, customer_client.manager,
              customer_client.level, customer_client.status
       FROM customer_client
       WHERE customer_client.status = 'ENABLED'`,
    );
    return rows
      .map((r) => r.customerClient!)
      .filter((c) => c && !c.manager) // on ne garde que les comptes clients
      .map((c) => ({
        customerId: String(c.id),
        name: c.descriptiveName ?? `Compte ${c.id}`,
        currencyCode: c.currencyCode ?? null,
        isManager: false,
        source,
        loginId: manager,
      }));
  };

  const accounts: ManagedAccount[] = await clientsOf(mcc, "mcc");
  const known = new Set(accounts.map((a) => a.customerId));

  // Comptes en accès direct (le client a ajouté ton email Google sans passer par le MCC),
  // et autres MCC accessibles. Une erreur ici ne bloque jamais la liste du MCC.
  try {
    const ids = await listAccessibleCustomerIds(refreshToken ?? adsConfig.refreshToken);
    for (const id of ids) {
      if (id === mcc || known.has(id)) continue;
      try {
        const info = await search({ customerId: id, refreshToken, loginCustomerId: id },
          `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager, customer.status FROM customer LIMIT 1`);
        const c = (info[0] as RawRow | undefined)?.customer;
        if (!c || c.status === "CANCELED" || c.status === "CLOSED") continue;
        if (c.manager) {
          for (const sub of await clientsOf(id, "direct")) {
            if (!known.has(sub.customerId)) { accounts.push(sub); known.add(sub.customerId); }
          }
        } else {
          accounts.push({ customerId: id, name: c.descriptiveName ?? `Compte ${id}`, currencyCode: c.currencyCode ?? null, isManager: false, source: "direct", loginId: id });
          known.add(id);
        }
      } catch { /* compte inaccessible (suspendu, droits insuffisants) : ignoré */ }
    }
  } catch { /* listAccessibleCustomers indisponible : on garde le MCC */ }

  accounts.forEach((a) => { if (a.loginId) loginMap.set(a.customerId, a.loginId); });

  // Repli : si rien n'est listable, on expose au moins le compte courant.
  const result = accounts.length
    ? accounts
    : [{ customerId: adsConfig.customerId, name: `Compte ${adsConfig.customerId}`, currencyCode: null, isManager: false }];

  managedCache = { accounts: result, exp: Date.now() + 5 * 60_000 };
  return result;
}

/** Liste les IDs de comptes accessibles avec un refresh token (post-OAuth). */
export async function listAccessibleCustomerIds(
  refreshToken: string | null | undefined,
): Promise<string[]> {
  assertLiveConfig();
  if (!refreshToken) return [];
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

export interface FullSearchTermRow {
  campaignId: string;
  campaignName: string;
  term: string;
  clicks: number;
  cost: number;
  conversions: number;
}

/** Tous les termes de recherche ayant reçu au moins 1 clic (Waste Detector). */
export async function getAllSearchTerms(
  ctx: AdsContext,
  range: DateRange,
): Promise<FullSearchTermRow[]> {
  if (!isLive()) return MOCK_SEARCH_TERMS;
  const { since, until } = normalizeRange(range);
  const rows = await search(
    ctx,
    `SELECT campaign.id, campaign.name, search_term_view.search_term,
            metrics.clicks, metrics.cost_micros, metrics.conversions
     FROM search_term_view
     WHERE segments.date BETWEEN '${since}' AND '${until}'
       AND campaign.status != 'REMOVED'
       AND metrics.clicks > 0`,
  );
  return rows.map((r) => ({
    campaignId: String(r.campaign?.id ?? ""),
    campaignName: r.campaign?.name ?? "",
    term: r.searchTermView?.searchTerm ?? "",
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
// Lecture des annonces (RSA) : textes, pinning, ad strength, validation
// ---------------------------------------------------------------------------

export interface AdTextAsset {
  text: string;
  /** "HEADLINE_1", "DESCRIPTION_2"… ou null si non épinglé. */
  pinnedField: string | null;
}

export interface AdRow {
  adId: string;
  adType: string;
  status: string;
  adStrength: string;
  approvalStatus: string;
  campaignId: string;
  campaignName: string;
  adGroupName: string;
  headlines: AdTextAsset[];
  descriptions: AdTextAsset[];
  path1: string;
  path2: string;
  finalUrls: string[];
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

const MOCK_ADS: AdRow[] = [
  {
    adId: "700000000001",
    adType: "RESPONSIVE_SEARCH_AD",
    status: "ENABLED",
    adStrength: "GOOD",
    approvalStatus: "APPROVED",
    campaignId: "100000001",
    campaignName: "Démo — Search",
    adGroupName: "Démo — Groupe 1",
    headlines: [
      { text: "Devis gratuit sous 48h", pinnedField: "HEADLINE_1" },
      { text: "Artisan local certifié", pinnedField: null },
      { text: "Intervention rapide", pinnedField: null },
    ],
    descriptions: [
      { text: "Un expert vous rappelle sous 24h. Devis détaillé et sans engagement.", pinnedField: null },
      { text: "Garantie décennale. Plus de 500 chantiers réalisés dans le Var.", pinnedField: null },
    ],
    path1: "devis",
    path2: "gratuit",
    finalUrls: ["https://example.com"],
    impressions: 1200,
    clicks: 84,
    cost: 96.4,
    conversions: 6,
  },
];

/**
 * Liste les annonces d'un compte avec leur contenu et leurs perfs sur la période.
 * Deux requêtes : le contenu (toutes les annonces non supprimées, même sans
 * impression) puis les métriques, fusionnées par ID d'annonce. Une seule requête
 * avec segments.date masquerait les annonces sans diffusion sur la période.
 */
export async function listAds(
  ctx: AdsContext,
  range: DateRange,
  campaignId?: string,
): Promise<AdRow[]> {
  if (!isLive()) {
    return campaignId ? MOCK_ADS.filter((a) => a.campaignId === campaignId) : MOCK_ADS;
  }
  const { since, until } = normalizeRange(range);
  const campaignFilter = campaignId ? ` AND campaign.id = ${Number(campaignId)}` : "";

  const contentRows = await search(
    ctx,
    `SELECT ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.status,
            ad_group_ad.ad_strength, ad_group_ad.policy_summary.approval_status,
            ad_group_ad.ad.responsive_search_ad.headlines,
            ad_group_ad.ad.responsive_search_ad.descriptions,
            ad_group_ad.ad.responsive_search_ad.path1,
            ad_group_ad.ad.responsive_search_ad.path2,
            ad_group_ad.ad.final_urls,
            ad_group.name, campaign.id, campaign.name
     FROM ad_group_ad
     WHERE ad_group_ad.status != 'REMOVED'
       AND campaign.status != 'REMOVED'${campaignFilter}`,
  );

  const metricRows = await search(
    ctx,
    `SELECT ad_group_ad.ad.id, metrics.impressions, metrics.clicks,
            metrics.cost_micros, metrics.conversions
     FROM ad_group_ad
     WHERE segments.date BETWEEN '${since}' AND '${until}'
       AND ad_group_ad.status != 'REMOVED'
       AND campaign.status != 'REMOVED'${campaignFilter}`,
  );
  const metricsById = new Map<string, NonNullable<GaqlRow["metrics"]>>();
  for (const r of metricRows) {
    const id = String(r.adGroupAd?.ad?.id ?? "");
    if (id && r.metrics) metricsById.set(id, r.metrics);
  }

  const toAssets = (list?: { text?: string; pinnedField?: string }[]): AdTextAsset[] =>
    (list ?? []).map((a) => ({
      text: a.text ?? "",
      pinnedField: a.pinnedField && a.pinnedField !== "UNSPECIFIED" ? a.pinnedField : null,
    }));

  return contentRows
    .map((r) => {
      const aga = r.adGroupAd ?? {};
      const ad = aga.ad ?? {};
      const rsa = ad.responsiveSearchAd ?? {};
      const id = String(ad.id ?? "");
      const m = metricsById.get(id);
      return {
        adId: id,
        adType: String(ad.type ?? "UNKNOWN"),
        status: String(aga.status ?? ""),
        adStrength: String(aga.adStrength ?? "UNSPECIFIED"),
        approvalStatus: String(aga.policySummary?.approvalStatus ?? "UNKNOWN"),
        campaignId: String(r.campaign?.id ?? ""),
        campaignName: r.campaign?.name ?? "",
        adGroupName: r.adGroup?.name ?? "",
        headlines: toAssets(rsa.headlines),
        descriptions: toAssets(rsa.descriptions),
        path1: rsa.path1 ?? "",
        path2: rsa.path2 ?? "",
        finalUrls: ad.finalUrls ?? [],
        impressions: Number(m?.impressions ?? 0),
        clicks: Number(m?.clicks ?? 0),
        cost: micros(m?.costMicros),
        conversions: Number(m?.conversions ?? 0),
      };
    })
    .sort((a, b) => b.cost - a.cost);
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

/**
 * POST générique sur l'API (hors search/mutate de ressource) : planificateur de
 * mots-clés, suggestions de lieux, googleAds:mutate atomique. `path` est relatif
 * à la version, ex. « customers/123:generateKeywordIdeas ».
 */
export async function adsPost(ctx: { customerId?: string; refreshToken?: string | null } | null, path: string, body: unknown): Promise<RawRow> {
  assertLiveConfig();
  const headers = await authHeaders(ctx?.customerId
    ? { customerId: ctx.customerId, refreshToken: ctx.refreshToken }
    : { customerId: adsConfig.loginCustomerId || adsConfig.customerId, refreshToken: ctx?.refreshToken, loginCustomerId: adsConfig.loginCustomerId || null });
  const res = await fetch(`https://googleads.googleapis.com/${adsConfig.apiVersion}/${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const j = await res.json();
  if (!res.ok) throw new Error(gaError(j));
  return j;
}

/** Mutate générique (corrections en un clic) : renvoie les resource_name créés ou modifiés. */
export async function mutateRaw(
  ctx: AdsContext,
  resource: "campaignCriteria" | "adGroupCriteria" | "campaigns",
  operations: unknown[],
): Promise<string[]> {
  const j = await mutate(ctx, resource, operations);
  return ((j?.results ?? []) as { resourceName?: string }[]).map((r) => r.resourceName ?? "");
}

/** POST bas niveau vers un endpoint :mutate. */
async function mutate(
  ctx: AdsContext,
  resource: string,
  operations: unknown[],
): Promise<{ results?: unknown[] }> {
  assertLiveConfig();
  const headers = await authHeaders(ctx);

  const res = await fetch(
    `https://googleads.googleapis.com/${adsConfig.apiVersion}/customers/${ctx.customerId}/${resource}:mutate`,
    { method: "POST", headers, body: JSON.stringify({ operations }) },
  );
  const j = await res.json();
  if (!res.ok) throw new Error(gaError(j));
  return j;
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
  adGroupAd?: {
    status?: string;
    adStrength?: string;
    policySummary?: { approvalStatus?: string };
    ad?: {
      id?: string;
      type?: string;
      finalUrls?: string[];
      responsiveSearchAd?: {
        headlines?: { text?: string; pinnedField?: string }[];
        descriptions?: { text?: string; pinnedField?: string }[];
        path1?: string;
        path2?: string;
      };
    };
  };
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

/** Ligne GAQL brute (champs en camelCase, tels que renvoyés par l'API REST). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawRow = Record<string, any>;

/** Requête GAQL libre, pour les modules d'analyse (diagnostic). Live uniquement. */
export async function searchRaw(ctx: AdsContext, query: string): Promise<RawRow[]> {
  return (await search(ctx, query)) as unknown as RawRow[];
}

/** Exécute une requête GAQL (googleAds:search) avec pagination. */
async function search(ctx: AdsContext, query: string): Promise<GaqlRow[]> {
  assertLiveConfig();
  // login-customer-id = MCC pour ses clients, le compte lui-même en accès direct.
  const headers = await authHeaders(ctx);

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

// ---------------------------------------------------------------------------
// Comptes : synchronisation et invitations depuis le MCC
// ---------------------------------------------------------------------------

/** Vide le cache de la liste des comptes (bouton « Synchroniser »). */
export function clearManagedCache() {
  managedCache = null;
}

/** Envoie une demande d'association MCC -> compte client. Le client l'accepte dans son Google Ads. */
export async function inviteClientAccount(clientId: string): Promise<string> {
  assertLiveConfig();
  const mcc = adsConfig.loginCustomerId || adsConfig.customerId;
  const id = clientId.replace(/\D/g, "");
  const j = await adsPost(null, `customers/${mcc}/customerClientLinks:mutate`, {
    operation: { create: { clientCustomer: `customers/${id}`, status: "PENDING" } },
  });
  return String((j as { result?: { resourceName?: string } }).result?.resourceName ?? "");
}

/** Invitations envoyées par le MCC et pas encore acceptées. */
export async function listPendingInvites(): Promise<{ customerId: string; status: string }[]> {
  if (!isLive()) return [];
  const mcc = adsConfig.loginCustomerId || adsConfig.customerId;
  const rows = await search({ customerId: mcc, loginCustomerId: mcc },
    `SELECT customer_client_link.client_customer, customer_client_link.status FROM customer_client_link WHERE customer_client_link.status = 'PENDING'`);
  return (rows as unknown as RawRow[]).map((r) => {
    const l = (r as { customerClientLink?: { clientCustomer?: string; status?: string } }).customerClientLink ?? {};
    return { customerId: String(l.clientCustomer ?? "").split("/")[1] ?? "", status: String(l.status ?? "") };
  }).filter((x) => x.customerId);
}
