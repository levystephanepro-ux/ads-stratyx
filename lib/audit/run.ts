// Orchestration du diagnostic : lit chaque compte de l'owner, applique les
// règles (sans IA), enregistre le rapport du jour, prépare l'email du matin.
import { createClient } from "@supabase/supabase-js";
import { isLive, hasEnvAccount, adsConfig } from "@/lib/google-ads/config";
import { listManagedAccounts } from "@/lib/google-ads/client";
import { MOCK_ACCOUNT } from "@/lib/google-ads/mock-data";
import { fetchAuditData, last30Days } from "./fetch";
import { runAudit } from "./rules";
import type { AuditResult, Constat } from "./types";

export interface AccountAudit {
  customerId: string;
  name: string;
  result: AuditResult | null;
  error: string | null;
}

export interface StoredAuditReport {
  customer_id: string;
  account_name: string | null;
  run_date: string;
  health_score: number;
  total_cost: number;
  conversions: number;
  waste_proven: number;
  waste_watch: number;
  constats: Constat[];
  skipped: AuditResult["skipped"];
}

// Client non typé : audit_reports n'est pas encore dans database.types.ts
// (relancer `npm run types` après la migration 0018).
function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function ownerAccounts(): Promise<{ customerId: string; name: string }[]> {
  if (!isLive()) return [{ customerId: MOCK_ACCOUNT.customerId, name: MOCK_ACCOUNT.descriptiveName }];
  if (!hasEnvAccount()) return [];
  const list = await listManagedAccounts(adsConfig.refreshToken);
  return list.map((a) => ({ customerId: a.customerId, name: a.name }));
}

function targetCpaFromEnv(): number | undefined {
  const t = Number(process.env.WASTE_TARGET_CPA ?? "");
  return Number.isFinite(t) && t > 0 ? t : undefined;
}

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const SEV_LABEL = { critique: "Critique", important: "Important", mineur: "Mineur" } as const;

/** Section markdown d'un compte pour l'email du matin. */
export function auditMarkdown(name: string, r: AuditResult): string {
  const lines = [
    `## ${name} · santé ${r.healthScore}/100`,
    `Dépense 30 j : ${eur(r.totalCost)} · ${Math.round(r.conversions)} conversion(s) · gaspillage prouvé ${eur(r.wasteProven)} · à confirmer ${eur(r.wasteWatch)}`,
  ];
  const top = r.constats.filter((c) => c.severity !== "mineur").slice(0, 5);
  if (top.length) {
    lines.push("", "**Par où commencer**");
    top.forEach((c, i) => lines.push(`${i + 1}. **${c.title}** (${SEV_LABEL[c.severity]}) : ${c.action}`));
  } else {
    lines.push("", "Rien d'urgent.");
  }
  if (r.skipped.length) lines.push("", `_Vérifications indisponibles : ${r.skipped.map((s) => s.check).join(", ")}._`);
  return lines.join("\n");
}

export async function runAuditForOwner(): Promise<{
  accounts: AccountAudit[];
  markdown: string;
  needsAttention: boolean;
}> {
  const range = last30Days();
  const accounts = await ownerAccounts();
  const supa = db();
  const out: AccountAudit[] = [];

  for (const acc of accounts) {
    try {
      const { data, skipped } = await fetchAuditData({ customerId: acc.customerId });
      const result = runAudit(data, { targetCpa: targetCpaFromEnv() });
      result.skipped = skipped;
      out.push({ ...acc, result, error: null });
      if (supa) {
        const { error } = await supa.from("audit_reports").upsert(
          {
            workspace_id: null,
            customer_id: acc.customerId,
            account_name: acc.name,
            run_date: new Date().toISOString().slice(0, 10),
            health_score: result.healthScore,
            total_cost: result.totalCost,
            conversions: result.conversions,
            waste_proven: result.wasteProven,
            waste_watch: result.wasteWatch,
            constats: result.constats,
            skipped: result.skipped,
          },
          { onConflict: "workspace_id,customer_id,run_date" },
        );
        if (error) throw new Error(`Enregistrement Supabase : ${error.message}`);
      }
    } catch (e) {
      out.push({ ...acc, result: null, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const active = out.filter((a) => a.result && a.result.totalCost > 0);
  const errors = out.filter((a) => a.error);
  const needsAttention =
    errors.length > 0 || active.some((a) => a.result!.constats.some((c) => c.severity !== "mineur"));

  const markdown = [
    `# Diagnostic du matin · ${range.since} → ${range.until}`,
    "Calcul sans IA sur les données Google Ads. Rien n'a été modifié dans tes comptes.",
    ...active.flatMap((a) => ["", auditMarkdown(a.name, a.result!)]),
    ...(errors.length ? ["", "### Comptes non lus", ...errors.map((a) => `- ${a.name} : ${a.error}`)] : []),
  ].join("\n");

  return { accounts: out, markdown, needsAttention };
}

/** Dernier rapport de chaque compte. */
export async function latestAuditReports(): Promise<StoredAuditReport[]> {
  const supa = db();
  if (!supa) return [];
  const { data } = await supa
    .from("audit_reports")
    .select("customer_id, account_name, run_date, health_score, total_cost, conversions, waste_proven, waste_watch, constats, skipped")
    .is("workspace_id", null)
    .order("run_date", { ascending: false })
    .limit(200);
  const seen = new Set<string>();
  const latest: StoredAuditReport[] = [];
  for (const r of (data ?? []) as StoredAuditReport[]) {
    if (seen.has(r.customer_id)) continue;
    seen.add(r.customer_id);
    latest.push(r);
  }
  return latest.sort((a, b) => a.health_score - b.health_score);
}
