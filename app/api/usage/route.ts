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
    const limits = planLimits(ctx.plan);

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