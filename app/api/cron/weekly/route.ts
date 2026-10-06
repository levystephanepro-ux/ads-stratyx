// Rapport du lundi (Vercel Cron, voir vercel.json) : un compte rendu rédigé par
// l'IA par compte actif, envoyé par email. ~1 crédit par compte.
import { NextResponse } from "next/server";
import { runWeeklyReports } from "@/lib/weekly";
import { sendAgentEmail } from "@/lib/agent/email";

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
  let email = "rien à envoyer";
  if (done.length) {
    const md = done.map((r) => `# ${r.account}\n\n${r.markdown}`).join("\n\n---\n\n");
    try {
      await sendAgentEmail(`📅 Compte rendu de la semaine · ${done.length} compte(s)`, md);
      email = "envoyé";
    } catch (e) {
      email = `non envoyé : ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return NextResponse.json({ ranAt: new Date().toISOString(), email, results: results.map(({ markdown, ...r }) => r) });
}
