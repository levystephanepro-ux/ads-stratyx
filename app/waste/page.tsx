// Diagnostic : santé du compte /100 et constats classés par priorité.
// Calcul sans IA (0 crédit). Rien n'est modifié dans Google Ads sans clic :
// les corrections en un clic sont journalisées et annulables 30 jours.
import Link from "next/link";
import { getActiveClient } from "@/lib/clients/active";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { latestAuditReports } from "@/lib/audit/run";
import { CATEGORY_LABELS } from "@/lib/audit/types";
import { runAuditNow } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import { PageHeader, Panel, Notice } from "@/components/ui";
import Report, { type DiagCat } from "@/components/DiagnosticReport";
import { listActions, UNDO_DAYS, type ActionLog } from "@/lib/fixes/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // plusieurs comptes clients (Fluid compute)

const eur = (n: number | string) => `${Math.round(Number(n)).toLocaleString("fr-FR")} €`;
type SP = Promise<{ account?: string; cat?: string; msg?: string }>;

export default async function DiagnosticPage({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;

  const reports = await latestAuditReports();
  const active = sp.account ? null : await getActiveClient();
  const want = sp.account ?? active?.customer_id;
  const report = reports.find((r) => r.customer_id === want) ?? reports[0] ?? null;
  const cat = (sp.cat && (sp.cat in CATEGORY_LABELS || sp.cat === "traite") ? sp.cat : "tout") as DiagCat;

  let actions_: ActionLog[] = []; let logError: string | null = null;
  if (report) {
    try { actions_ = await listActions(report.customer_id, 300); }
    catch (e) { logError = e instanceof Error ? e.message : String(e); }
  }

  const msg = sp.msg ? { ok: sp.msg.startsWith("ok:"), text: sp.msg.replace(/^(ok|err):/, "") } : null;
  const href = (account: string, c: string) =>
    `/waste?account=${encodeURIComponent(account)}${c !== "tout" ? `&cat=${c}` : ""}`;

  const readAt = report
    ? (report.created_at
        ? new Date(report.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" })
        : new Date(report.run_date).toLocaleDateString("fr-FR"))
    : null;
  const iaQuestion = report
    ? `Analyse le diagnostic du compte ${report.account_name ?? ""} (${report.customer_id}) : priorise les constats, dis lesquels traiter cette semaine et propose un plan d'action à budget constant.`
    : "";
  const done = actions_.filter((a) => a.status === "done").length;

  const actions = (
    <>
      <Link className="ui-btn ui-btn-ghost" href="/waste/journal">Journal</Link>
      <form action={runAuditNow}>
        <input type="hidden" name="customer_id" value={report?.customer_id ?? ""} />
        <SubmitButton className="ui-btn ui-btn-ghost" pending="Lecture du compte… (20 à 40 s)">Tout actualiser</SubmitButton>
      </form>
      {report && <Link className="ui-btn ui-btn-primary" href={`/audit/client?account=${report.customer_id}`}>Exporter en PDF</Link>}
    </>
  );
  const help = (
    <>
      <p>Chaque matin, Stratyx relit tes comptes et note leur santé sur 100. Calcul sans IA, aucun crédit consommé.</p>
      <p><strong>À récupérer</strong> : dépense sans conversion avec assez de clics pour conclure. <strong>À confirmer</strong> : même signal, pas encore assez de volume.</p>
      <p>Le chiffre rond devant chaque constat est sa <strong>priorité sur 100</strong> (gravité et argent en jeu) : la liste est triée du plus urgent au moins urgent.</p>
      <p>Rien n&apos;est modifié dans Google Ads sans ton clic, et chaque correction s&apos;annule pendant {UNDO_DAYS} jours (Journal).</p>
    </>
  );

  return (
    <Shell active="waste" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <div className="dg-watch">
        <span>Stratyx relit tes comptes chaque matin{readAt ? <>, dernière lecture le {readAt}</> : null}</span>
        {report && (
          <span className="dg-watch-figures">
            <span><strong>{done}</strong> correction{done > 1 ? "s" : ""} faite{done > 1 ? "s" : ""}</span>
            <span><strong>{report.constats.length}</strong> constat{report.constats.length > 1 ? "s" : ""} ce matin</span>
          </span>
        )}
      </div>
      <PageHeader title="Diagnostic" actions={actions} help={help} />
      {msg && <Notice tone={msg.ok ? "ok" : "err"}>{msg.ok ? "✓ " : ""}{msg.text}</Notice>}
      {logError && (
        <Notice tone="warn">
          Corrections en un clic indisponibles : lance la migration 0020_action_log.sql dans Supabase. ({logError.slice(0, 120)})
        </Notice>
      )}

      {!report ? (
        <Panel>
          Aucun diagnostic pour l&apos;instant. Clique sur « Relancer le diagnostic ».
          {ctx.mode === "mock" && " (Mode démo : données factices.)"}
        </Panel>
      ) : (
        <Report report={report} reports={reports} cat={cat} href={href} actions={logError ? null : actions_}
          iaHref={`/copilote?q=${encodeURIComponent(iaQuestion)}&auto=1`} />
      )}
    </Shell>
  );
}

