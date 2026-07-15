export type ScMode = "mock" | "live";

export const scConfig = {
  mode: (process.env.SEARCH_CONSOLE_DATA_MODE ?? "mock") as ScMode,
  // Réutilise les mêmes credentials OAuth que Google Ads.
  // Si un refresh token dédié est fourni, il prend le dessus.
  refreshToken:
    process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN ||
    process.env.GOOGLE_ADS_REFRESH_TOKEN ||
    "",
  oauthClientId: process.env.GOOGLE_ADS_OAUTH_CLIENT_ID ?? "",
  oauthClientSecret: process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET ?? "",
} as const;

export const isScLive = () => scConfig.mode === "live";
