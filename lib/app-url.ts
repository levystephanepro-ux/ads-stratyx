// URL publique de l'application (ads-stratyx), jamais celle du site vitrine (stratyxmedia.fr, hébergé chez OVH).
// Résolue dans l'ordre :
//   1. NEXT_PUBLIC_APP_URL, la variable dédiée à l'application (ex. https://app.stratyxmedia.fr)
//   2. https://${VERCEL_URL}, fournie par Vercel à chaque déploiement
//   3. l'hôte de la requête en cours, quand l'appelant la fournit
//   4. http://localhost:3000 (développement local)
// Une valeur qui pointe vers le site vitrine est ignorée à chaque étape : un lien du type {base}/clients/{id} ne doit
// jamais y mener (« Not Found »). Sert aux liens des e-mails, à l'URL MCP affichée et aux redirections OAuth.
// Module pur (aucun import) : les entrées sont passées en paramètre, voir lib/app-url.test.ts.

/** Hôtes du site vitrine : jamais utilisés comme base de l'application. */
export const HOTES_VITRINE: readonly string[] = ["stratyxmedia.fr", "www.stratyxmedia.fr"];

/** Origine propre (schéma, hôte, port) d'une valeur d'URL ou d'hôte, ou null si elle est vide, invalide ou vers le site vitrine. */
export function origineApplication(valeur: string | null | undefined): string | null {
  const v = (valeur ?? "").trim();
  if (!v) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (HOTES_VITRINE.includes(u.hostname.toLowerCase())) return null;
  return u.origin;
}

export interface EntreeBase {
  /** Valeur de NEXT_PUBLIC_APP_URL. */
  appUrl?: string | null;
  /** Valeur de VERCEL_URL (hôte sans schéma). */
  vercelUrl?: string | null;
  /** Hôte de la requête en cours (en-tête x-forwarded-host ou host). */
  hoteRequete?: string | null;
  /** Schéma de la requête (en-tête x-forwarded-proto). */
  protoRequete?: string | null;
}

/** Base de l'application, sans barre finale. */
export function baseApplication(e: EntreeBase = {}): string {
  const deVercel = origineApplication(e.vercelUrl);
  let deRequete: string | null = null;
  // Un hôte est attendu ; on tolère un schéma ou un chemin accidentel.
  const hote = (e.hoteRequete ?? "").split(",")[0].trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/.*$/, "");
  if (hote) {
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(hote);
    const proto = e.protoRequete === "http" || e.protoRequete === "https" ? e.protoRequete : local ? "http" : "https";
    deRequete = origineApplication(`${proto}://${hote}`);
  }
  return origineApplication(e.appUrl) ?? deVercel ?? deRequete ?? "http://localhost:3000";
}

/** Lien absolu vers une page de l'application : {base}{chemin}. */
export function lienApplication(chemin: string, e: EntreeBase = {}): string {
  return `${baseApplication(e)}${chemin.startsWith("/") ? chemin : `/${chemin}`}`;
}

/** Entrées de la requête en cours (hôte et schéma), pour le repli sur l'hôte de la requête. */
export function entreeDepuisRequete(req: { headers: { get(nom: string): string | null } } | null | undefined): EntreeBase {
  if (!req) return {};
  return {
    hoteRequete: req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
    protoRequete: req.headers.get("x-forwarded-proto"),
  };
}

/** Base de l'application d'après l'environnement du serveur. */
export function getAppUrl(req?: { headers: { get(nom: string): string | null } } | null): string {
  return baseApplication({
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    vercelUrl: process.env.VERCEL_URL,
    ...entreeDepuisRequete(req),
  });
}

/** Lien vers la fiche d'un client : {base}/clients/{id}. */
export function lienFicheClient(id: string, req?: { headers: { get(nom: string): string | null } } | null): string {
  return `${getAppUrl(req)}/clients/${encodeURIComponent(id)}`;
}
