// Facturation & quotas par workspace.
//
// Répond à la question "ce workspace a-t-il le droit de consommer de l'IA ?" :
//   - abonnement de l'owner (trialing non expiré ou active) ;
//   - dépense API du mois < quota du plan.
// Utilisé par les routes Copilote / Agent (manuel + cron) AVANT chaque appel
// Anthropic, pour que le coût par client reste borné.
import { createAdminClient } from "@/lib/supabase/admin";
import { planLimits, usdToCredits, type PlanLimits } from "@/lib/plans";
import { getMonthlyUsage } from "@/lib/agent/cost";
import { isOwnerEmail } from "@/lib/owner";

export interface WorkspaceBilling {
  plan: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "none";
  limits: PlanLimits;
  spentUsd: number;
  allowed: boolean;
  reason: string | null; // message utilisateur si allowed === false
}

export async function getWorkspaceBilling(
  workspaceId: string,
): Promise<WorkspaceBilling> {
  const admin = createAdminClient();

  const { data: ws } = await admin
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();

  const base = (over: Partial<WorkspaceBilling>): WorkspaceBilling => ({
    plan: "pro",
    status: "none",
    limits: planLimits("pro"),
    spentUsd: 0,
    allowed: false,
    reason: "Abonnement introuvable. Va sur la page Tarif pour l'activer.",
    ...over,
  });

  if (!ws) return base({ reason: "Espace de travail introuvable." });

  // Workspace du propriétaire de la plateforme : pas de quota.
  try {
    const { data: ownerUser } = await admin.auth.admin.getUserById(ws.owner_id);
    if (isOwnerEmail(ownerUser.user?.email)) {
      return base({
        status: "active",
        allowed: true,
        reason: null,
        limits: { ...planLimits("pro"), maxAgents: 999, monthlyBudgetUsd: Infinity },
      });
    }
  } catch {
    // en cas d'échec de lookup, on retombe sur le contrôle standard
  }

  const { data: sub } = await admin
    .from("subscriptions")
    .select("status, plan, trial_ends_at")
    .eq("user_id", ws.owner_id)
    .maybeSingle();

  const status = (sub?.status ?? "none") as WorkspaceBilling["status"];
  const plan = sub?.plan ?? "pro";
  const limits = planLimits(plan);
  const { spent } = await getMonthlyUsage(workspaceId);

  let allowed = false;
  let reason: string | null = null;

  if (status === "active") {
    allowed = true;
  } else if (status === "trialing") {
    const end = sub?.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0;
    allowed = end > Date.now();
    if (!allowed) {
      reason = "Essai gratuit terminé. Passe à un abonnement pour continuer.";
    }
  } else {
    reason = "Abonnement inactif. Va sur la page Tarif pour l'activer.";
  }

  if (allowed && spent >= limits.monthlyBudgetUsd) {
    allowed = false;
    reason =
      `Tes ${usdToCredits(limits.monthlyBudgetUsd)} crédits IA mensuels du plan ` +
      `${limits.label} sont épuisés. Ils se rechargent le 1er du mois — ou passe ` +
      `au plan supérieur.`;
  }

  return { plan, status, limits, spentUsd: spent, allowed, reason };
}

/** Email de l'owner du workspace (destinataire des rapports d'agents). */
export async function getWorkspaceOwnerEmail(
  workspaceId: string,
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: ws } = await admin
      .from("workspaces")
      .select("owner_id")
      .eq("id", workspaceId)
      .maybeSingle();
    if (!ws) return null;
    const { data } = await admin.auth.admin.getUserById(ws.owner_id);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}
