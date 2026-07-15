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
