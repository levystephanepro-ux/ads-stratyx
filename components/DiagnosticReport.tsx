// Affichage d'un rapport de diagnostic (page /waste). Composant serveur.
import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { Tabs, Stat, ScoreRing, Panel } from "@/components/ui";
import { CATEGORY_LABELS, type AuditCategory, type Constat, type Severity } from "@/lib/audit/types";
import type { latestAuditReports } from "@/lib/audit/run";
import { describeFix } from "@/lib/fixes/apply";
import { canUndo, UNDO_DAYS, type ActionLog } from "@/lib/fixes/store";
import { applyFixAction, undoFixAction } from "@/app/waste/actions";

const eur = (n: number | string) => `${Math.round(Number(n)).toLocaleString("fr-FR")} €`;
const SEV: Record<Severity, string> = { critique: "Critique", important: "Important", mineur: "Mineur" };

export type DiagReport = Awaited<ReturnType<typeof latestAuditReports>>[number];

export default function Report({
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
  const scoreText = score >= 80 ? "Compte sain" : score >= 60 ? "À surveiller" : "À reprendre";

  return (
    <>
      {reports.length > 1 && (
        <div className="dg-accounts">
          {reports.map((r) => (
            <Link key={r.customer_id} href={href(r.customer_id, "tout")} className={`ui-tab${r.customer_id === report.customer_id ? " active" : ""}`}>
              {r.account_name ?? r.customer_id}<span className="ui-tab-count">{r.health_score}</span>
            </Link>
          ))}
        </div>
      )}

      <Panel>
        <div className="dg-hero">
          <div className="dg-hero-score">
            <ScoreRing score={score} />
            <Stat label="Santé" value={scoreText} />
          </div>
          <div className="dg-stats">
            <Stat label="Constats" value={constats.length} />
            <Stat label="Gaspillé" value={eur(report.waste_proven)} tone={Number(report.waste_proven) > 0 ? "bad" : undefined} sub="sans conversion, volume suffisant" />
            <Stat label="À confirmer" value={eur(report.waste_watch)} tone={Number(report.waste_watch) > 0 ? "warn" : undefined} sub="pas encore assez de volume" />
            <Stat label="Dépense 30 j" value={eur(report.total_cost)} sub={`${Math.round(Number(report.conversions))} conversion(s)`} />
          </div>
        </div>
      </Panel>

      {priorities.length > 0 && (
        <Panel title="Par où commencer">
          <ol className="dg-start">
            {priorities.map((c) => (
              <li key={c.id}>
                <div>
                  <div className="dg-start-title">{c.title}</div>
                  <div className="dg-start-action">{c.action}</div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <Tabs items={[
        { label: "Tout", href: href(report.customer_id, "tout"), active: cat === "tout", count: constats.length },
        ...(Object.keys(CATEGORY_LABELS) as AuditCategory[])
          .filter((k) => (counts.get(k) ?? 0) > 0 || cat === k)
          .map((k) => ({ label: CATEGORY_LABELS[k], href: href(report.customer_id, k), active: cat === k, count: counts.get(k) ?? 0 })),
      ]} />

      <Panel flush>
        {shown.length === 0 ? (
          <p className="dg-foot" style={{ margin: 0, padding: 22 }}>Rien à signaler ici.</p>
        ) : (
          shown.map((c) => (
            <Row key={c.id} c={c} customerId={report.customer_id} cat={cat}
              enabled={actions !== null} done={actions?.find((a) => a.constat_id === c.id && canUndo(a)) ?? null} />
          ))
        )}
      </Panel>

      {report.skipped.length > 0 && (
        <p className="dg-foot">
          Vérifications indisponibles : {report.skipped.map((s) => `${s.check} (${s.reason.slice(0, 90)})`).join(" · ")}
        </p>
      )}
    </>
  );
}

function Row({ c, customerId, cat, enabled, done }: { c: Constat; customerId: string; cat: string; enabled: boolean; done: ActionLog | null }) {
  return (
    <div className="dg-row">
      <div style={{ minWidth: 0 }}>
        <div className={`dg-sev ${c.severity}`}>{SEV[c.severity]}</div>
        <div className="dg-row-title">{c.title}</div>
        <div className="dg-row-meta">{c.campaign ? <span className="dg-camp">{c.campaign} · </span> : null}{c.detail}</div>
        <div className="dg-row-action">→ {c.action}</div>
        {c.paste && <code className="dg-paste">{c.paste}</code>}
      </div>
      <div className="dg-row-side">
        {c.amount !== null ? (
          <><div className="dg-amount">{eur(c.amount)}</div><div className="dg-amount-sub">en jeu</div></>
        ) : (
          <div className="dg-amount-sub" style={{ marginTop: 0 }}>Non chiffrable</div>
        )}
        {done ? (
          <form action={undoFixAction} style={{ display: "grid", gap: 6, justifyItems: "end" }}>
            <input type="hidden" name="action_id" value={done.id} />
            <input type="hidden" name="customer_id" value={customerId} />
            <input type="hidden" name="cat" value={cat} />
            <span className="pill ok">✓ Corrigé le {new Date(done.created_at).toLocaleDateString("fr-FR")}</span>
            <SubmitButton className="ui-btn ui-btn-ghost" pending="Annulation…">Annuler</SubmitButton>
          </form>
        ) : c.fix && enabled ? (
          <details className="dg-fix">
            <summary className="ui-btn ui-btn-ghost">Corriger</summary>
            <form action={applyFixAction} className="dg-fix-body">
              <input type="hidden" name="customer_id" value={customerId} />
              <input type="hidden" name="constat_id" value={c.id} />
              <input type="hidden" name="cat" value={cat} />
              <div>{describeFix(c.fix)}</div>
              <div className="dg-foot" style={{ margin: "4px 0 10px" }}>Appliqué tout de suite dans Google Ads, noté au journal, annulable {UNDO_DAYS} jours.</div>
              <SubmitButton className="ui-btn ui-btn-primary" pending="Envoi à Google Ads…">Appliquer dans Google Ads</SubmitButton>
            </form>
          </details>
        ) : null}
      </div>
    </div>
  );
}
