// Diagnostic : santé du compte /100 et constats classés par priorité.
// Calcul sans IA (0 crédit). Rien n'est modifié dans Google Ads sans clic :
// les corrections en un clic sont journalisées et annulables 30 jours.
import Link from "next/link";
import { getActiveClient } from "@/lib/clients/active";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { latestAuditReports } from "@/lib/audit/run";
import { CATEGORY_LABELS, type AuditCategory, type Constat, type Severity } from "@/lib/audit/types";
import { runAuditNow, applyFixAction, undoFixAction } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import { describeFix } from "@/lib/fixes/apply";
import { listActions, canUndo, UNDO_DAYS, type ActionLog } from "@/lib/fixes/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // plusieurs comptes clients (Fluid compute)

const eur = (n: number | string) => `${Math.round(Number(n)).toLocaleString("fr-FR")} €`;
const SEV: Record<Severity, { label: string; color: string }> = {
  critique: { label: "Critique", color: "var(--red)" },
  important: { label: "Important", color: "#f59e0b" },
  mineur: { label: "Mineur", color: "var(--muted)" },
};
const scoreColor = (s: number) => (s >= 80 ? "var(--green)" : s >= 60 ? "#f59e0b" : "var(--red)");

type SP = Promise<{ account?: string; cat?: string; msg?: string }>;

export default async function DiagnosticPage({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;

  const reports = await latestAuditReports();
  const active = sp.account ? null : await getActiveClient();
  const want = sp.account ?? active?.customer_id;
  const report = reports.find((r) => r.customer_id === want) ?? reports[0] ?? null;
  const cat = (sp.cat && sp.cat in CATEGORY_LABELS ? sp.cat : "tout") as AuditCategory | "tout";

  let actions: ActionLog[] = []; let logError: string | null = null;
  if (report) {
    try { actions = await listActions(report.customer_id, 300); }
    catch (e) { logError = e instanceof Error ? e.message : String(e); }
  }

  const headerRight = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {report && <Link className="btn-ghost" href={`/audit/client?account=${report.customer_id}`} style={{ padding: "11px 16px", borderRadius: 10, display: "inline-flex", alignItems: "center" }}>Audit PDF</Link>}
      <Link className="btn-ghost" href="/waste/journal" style={{ padding: "11px 16px", borderRadius: 10, display: "inline-flex", alignItems: "center" }}>Journal des corrections</Link>
      <form action={runAuditNow}>
        <input type="hidden" name="customer_id" value={report?.customer_id ?? ""} />
        <SubmitButton className="btn" pending="Lecture du compte… (20 à 40 s)">Relancer le diagnostic</SubmitButton>
      </form>
    </div>
  );
  const msg = sp.msg ? { ok: sp.msg.startsWith("ok:"), text: sp.msg.replace(/^(ok|err):/, "") } : null;

  const href = (account: string, c: string) =>
    `/waste?account=${encodeURIComponent(account)}${c !== "tout" ? `&cat=${c}` : ""}`;

  return (
    <Shell active="waste" token={ctx.mcpToken} headerRight={headerRight} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <h1 style={{ margin: "0 0 6px" }}>Diagnostic</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Tes comptes relus chaque matin. Calcul sans IA, aucun crédit consommé. Rien n&apos;est modifié dans Google Ads sans ton clic,
        et chaque correction s&apos;annule pendant {UNDO_DAYS} jours.
      </p>
      {msg && (
        <div className="card" style={{ borderColor: msg.ok ? "var(--green)" : "var(--red)", margin: "10px 0" }}>
          {msg.ok ? "✓ " : ""}{msg.text}
        </div>
      )}
      {logError && (
        <div className="card" style={{ borderColor: "#f59e0b", margin: "10px 0", fontSize: 13 }}>
          Corrections en un clic indisponibles : lance la migration 0020_action_log.sql dans Supabase. ({logError.slice(0, 120)})
        </div>
      )}

      {!report ? (
        <div className="card" style={{ marginTop: 18 }}>
          Aucun diagnostic pour l&apos;instant. Clique sur « Relancer le diagnostic ».
          {ctx.mode === "mock" && " (Mode démo : données factices.)"}
        </div>
      ) : (
        <Report report={report} reports={reports} cat={cat} href={href} actions={logError ? null : actions} />
      )}
    </Shell>
  );
}

