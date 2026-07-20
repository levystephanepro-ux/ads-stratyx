// Usage IA du mois — scopé au workspace de l'utilisateur connecté (session).
// Le budget affiché est le quota du plan (ou le réglage global pour l'owner
// en mode mono-compte sans workspace).
import { NextResponse } from "next/server";
import { getMonthlyUsage } from "@/lib/agent/cost";
import { getDashboardContext } from "@/lib/workspace";
import { planLimits, usdToCredits } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await getDashboardContext();
    if (ctx.configured && !ctx.authed) {
      return NextResponse.json({ error: "non connecté" }, { status: 401 });
    }
    const u = await getMonthlyUsage(ctx.workspaceId);
    // Owner : pas de plafond (suivi en $ seulement). Client : quota du plan,
    // exposé en crédits pour l'affichage.
    const budget = ctx.isOwner
      ? u.budget
      : ctx.workspaceId
        ? planLimits(ctx.plan).monthlyBudgetUsd
        : u.budget;
    const totalCredits =
      !ctx.isOwner && ctx.workspaceId
        ? usdToCredits(planLimits(ctx.plan).monthlyBudgetUsd)
        : null;
    return NextResponse.json({
      spent: u.spent,
      spentAgent: u.spentAgent,
      spentCopilote: u.spentCopilote,
      budget,
      spentCredits: usdToCredits(u.spent),
      totalCredits,
      resetDate: u.resetDate.toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
