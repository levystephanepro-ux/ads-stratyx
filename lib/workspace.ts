// Helpers serveur pour le dashboard. Centralise la logique "workspace courant" et
// gère la dégradation gracieuse : si Supabase n'est pas configuré, on renvoie un
// contexte de démo (mock) pour que l'app reste utilisable sans aucune config.
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { adsConfig } from "@/lib/google-ads/config";
import { isOwnerEmail } from "@/lib/owner";

export interface DashboardContext {
  configured: boolean; // Supabase présent ?
  authed: boolean; // utilisateur connecté ?
  email: string | null;
  workspaceId: string | null;
  mcpToken: string; // vrai token, ou "demo" en mode mock non configuré
  mode: "mock" | "live";
  connectionsCount: number;
  defaultAccountName: string | null;
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled" | "none";
  isOwner: boolean; // propriétaire de la plateforme (voit tout le MCC)
  plan: string; // "starter" | "pro" (cf. lib/plans.ts)
  trialDaysLeft: number | null; // null si abonnement actif ou pas de trial
  isBlocked: boolean; // trial expiré sans abonnement actif
}

function hasSupabaseEnv(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function newToken(): string {
  return "mcp_" + randomBytes(24).toString("base64url");
}

export async function getDashboardContext(): Promise<DashboardContext> {
  const base: DashboardContext = {
    configured: hasSupabaseEnv(),
    authed: false,
    email: null,
    workspaceId: null,
    mcpToken: process.env.MCP_SHARED_TOKEN || "demo",
    mode: adsConfig.mode,
    connectionsCount: 0,
    defaultAccountName: null,
    subscriptionStatus: "none",
    isOwner: true, // mode démo / non configuré : comportement mono-compte
    plan: "pro",
    trialDaysLeft: null,
    isBlocked: false,
  };

  if (!base.configured) return base; // démo pure, aucune config.

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return base;

  base.authed = true;
  base.email = user.email ?? null;
  base.isOwner = isOwnerEmail(user.email);

  // Sécurité : le repli sur MCP_SHARED_TOKEN (mode mono-compte) est réservé à
  // l'owner. Un client sans workspace ne doit JAMAIS recevoir le token partagé
  // (sinon il voit les connexions GSC/MCP du propriétaire).
  if (!base.isOwner) base.mcpToken = "";

  // Abonnement — avant le check workspace pour que le banner s'affiche toujours
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, plan, trial_ends_at, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (sub) {
    base.subscriptionStatus = sub.status as DashboardContext["subscriptionStatus"];
    base.plan = sub.plan ?? "pro";
    if (sub.status === "trialing" && sub.trial_ends_at) {
      const diff = new Date(sub.trial_ends_at).getTime() - Date.now();
      const days = Math.max(0, Math.ceil(diff / 86_400_000));
      base.trialDaysLeft = days;
      base.isBlocked = days === 0;
    } else if (sub.status === "active") {
      base.isBlocked = false;
    } else {
      base.isBlocked = true;
    }
  }

  // Workspace + token MCP + connexions
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!ws) return base;
  base.workspaceId = ws.id;

  const { data: existing } = await supabase
    .from("mcp_tokens")
    .select("token")
    .eq("workspace_id", ws.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    base.mcpToken = existing.token;
  } else {
    const token = newToken();
    const { error } = await supabase
      .from("mcp_tokens")
      .insert({ workspace_id: ws.id, token, label: "Défaut" });
    if (!error) base.mcpToken = token;
  }

  const { data: conns } = await supabase
    .from("google_ads_connections")
    .select("descriptive_name, is_default")
    .eq("workspace_id", ws.id);
  base.connectionsCount = conns?.length ?? 0;
  base.defaultAccountName =
    conns?.find((c) => c.is_default)?.descriptive_name ??
    conns?.[0]?.descriptive_name ??
    null;

  return base;
}
