// Vérifie le token présenté sur les routes API internes (en-tête `x-app-token`).
// Deux tokens valides :
//   - MCP_SHARED_TOKEN (mode mono-compte / owner)
//   - un token workspace présent dans la table mcp_tokens (clients SaaS)
// Si MCP_SHARED_TOKEN n'est pas défini (dev local), on laisse passer.
import { createClient } from "@supabase/supabase-js";

function supabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function tokenValueOk(presented: string | null | undefined): Promise<boolean> {
  const required = process.env.MCP_SHARED_TOKEN;
  if (!required) return true;

  if (!presented) return false;
  if (presented === required) return true;

  // Token workspace (client SaaS) : vérifie en base.
  if (!supabaseConfigured()) return false;
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await admin
      .from("mcp_tokens")
      .select("id")
      .eq("token", presented)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export async function tokenOk(req: Request): Promise<boolean> {
  return tokenValueOk(req.headers.get("x-app-token"));
}

/** Le token présenté est-il celui du propriétaire (MCP_SHARED_TOKEN) ?
 *  Sert à réserver certaines actions (ex. édition des templates partagés).
 *  Sans MCP_SHARED_TOKEN défini (dev local), tout le monde est "owner". */
export function isOwnerToken(presented: string | null | undefined): boolean {
  const required = process.env.MCP_SHARED_TOKEN;
  if (!required) return true;
  return presented === required;
}

/** Retourne le workspace_id associé au token présenté (null si non trouvé). */
export async function getWorkspaceIdFromValue(
  token: string | null | undefined,
): Promise<string | null> {
  if (!token || !supabaseConfigured()) return null;
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await admin
      .from("mcp_tokens")
      .select("workspace_id")
      .eq("token", token)
      .maybeSingle();
    return (data?.workspace_id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Idem, depuis l'en-tête `x-app-token` de la requête. */
export async function getWorkspaceId(req: Request): Promise<string | null> {
  return getWorkspaceIdFromValue(req.headers.get("x-app-token"));
}
