import { scConfig, isScLive } from "./config";
import { MOCK_SITES, getMockData } from "./mock-data";
import { getOAuthToken } from "@/lib/oauth-store";

export interface ScSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface ScRow {
  query?: string;
  page?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export type ScDimension = "query" | "page" | "country" | "device";

const tokenCache = new Map<string, { token: string; exp: number }>();

async function resolveRefreshToken(workspaceToken: string): Promise<string> {
  // 1. Token OAuth stocké en base pour ce workspace
  if (workspaceToken) {
    const fromDb = await getOAuthToken(workspaceToken, "gsc");
    if (fromDb) return fromDb;
  }
  // 2. Fallback env : UNIQUEMENT pour le compte owner (token partagé).
  //    Jamais pour un client SaaS — il ne doit pas voir les sites de l'owner.
  const isOwner = !!workspaceToken && workspaceToken === process.env.MCP_SHARED_TOKEN;
  if (isOwner && scConfig.refreshToken) return scConfig.refreshToken;

  throw new Error(
    "Search Console non connecté. Connecte ton compte depuis la page Connexions.",
  );
}

async function getAccessToken(workspaceToken: string): Promise<string> {
  const rt = await resolveRefreshToken(workspaceToken);
  const cached = tokenCache.get(rt);
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: scConfig.oauthClientId,
      client_secret: scConfig.oauthClientSecret,
      refresh_token: rt,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token)
    throw new Error(`OAuth Search Console : ${j.error_description ?? j.error ?? res.status}`);

  tokenCache.set(rt, {
    token: j.access_token,
    exp: Date.now() + (Number(j.expires_in ?? 3600) - 60) * 1000,
  });
  return j.access_token;
}

export async function listSites(workspaceToken = ""): Promise<ScSite[]> {
  if (!isScLive()) return MOCK_SITES;
  const token = await getAccessToken(workspaceToken);
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Search Console : ${j.error?.message ?? res.status}`);
  return (j.siteEntry ?? []) as ScSite[];
}

export async function queryPerformance(
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: ScDimension[],
  rowLimit = 25,
  workspaceToken = "",
): Promise<ScRow[]> {
  if (!isScLive()) {
    const dim = dimensions.includes("page") ? "page" : "query";
    return getMockData(siteUrl, dim, rowLimit);
  }
  const token = await getAccessToken(workspaceToken);
  const encoded = encodeURIComponent(siteUrl);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions, rowLimit }),
    },
  );
  const j = await res.json();
  if (!res.ok) throw new Error(`Search Console : ${j.error?.message ?? res.status}`);
  return (j.rows ?? []).map((r: {
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }) => ({
    [dimensions[0]]: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

export function dateRange(days: number): { startDate: string; endDate: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return { startDate: fmt(start), endDate: fmt(end) };
}