function Report({
  report,
  reports,
  cat,
  href,
  actions,
}: {
  actions: ActionLog[] | null;
  report: Awaited<ReturnType<typeof latestAuditReports>>[number];
  reports: Awaited<ReturnType<typeof latestAuditReports>>;
  cat: AuditCategory | "tout";
  href: (account: string, c: string) => string;
}) {
  const constats = report.constats;
  const counts = new Map<string, number>();
  constats.forEach((c) => counts.set(c.category, (counts.get(c.category) ?? 0) + 1));
  const shown = cat === "tout" ? constats : constats.filter((c) => c.category === cat);
  const priorities = constats.filter((c) => c.severity !== "mineur").slice(0, 3);
  const score = report.health_score;

  return (
    <>
      {reports.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
          {reports.map((r) => (
            <Link key={r.customer_id} href={href(r.customer_id, "tout")} className={`pill ${r.customer_id === report.customer_id ? "ok" : ""}`}>
              {r.account_name ?? r.customer_id} · {r.health_score}
            </Link>
          ))}
        </div>
      )}

      <div className="card" style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap", margin: "14px 0" }}>
        <div
          aria-label={`Santé ${score} sur 100`}
          style={{
            width: 92, height: 92, borderRadius: "50%", flexShrink: 0,
            background: `conic-gradient(${scoreColor(score)} ${score * 3.6}deg, var(--surface-2) 0deg)`,
            display: "grid", placeItems: "center",
          }}
        >
          <div style={{ width: 74, height: 74, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 26, fontWeight: 700 }}>
            {score}
          </div>
        </div>
        <Kpi label="Constats" value={String(constats.length)} />
        <Kpi label="Gaspillage prouvé" value={eur(report.waste_proven)} color="var(--red)" />
        <Kpi label="À confirmer" value={eur(report.waste_watch)} color="#f59e0b" />
        <Kpi label="Dépense 30 j" value={eur(report.total_cost)} sub={`${Math.round(Number(report.conversions))} conversion(s)`} />
        <div className="subtitle" style={{ margin: 0, marginLeft: "auto", fontSize: 12 }}>
          {report.account_name} · lu le {report.created_at ? new Date(report.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }) : new Date(report.run_date).toLocaleDateString("fr-FR")}
        </div>
      </div>

      {priorities.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <strong>Par où commencer</strong>
          <ol style={{ margin: "10px 0 0", paddingLeft: 20 }}>
            {priorities.map((c) => (
              <li key={c.id} style={{ margin: "6px 0" }}>
                <span style={{ fontWeight: 600 }}>{c.title}</span>
                <div className="subtitle" style={{ margin: "2px 0 0", fontSize: 13 }}>{c.action}</div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <Link href={href(report.customer_id, "tout")} className={`pill ${cat === "tout" ? "ok" : ""}`}>Tout · {constats.length}</Link>
        {(Object.keys(CATEGORY_LABELS) as AuditCategory[]).map((k) => (
          <Link key={k} href={href(report.customer_id, k)} className={`pill ${cat === k ? "ok" : ""}`}>
            {CATEGORY_LABELS[k]} · {counts.get(k) ?? 0}
          </Link>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {shown.length === 0 ? (
          <p className="subtitle" style={{ margin: 0, padding: 16 }}>Rien à signaler ici.</p>
        ) : (
          shown.map((c) => (
            <Row key={c.id} c={c} customerId={report.customer_id} cat={cat}
              enabled={actions !== null} done={actions?.find((a) => a.constat_id === c.id && canUndo(a)) ?? null} />
          ))
        )}
      </div>

      {report.skipped.length > 0 && (
        <p className="subtitle" style={{ fontSize: 12 }}>
          Vérifications indisponibles : {report.skipped.map((s) => `${s.check} (${s.reason.slice(0, 90)})`).join(" · ")}
        </p>
      )}
    </>
  );
}

function Kpi({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div>
      <div className="subtitle" style={{ margin: 0, fontSize: 12, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      {sub && <div className="subtitle" style={{ margin: 0, fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

function Row({ c, customerId, cat, enabled, done }: { c: Constat; customerId: string; cat: string; enabled: boolean; done: ActionLog | null }) {
  const sev = SEV[c.severity];
  return (
    <div style={{ display: "flex", gap: 14, padding: "14px 16px", borderTop: "1px solid var(--border)", alignItems: "flex-start" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sev.color, marginTop: 7, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{c.title}</div>
        <div className="subtitle" style={{ margin: "3px 0 0", fontSize: 13 }}>
          {c.campaign ? `${c.campaign} · ` : ""}{c.detail}
        </div>
        <div style={{ marginTop: 6, fontSize: 13 }}>→ {c.action}</div>
        {c.paste && (
          <code style={{ display: "inline-block", marginTop: 6, padding: "3px 8px", borderRadius: 6, background: "var(--surface-2)", fontSize: 12 }}>
            {c.paste}
          </code>
        )}
        {done ? (
          <form action={undoFixAction} style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <input type="hidden" name="action_id" value={done.id} />
            <input type="hidden" name="customer_id" value={customerId} />
            <input type="hidden" name="cat" value={cat} />
            <span className="pill ok" style={{ fontSize: 12 }}>✓ Corrigé le {new Date(done.created_at).toLocaleDateString("fr-FR")}</span>
            <SubmitButton className="btn-ghost" pending="Annulation…" style={{ padding: "5px 10px", fontSize: 12 }}>Annuler</SubmitButton>
          </form>
        ) : c.fix && enabled ? (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>Corriger en un clic</summary>
            <form action={applyFixAction} style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "var(--surface-2)" }}>
              <input type="hidden" name="customer_id" value={customerId} />
              <input type="hidden" name="constat_id" value={c.id} />
              <input type="hidden" name="cat" value={cat} />
              <div style={{ fontSize: 13 }}>{describeFix(c.fix)}</div>
              <div className="subtitle" style={{ margin: "4px 0 8px", fontSize: 12 }}>Appliqué tout de suite dans Google Ads, noté au journal, annulable {UNDO_DAYS} jours.</div>
              <SubmitButton pending="Envoi à Google Ads…" style={{ padding: "7px 12px", fontSize: 13 }}>Appliquer dans Google Ads</SubmitButton>
            </form>
          </details>
        ) : null}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: sev.color, fontWeight: 600 }}>{sev.label}</div>
        <div style={{ fontWeight: 600 }}>{c.amount !== null ? eur(c.amount) : ""}</div>
      </div>
    </div>
  );
}
