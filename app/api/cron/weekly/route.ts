// Rapport du lundi (Vercel Cron, voir vercel.json) : un compte rendu rédigé par
// l'IA par compte actif, envoyé par email. ~1 crédit par compte.
import { NextResponse } from "next/server";
import { runWeeklyReports } from "@/lib/weekly";
import { sendAgentEmail } from "@/lib/agent/email";
import { getMetaWeeklyInsights, metaAccountIdsFromEnv } from "@/lib/meta/insights";
import { buildMetaSection, metaHasData } from "@/lib/meta/report";
import type { MetaInsightsResult } from "@/lib/meta/parse";

// Meta ne doit jamais faire échouer le rapport : getMetaWeeklyInsights ne lève pas d'exception,
// et ce filet couvre le reste (lecture de la config, etc.).
async function safeMeta(): Promise<MetaInsightsResult | null> {
  try {
    return await getMetaWeeklyInsights(metaAccountIdsFromEnv());
  } catch (e) {
    console.error("[meta] rapport sans Meta :", e instanceof Error ? e.message : "erreur inconnue");
    return null;
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // plusieurs comptes clients (Fluid compute)

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Google et Meta en parallèle : les deux sont lents, et Meta ne dépend pas de Google.
  const [results, meta] = await Promise.all([runWeeklyReports(), safeMeta()]);
  const done = results.filter((r) => r.ok && r.markdown);
  const google = done.reduce(
    (t, r) => ({ cost: t.cost + (r.totals?.cost ?? 0), conversions: t.conversions + (r.totals?.conversions ?? 0) }),
    { cost: 0, conversions: 0 },
  );
  let email = "rien à envoyer";
  // Un rapport « Meta indisponible » seul ne vaut pas un mail : on envoie s'il y a du Google ou des chiffres Meta.
  if (done.length || metaHasData(meta)) {
    const sections = done.map((r) => `# ${r.account}\n\n${r.markdown}`);
    sections.push(buildMetaSection(meta, done.length ? google : null));
    const md = sections.join("\n\n---\n\n");
    try {
      await sendAgentEmail(`📅 Compte rendu de la semaine · ${done.length ? `${done.length} compte(s)` : "Meta Ads"}`, md);
      email = "envoyé";
    } catch (e) {
      email = `non envoyé : ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return NextResponse.json({ ranAt: new Date().toISOString(), email, results: results.map(({ markdown, ...r }) => r) });
}
