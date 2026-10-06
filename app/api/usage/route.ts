import { NextResponse } from "next/server";
import { getMonthlyUsage } from "@/lib/agent/cost";
import { getDashboardContext } from "@/lib/workspace";
import { planLimits, usdToCredits } from "@/lib/plans";
import { ownerMonthlyBudgetUsd } from "@/lib/internal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const ctx = await getDashboardContext();
    if (ctx.configured && !ctx.authed) {
      return NextResponse.json({ error: "non connecté" }, { status: 401 });
    }

    const u = await getMonthlyUsage(ctx.workspaceId);
    const limits = planLimits(ctx.plan);

    // Owner : pas de quota de plan, mais le plafond interne en euros.
    // Dépense = espace de travail + appels sans espace (cron, rapport du lundi).
    if (ctx.isOwner) {
      const global = ctx.workspaceId ? (await getMonthlyUsage(null)).spent : 0;
      const rate = Number((process.env.EUR_TO_USD ?? "1.15").replace(",", ".")) || 1.15;
      const spentUsd = u.spent + global;
      return NextResponse.json({
        owner: true,
        spentEur: Math.round((spentUsd / rate) * 100) / 100,
        capEur: Math.round((ownerMonthlyBudgetUsd() / rate) * 100) / 100,
        spentCredits: usdToCredits(spentUsd),
        totalCredits: usdToCredits(ownerMonthlyBudgetUsd()),
        resetDate: u.resetDate.toISOString(),
      });
    }

    return NextResponse.json({
      spent: u.spent,
      spentAgent: u.spentAgent,
      spentCopilote: u.spentCopilote,
      budget: limits.monthlyBudgetUsd,
      spentCredits: usdToCredits(u.spent),
      totalCredits: usdToCredits(limits.monthlyBudgetUsd),
      resetDate: u.resetDate.toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}