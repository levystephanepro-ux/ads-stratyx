// Résolution du workspace à partir du token MCP présenté par Claude.
// Le token peut arriver de deux façons (on accepte les deux) :
//   - en-tête   Authorization: Bearer <token>
//   - paramètre d'URL  ?token=<token>
// Cela permet à Claude Desktop d'utiliser "une seule URL" contenant le token.
import { createAdminClient } from "@/lib/supabase/admin";
import { adsConfig, isLive, hasEnvAccount } from "@/lib/google-ads/config";
import { getSetting } from "@/lib/agent/store";

export interface WorkspaceConnection {
  customerId: string;
  descriptiveName: string | null;
  currencyCode: string | null;
  timeZone: string | null;
  refreshToken: string | null;
  isDefault: boolean;
}

export interface WorkspaceContext {
  workspaceId: string;
  connections: WorkspaceConnection[];
  /** true quand on sert des données de démo sans token valide (mock uniquement). */
  demo: boolean;
}

/** Extrait le token de la requête (header Bearer prioritaire, sinon ?token=). */
export function extractToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const url = new URL(req.url);
  return url.searchParams.get("token");
}

/**
 * Résout le contexte workspace. Renvoie null si le token est invalide EN MODE LIVE.
 * En mode mock, un token absent/inconnu bascule sur un contexte de démo pour que
 * l'endpoint soit testable dans Claude sans avoir configuré Supabase.
 */
export async function resolveWorkspace(
  token: string | null,
): Promise<WorkspaceContext | null> {
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (token && supabaseConfigured) {
    const admin = createAdminClient();
    const { data: tok } = await admin
      .from("mcp_tokens")
      .select("workspace_id")
      .eq("token", token)
      .maybeSingle();

    if (tok) {
      // Trace de dernière utilisation (best-effort).
      await admin
        .from("mcp_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("token", token);

      const { data: conns } = await admin
        .from("google_ads_connections")
        .select(
          "customer_id, descriptive_name, currency_code, time_zone, refresh_token, is_default",
        )
        .eq("workspace_id", tok.workspace_id);

      return {
        workspaceId: tok.workspace_id,
        demo: false,
        connections: (conns ?? []).map((c) => ({
          customerId: c.customer_id,
          descriptiveName: c.descriptive_name,
          currencyCode: c.currency_code,
          timeZone: c.time_zone,
          refreshToken: c.refresh_token,
          isDefault: c.is_default,
        })),
      };
    }
  }

  // Token invalide ou Supabase non configuré.
  if (isLive()) {
    // Raccourci "single-user" : compte réel défini en .env (refresh token +
    // customer id). Permet de tester le live sans avoir monté Supabase.
    if (hasEnvAccount()) {
      // Sécurité exposition publique : si MCP_SHARED_TOKEN est défini, le token
      // présenté par Claude DOIT correspondre. Sinon (dev local), on laisse passer.
      const shared = process.env.MCP_SHARED_TOKEN;
      if (shared && token !== shared) return null;
      // Compte ciblé par défaut : réglage choisi dans "Connexions" s'il existe,
      // sinon le compte défini en env. Tous sous le même MCC (même refresh token).
      const defaultCustomer =
        (await getSetting("default_customer_id")) || adsConfig.customerId;
      return {
        workspaceId: "env",
        demo: false,
        connections: [
          {
            customerId: defaultCustomer,
            descriptiveName: null,
            currencyCode: null,
            timeZone: null,
            refreshToken: adsConfig.refreshToken,
            isDefault: true,
          },
        ],
      };
    }
    return null; // en live sans compte env ni token reconnu, on refuse.
  }

  // Mode mock : contexte de démo (données factices via la façade google-ads).
  return { workspaceId: "demo", demo: true, connections: [] };
}
