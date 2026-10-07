// Diagnostic et alertes du matin (Vercel Cron, voir vercel.json).
// Aucun appel IA : 0 crédit consommé. Email seulement s'il y a quelque chose d'important.
import { NextResponse } from "next/server";
import { runAuditForOwner } from "@/lib/audit/run";
import { sendAgentEmail } from "@/lib/agent/email";
import { runAlertsForOwner, alertsMarkdown, type AlertsRun } from "@/lib/alerts/run";
import { healthChecks, saveHealthSummary } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // plusieurs comptes clients (Fluid compute)

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const empty: AlertsRun = { ranAt: new Date().toISOString(), accounts: [] };
  const [r, alerts] = await Promise.all([runAuditForOwner(), runAlertsForOwner().catch(() => empty)]);
  const nAlerts = alerts.accounts.reduce((n, a) => n + a.alerts.length, 0);

  let email = "rien d'important";
  if (r.needsAttention || nAlerts > 0) {
    const worst = Math.min(...r.accounts.map((a) => a.result?.healthScore ?? 100));
    const subject = nAlerts
      ? `🚨 ${nAlerts} alerte(s) · diagnostic du matin, santé mini ${worst}/100`
      : `☀️ Diagnostic du matin · santé mini ${worst}/100`;
    try {
      await sendAgentEmail(subject, [alertsMarkdown(alerts), r.markdown].filter(Boolean).join("\n\n"));
      email = "envoyé";
    } catch (e) {
      email = `non envoyé : ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // Bilan de santé du jour (lecture seule) : alimente le témoin vert/rouge du menu.
  let health = "non lancé";
  try {
    const sum = await saveHealthSummary(await healthChecks());
    health = sum.fail ? `${sum.fail} échec(s)` : "ok";
  } catch (e) {
    health = `erreur : ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    email,
    health,
    alerts: alerts.accounts.map((a) => ({ name: a.name, alerts: a.alerts.map((x) => x.title), errors: a.errors })),
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
