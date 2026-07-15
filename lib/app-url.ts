// URL publique de l'app, résolue dans l'ordre :
//   1. NEXT_PUBLIC_APP_URL (si tu fixes un domaine précis)
//   2. VERCEL_URL (fournie automatiquement par Vercel à chaque déploiement)
//   3. localhost:3000 (dev local)
// Sert à construire l'URL MCP affichée et les redirections OAuth.
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
