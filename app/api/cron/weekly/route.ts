// Rapport du lundi (Vercel Cron, voir vercel.json) : un compte rendu rédigé par
// l'IA par compte actif, envoyé par email. ~1 crédit par compte.
import { NextResponse } from "next/server";
import { runWeeklyReports } from "@/lib/weekly";
import { sendAgentEmail } from "@/lib/agent/email";
import { buildMetaSection } from "@/lib/meta/report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // plusieurs comptes clients (Fluid compute)

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await runWeeklyReports();
  const done = results.filter((r) => r.ok && r.markdown);
  // Bloc Meta Ads (lecture seule, fail-soft) : ne casse jamais le rapport Google.
  const google = done.length
    ? done.reduce((t, r) => ({ cost: t.cost + (r.google?.cost ?? 0), conversions: t.conversions + (r.google?.conversions ?? 0) }), { cost: 0, conversions: 0 })
    : null;
  const meta = await buildMetaSection(google);
  let email = "rien à envoyer";
  if (done.length || meta) {
    const sections = done.map((r) => `# ${r.account}\n\n${r.markdown}`);
    if (meta) sections.push(meta);
    const md = sections.join("\n\n---\n\n");
    try {
      await sendAgentEmail(`📅 Compte rendu de la semaine · ${done.length} compte(s)${meta ? " + Meta" : ""}`, md);
      email = "envoyé";
    } catch (e) {
      email = `non envoyé : ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return NextResponse.json({ ranAt: new Date().toISOString(), email, results: results.map(({ markdown, ...r }) => r) });
}
