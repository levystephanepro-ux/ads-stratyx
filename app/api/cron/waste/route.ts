// Diagnostic quotidien (Vercel Cron, voir vercel.json).
// Aucun appel IA : 0 crédit consommé. Email seulement s'il y a quelque chose d'important.
import { NextResponse } from "next/server";
import { runAuditForOwner } from "@/lib/audit/run";
import { sendAgentEmail } from "@/lib/agent/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const r = await runAuditForOwner();

  let email = "rien d'important";
  if (r.needsAttention) {
    const worst = Math.min(...r.accounts.map((a) => a.result?.healthScore ?? 100));
    try {
      await sendAgentEmail(`☀️ Diagnostic du matin · santé mini ${worst}/100`, r.markdown);
      email = "envoyé";
    } catch (e) {
      email = `non envoyé : ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    email,
    accounts: r.accounts.map((a) => ({
      customerId: a.customerId,
      name: a.name,
      healthScore: a.result?.healthScore ?? null,
      constats: a.result?.constats.length ?? 0,
      skipped: a.result?.skipped.map((s) => s.check) ?? [],
      error: a.error,
    })),
  });
}
