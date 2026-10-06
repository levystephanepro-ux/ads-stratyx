// Rapport du lundi : l'IA rédige un compte rendu à partir de chiffres déjà
// calculés (scripts + diagnostic). Elle ne va pas chercher les données elle-même,
// d'où un coût faible (~1 crédit par compte) et des chiffres toujours justes.
import Anthropic from "@anthropic-ai/sdk";
import { calcCost, addMonthlyCost } from "@/lib/agent/cost";
import { getGlobalBilling } from "@/lib/billing";
import { isLive } from "@/lib/google-ads/config";
import { ownerAccounts, latestAuditReports } from "@/lib/audit/run";
import { getScript } from "@/lib/scripts/registry";
import { makeRange } from "@/lib/scripts/helpers";
import { formatCell } from "@/lib/scripts/format";
import { getAccountContext } from "@/lib/account-context";
import type { ScriptDef } from "@/lib/scripts/types";

const MODEL = "claude-haiku-4-5-20251001";

async function scriptAsText(id: string, customerId: string) {
  const s = getScript(id) as ScriptDef;
  const out = await s.run({ customerId }, makeRange(7));
  const head = s.columns.map((c) => c.label).join(" | ");
  const rows = out.rows.slice(0, 15).map((r) => s.columns.map((c) => formatCell(r[c.key], c.type)).join(" | "));
  return { rows: out.rows, text: `### ${s.title}\n${out.summary ?? ""}\n${head}\n${rows.join("\n")}` };
}

export async function runWeeklyReports(): Promise<{ account: string; ok: boolean; detail: string; markdown?: string }[]> {
  if (!isLive()) return [{ account: "démo", ok: false, detail: "mode démo : rapport désactivé" }];
  const accounts = await ownerAccounts();
  const audits = await latestAuditReports();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const results = [];

  for (const acc of accounts) {
    try {
      const billing = await getGlobalBilling();
      if (!billing.allowed) { results.push({ account: acc.name, ok: false, detail: billing.reason ?? "plafond IA" }); continue; }

      const point = await scriptAsText("point-semaine", acc.customerId);
      const cost = Number(point.rows.find((r) => r.metric === "Coût (€)")?.now ?? 0);
      if (!cost) { results.push({ account: acc.name, ok: false, detail: "aucune dépense cette semaine" }); continue; }
      const match = await scriptAsText("match-des-campagnes", acc.customerId);
      const audit = audits.find((a) => a.customer_id === acc.customerId);
      const prio = audit
        ? `Santé ${audit.health_score}/100. Priorités :\n${audit.constats.filter((c) => c.severity !== "mineur").slice(0, 5).map((c) => `- ${c.title} → ${c.action}`).join("\n")}`
        : "Pas de diagnostic disponible.";
      const ctx = await getAccountContext(acc.customerId, null);

      const res = await client.messages.create({
        model: MODEL, max_tokens: 1200,
        system: "Tu rédiges le compte rendu hebdomadaire Google Ads d'un consultant pour son client, une entreprise française. Ton simple, concret, sans jargon, sans tiret long. Tu n'utilises QUE les chiffres fournis.",
        messages: [{ role: "user", content:
          `Compte : ${acc.name}\n${ctx ? `Contexte : ${ctx}\n` : ""}\n${point.text}\n\n${match.text}\n\nDiagnostic :\n${prio}\n\n` +
          "Rédige en markdown : 1) Les chiffres de la semaine en 3 lignes, 2) Ce qui a bougé et pourquoi (campagnes), 3) Les 3 actions prévues cette semaine. 200 mots maximum." }],
      });
      const usage = calcCost(MODEL, res.usage.input_tokens, res.usage.output_tokens);
      await addMonthlyCost(usage.costUsd, "agent", null);
      const markdown = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
      results.push({ account: acc.name, ok: true, detail: `${Math.max(1, Math.round(usage.costUsd / 0.05))} crédit(s)`, markdown });
    } catch (e) {
      results.push({ account: acc.name, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
