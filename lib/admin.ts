// Données de la page Admin (owner uniquement) : vue d'ensemble des clients,
// leur plan, leur consommation IA du mois et leurs comptes Google Ads reliés.
// Remplace les requêtes SQL manuelles dans Supabase.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getMonthlyUsage } from "@/lib/agent/cost";
import { planLimits, usdToCredits, PLANS, type PlanId } from "@/lib/plans";
import { isOwnerEmail } from "@/lib/owner";

// Client admin non typé : accède aussi aux tables absentes de database.types.ts.
function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface AdminClientRow {
  userId: string;
  workspaceId: string | null;
  email: string;
  plan: string;
  status: string; // trialing | active | past_due | canceled | none
  trialDaysLeft: number | null;
  spentUsd: number;
  spentCredits: number;
  totalCredits: number;
  agentCount: number;
  connections: { customerId: string; name: string }[];
  defaultCustomerId: string | null;
  isOwner: boolean;
  createdAt: string;
}

export interface AdminSummary {
  clients: number;
  actifs: number;
  essais: number;
  revenueEur: number; // somme des plans actifs (hors owner)
  apiCostUsd: number; // coût API total du mois (tous workspaces + global)
}

export async function listClients(): Promise<{
  rows: AdminClientRow[];
  summary: AdminSummary;
}> {
  const a = admin();

  const [{ data: usersData }, wss, subs, conns, tasks, settings] =
    await Promise.all([
      a.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      a.from("workspaces").select("id, owner_id"),
      a.from("subscriptions").select("user_id, plan, status, trial_ends_at"),
      a.from("google_ads_connections").select("workspace_id, customer_id, descriptive_name"),
      a.from("agent_tasks").select("id, workspace_id"),
      a.from("app_settings").select("key, value, workspace_id").eq("key", "default_customer_id"),
    ]);

  const users = usersData?.users ?? [];
  const rows: AdminClientRow[] = [];

  for (const u of users) {
    const ws = (wss.data ?? []).find((w) => w.owner_id === u.id) ?? null;
    const sub = (subs.data ?? []).find((s) => s.user_id === u.id) ?? null;
    const owner = isOwnerEmail(u.email);

    const status = sub?.status ?? "none";
    const plan = sub?.plan ?? "pro";
    let trialDaysLeft: number | null = null;
    if (status === "trialing" && sub?.trial_ends_at) {
      const diff = new Date(sub.trial_ends_at).getTime() - Date.now();
      trialDaysLeft = Math.max(0, Math.ceil(diff / 86_400_000));
    }

    const usage = ws ? await getMonthlyUsage(ws.id) : { spent: 0 };
    const connections = (conns.data ?? [])
      .filter((c) => c.workspace_id === ws?.id)
      .map((c) => ({
        customerId: c.customer_id as string,
        name: (c.descriptive_name as string | null) ?? (c.customer_id as string),
      }));

    rows.push({
      userId: u.id,
      workspaceId: ws?.id ?? null,
      email: u.email ?? "(sans email)",
      plan,
      status,
      trialDaysLeft,
      spentUsd: usage.spent,
      spentCredits: usdToCredits(usage.spent),
      totalCredits: usdToCredits(planLimits(plan).monthlyBudgetUsd),
      agentCount: (tasks.data ?? []).filter((t) => t.workspace_id === ws?.id).length,
      connections,
      defaultCustomerId:
        ((settings.data ?? []).find((s) => s.workspace_id === ws?.id)
          ?.value as string | undefined) ?? null,
      isOwner: owner,
      createdAt: u.created_at,
    });
  }

  // Owner en dernier, puis clients les plus récents en premier.
  rows.sort((x, y) => {
    if (x.isOwner !== y.isOwner) return x.isOwner ? 1 : -1;
    return y.createdAt.localeCompare(x.createdAt);
  });

  const clientRows = rows.filter((r) => !r.isOwner);
  const globalUsage = await getMonthlyUsage(null);
  const summary: AdminSummary = {
    clients: clientRows.length,
    actifs: clientRows.filter((r) => r.status === "active").length,
    essais: clientRows.filter(
      (r) => r.status === "trialing" && (r.trialDaysLeft ?? 0) > 0,
    ).length,
    revenueEur: clientRows
      .filter((r) => r.status === "active")
      .reduce((sum, r) => sum + (PLANS[r.plan as PlanId]?.priceEur ?? 0), 0),
    apiCostUsd:
      rows.reduce((sum, r) => sum + r.spentUsd, 0) + globalUsage.spent,
  };

  return { rows, summary };
}
