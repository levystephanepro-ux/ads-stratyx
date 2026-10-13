// Diagnostic et alertes du matin (Vercel Cron, voir vercel.json).
// Aucun appel IA : 0 crédit consommé. Email seulement s'il y a quelque chose d'important.
import { NextResponse } from "next/server";
import { runAuditForOwner } from "@/lib/audit/run";
import { sendAgentEmail } from "@/lib/agent/email";
import { runAlertsForOwner, alertsMarkdown, saveEmailStatus, type AlertsRun } from "@/lib/alerts/run";
import { healthChecks, saveHealthSummary } from "@/lib/health";
import { importCalendly } from "@/lib/clients/calendly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // plusieurs comptes clients (Fluid compute)

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Rendez-vous Calendly pris depuis la veille -> fiches clients (sans webhook :
  // marche sur toutes les offres Calendly). N'empêche jamais le reste de tourner.
  let calendly = "non configuré";
  let calendlyMd = "";
  if (process.env.CALENDLY_TOKEN) {
    try {
      const c = await importCalendly();
      calendly = `${c.events} rdv lus, ${c.created.length} fiche(s) créée(s)`;
      if (c.created.length) calendlyMd = ["# 📅 Nouveaux clients Calendly", "", ...c.created.map((n) => `- **${n}** : fiche créée, à compléter`)].join("\n");
    } catch (e) {
      calendly = `erreur : ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const empty: AlertsRun = { ranAt: new Date().toISOString(), accounts: [] };
  const [r, alerts] = await Promise.all([runAuditForOwner(), runAlertsForOwner().catch(() => empty)]);
  const nAlerts = alerts.accounts.reduce((n, a) => n + a.alerts.length, 0);

  let email = "rien d'important";
  if (r.needsAttention || nAlerts > 0 || calendlyMd) {
    const worst = Math.min(...r.accounts.map((a) => a.result?.healthScore ?? 100));
    const subject = nAlerts
      ? `🚨 ${nAlerts} alerte(s) · diagnostic du matin, santé mini ${worst}/100`
      : calendlyMd && !r.needsAttention ? `📅 Nouveau(x) client(s) Calendly · diagnostic du matin`
      : `☀️ Diagnostic du matin · santé mini ${worst}/100`;
    try {
      await sendAgentEmail(subject, [alertsMarkdown(alerts), calendlyMd, r.markdown].filter(Boolean).join("\n\n"));
      email = "envoyé";
      await saveEmailStatus({ at: new Date().toISOString(), ok: true, detail: `envoyé à ${process.env.AGENT_EMAIL_TO ?? "?"}`, source: "matin" });
    } catch (e) {
      email = `non envoyé : ${e instanceof Error ? e.message : String(e)}`;
      await saveEmailStatus({ at: new Date().toISOString(), ok: false, detail: email, source: "matin" });
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
    calendly,
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
