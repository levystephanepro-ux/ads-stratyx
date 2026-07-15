import { createClient } from "@supabase/supabase-js";

function ready(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function getOAuthToken(workspaceToken: string, service: string): Promise<string | null> {
  if (!ready()) return null;
  try {
    const { data } = await admin()
      .from("oauth_tokens")
      .select("refresh_token")
      .eq("workspace_token", workspaceToken)
      .eq("service", service)
      .maybeSingle();
    return data?.refresh_token ?? null;
  } catch {
    return null;
  }
}

export async function setOAuthToken(
  workspaceToken: string,
  service: string,
  refreshToken: string,
  email?: string,
): Promise<void> {
  await admin()
    .from("oauth_tokens")
    .upsert({
      workspace_token: workspaceToken,
      service,
      refresh_token: refreshToken,
      account_email: email ?? null,
      updated_at: new Date().toISOString(),
    });
}

export async function deleteOAuthToken(workspaceToken: string, service: string): Promise<void> {
  await admin()
    .from("oauth_tokens")
    .delete()
    .eq("workspace_token", workspaceToken)
    .eq("service", service);
}

export async function getOAuthMeta(
  workspaceToken: string,
  service: string,
): Promise<{ email: string | null } | null> {
  if (!ready()) return null;
  try {
    const { data } = await admin()
      .from("oauth_tokens")
      .select("account_email")
      .eq("workspace_token", workspaceToken)
      .eq("service", service)
      .maybeSingle();
    if (!data) return null;
    return { email: data.account_email ?? null };
  } catch {
    return null;
  }
}
