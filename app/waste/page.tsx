// Diagnostic : santé du compte /100 et constats classés par priorité.
// Calcul sans IA (0 crédit), lecture seule : rien n'est modifié dans Google Ads.
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { latestAuditReports } from "@/lib/audit/run";
import { CATEGORY_LABELS, type AuditCategory, type Constat, type Severity } from "@/lib/audit/types";
import { runAuditNow } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const eur = (n: number | string) => `${Math.round(Number(n)).toLocaleString("fr-FR")} €`;
const SEV: Record<Severity, { label: string; color: string }> = {
  critique: { label: "Critique", color: "var(--red)" },
  important: { label: "Important", color: "#f59e0b" },
  mineur: { label: "Mineur", color: "var(--muted)" },
};
const scoreColor = (s: number) => (s >= 80 ? "var(--green)" : s >= 60 ? "#f59e0b" : "var(--red)");

type SP = Promise<{ account?: string; cat?: string }>;

export default async function DiagnosticPage({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;

  const reports = await latestAuditReports();
  const report = reports.find((r) => r.customer_id === sp.account) ?? reports[0] ?? null;
  const cat = (sp.cat && sp.cat in CATEGORY_LABELS ? sp.cat : "tout") as AuditCategory | "tout";

  const headerRight = (
    <form action={runAuditNow}>
      <button className="btn" type="submit">Relancer le diagnostic</button>
    </form>
  );

  const href = (account: string, c: string) =>
    `/waste?account=${encodeURIComponent(account)}${c !== "tout" ? `&cat=${c}` : ""}`;

  return (
    <Shell active="waste" token={ctx.mcpToken} headerRight={headerRight} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <h1 style={{ margin: "0 0 6px" }}>Diagnostic</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Tes comptes relus chaque matin. Calcul sans IA, aucun crédit consommé, rien n&apos;est modifié dans Google Ads.
      </p>

      {!report ? (
        <div className="card" style={{ marginTop: 18 }}>
          Aucun diagnostic pour l&apos;instant. Clique sur « Relancer le diagnostic ».
          {ctx.mode === "mock" && " (Mode démo : données factices.)"}
        </div>
      ) : (
        <Report report={report} reports={reports} cat={cat} href={href} />
      )}
    </Shell>
  );
}

function Report({
  report,
  reports,
  cat,
  href,
}: {
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
          {report.account_name} · lu le {new Date(report.run_date).toLocaleDateString("fr-FR")}
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
          shown.map((c) => <Row key={c.id} c={c} />)
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

function Row({ c }: { c: Constat }) {
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
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: sev.color, fontWeight: 600 }}>{sev.label}</div>
        <div style={{ fontWeight: 600 }}>{c.amount !== null ? eur(c.amount) : ""}</div>
      </div>
    </div>
  );
}
