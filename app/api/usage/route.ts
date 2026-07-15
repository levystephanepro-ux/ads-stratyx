import { NextResponse } from "next/server";
import { getMonthlyUsage } from "@/lib/agent/cost";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const u = await getMonthlyUsage();
    return NextResponse.json({
      spent: u.spent,
      spentAgent: u.spentAgent,
      spentCopilote: u.spentCopilote,
      budget: u.budget,
      resetDate: u.resetDate.toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
