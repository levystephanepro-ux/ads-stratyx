// SEULE source de vérité pour la config Google Ads.
//
// Le bug vu chez le concurrent ("Version v20 is deprecated. Requests will be
// blocked") vient d'une version d'API codée en dur. Ici, la version vit dans UNE
// variable d'environnement. Le jour où Google déprécie une version, on met à jour
// GOOGLE_ADS_API_VERSION dans .env — aucun changement de code.
//
// Versions supportées : https://developers.google.com/google-ads/api/docs/release-notes

export type AdsDataMode = "mock" | "live";

export const adsConfig = {
  /** "mock" = données factices (aucun accès requis) · "live" = vrais appels API. */
  mode: (process.env.ADS_DATA_MODE as AdsDataMode) ?? "mock",

  /** Version de l'API Google Ads, ex. "v21". Jamais codée ailleurs. */
  apiVersion: process.env.GOOGLE_ADS_API_VERSION ?? "v21",

  developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
  oauthClientId: process.env.GOOGLE_ADS_OAUTH_CLIENT_ID ?? "",
  oauthClientSecret: process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET ?? "",
  loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "",

  // Raccourci "single-user" pour tester en live SANS Supabase : un refresh token
  // et un customer_id posés en .env suffisent à interroger un vrai compte.
  refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
  customerId: process.env.GOOGLE_ADS_CUSTOMER_ID ?? "",
} as const;

/** Y a-t-il un compte "single-user" configuré en env (refresh token + customer id) ? */
export function hasEnvAccount(): boolean {
  return !!adsConfig.refreshToken && !!adsConfig.customerId;
}

export function isLive(): boolean {
  return adsConfig.mode === "live";
}

/** Vérifie que tout est présent pour des appels réels. Utile avant de passer en live. */
export function assertLiveConfig(): void {
  if (!isLive()) return;
  const missing = (
    ["developerToken", "oauthClientId", "oauthClientSecret"] as const
  ).filter((k) => !adsConfig[k]);
  if (missing.length) {
    throw new Error(
      `Mode live activé mais config Google Ads incomplète : ${missing.join(", ")}`,
    );
  }
}
