// Affichage d'un rapport de diagnostic (page /waste), sur le modèle du Waste Detector d'Ades :
// carte de score, onglets par catégorie + « Traité », liste de constats avec score de priorité,
// montant à droite et bouton « Corriger » sur chaque ligne. Composant serveur.
import Link from "next/link";
import type { ReactNode } from "react";
import SubmitButton from "@/components/SubmitButton";
import { Tabs, Stat, ScoreRing } from "@/components/ui";
import { CATEGORY_LABELS, type AuditCategory, type Constat } from "@/lib/audit/types";
import type { latestAuditReports } from "@/lib/audit/run";
import { describeFix } from "@/lib/fixes/apply";
import { canUndo, UNDO_DAYS, type ActionLog } from "@/lib/fixes/store";
import { applyFixAction, undoFixAction } from "@/app/waste/actions";

const eur = (n: number | string) => `${Math.round(Number(n)).toLocaleString("fr-FR")} €`;

export type DiagReport = Awaited<ReturnType<typeof latestAuditReports>>[number];
export type DiagCat = AuditCategory | "tout" | "traite";

/** Score de priorité 1-99 : gravité + poids du montant en jeu dans la dépense du compte. */
export function priorityScore(c: Constat, totalCost: number): number {
  const base = c.severity === "critique" ? 45 : c.severity === "important" ? 25 : 8;
  const share = c.amount ? Math.min(45, Math.round((c.amount / Math.max(totalCost, 1)) * 150)) : 0;
  return Math.max(1, Math.min(99, base + share));
}

/** Met en couleur les éléments entre « » (campagne, mot-clé, terme…). */
function highlight(text: string): ReactNode {
  return text.split(/(«[^»]*»)/g).map((part, i) =>
    part.startsWith("«") ? <span key={i} className="dg-entity">{part}</span> : part,
  );
}

export default function Report({
  report,
  reports,
  cat,
  href,
  actions,
  iaHref,
}: {
  actions: ActionLog[] | null;
  report: DiagReport;
  reports: DiagReport[];
  cat: DiagCat;
  href: (account: string, c: string) => string;
  iaHref: string;
}) {
  const constats = report.constats;
  const total = Number(report.total_cost);
  const counts = new Map<string, number>();
  constats.forEach((c) => counts.set(c.category, (counts.get(c.category) ?? 0) + 1));
  const treated = (actions ?? []).filter((a) => a.status === "done");
  const shown = (cat === "tout" || cat === "traite" ? constats : constats.filter((c) => c.category === cat))
    .map((c) => ({ c, score: priorityScore(c, total) }))
    .sort((a, b) => b.score - a.score);
  const score = report.health_score;
  const scoreText = score >= 80 ? "Compte sain" : score >= 60 ? "À surveiller" : "À reprendre";
  const proven = Number(report.waste_proven);

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

      <section className="ui-panel dg-hero">
        <div className="dg-hero-score">
          <ScoreRing score={score} size={112} />
          <Stat label="Santé" value={scoreText} />
        </div>
        <Stat label="Constats" value={constats.length} />
        <Stat label="À récupérer" value={eur(proven)} tone={proven > 0 ? "bad" : "good"} />
        <Stat label="À confirmer" value={eur(report.waste_watch)} tone={Number(report.waste_watch) > 0 ? "warn" : undefined} />
      </section>

      <Tabs items={[
        { label: "Tout", href: href(report.customer_id, "tout"), active: cat === "tout", count: constats.length },
        ...(Object.keys(CATEGORY_LABELS) as AuditCategory[])
          .filter((k) => (counts.get(k) ?? 0) > 0 || cat === k)
          .map((k) => ({ label: CATEGORY_LABELS[k], href: href(report.customer_id, k), active: cat === k, count: counts.get(k) ?? 0 })),
        ...(actions !== null ? [{ label: "Traité", href: href(report.customer_id, "traite"), active: cat === "traite", count: treated.length }] : []),
      ]} />

      <section className="ui-panel flush">
        <div className="dg-list-head">
          <Link className="ui-btn ui-btn-ghost" href={iaHref}>✦ Analyser avec l&apos;IA</Link>
        </div>
        {cat === "traite" ? (
          treated.length === 0 ? (
            <p className="dg-empty">Aucune correction faite depuis Stratyx sur ce compte.</p>
          ) : (
            treated.map((a) => <Treated key={a.id} a={a} customerId={report.customer_id} />)
          )
        ) : shown.length === 0 ? (
          <p className="dg-empty">Rien à signaler ici.</p>
        ) : (
          shown.map(({ c, score: s }) => (
            <Row key={c.id} c={c} score={s} customerId={report.customer_id} cat={cat}
              enabled={actions !== null} done={actions?.find((a) => a.constat_id === c.id && canUndo(a)) ?? null} />
          ))
        )}
      </section>

      {report.skipped.length > 0 && (
        <p className="dg-foot">
          Vérifications indisponibles : {report.skipped.map((s) => `${s.check} (${s.reason.slice(0, 90)})`).join(" · ")}
        </p>
      )}
    </>
  );
}

function PriorityRing({ score }: { score: number }) {
  const tone = score >= 40 ? "var(--orange)" : score >= 20 ? "var(--accent-2)" : "var(--muted)";
  return (
    <div className="dg-prio" style={{ background: `conic-gradient(${tone} ${score * 3.6}deg, var(--surface-2) 0deg)` }} title="Priorité (sur 100)">
      <span>{score}</span>
    </div>
  );
}

function Row({ c, score, customerId, cat, enabled, done }: { c: Constat; score: number; customerId: string; cat: string; enabled: boolean; done: ActionLog | null }) {
  return (
    <div className="dg-row">
      <PriorityRing score={score} />
      <div className="dg-row-main">
        <div className="dg-row-title">{highlight(c.title)}</div>
        <div className="dg-row-meta">{c.campaign ? `${c.campaign} · ` : ""}{c.detail}</div>
      </div>
      <div className="dg-row-side">
        {c.amount !== null ? (
          <div><div className="dg-amount">{eur(c.amount)}</div><div className="dg-amount-sub">sans conversion</div></div>
        ) : (
          <div className="dg-amount-sub">Non chiffrable</div>
        )}
        {done ? (
          <form action={undoFixAction} className="dg-done">
            <input type="hidden" name="action_id" value={done.id} />
            <input type="hidden" name="customer_id" value={customerId} />
            <input type="hidden" name="cat" value={cat} />
            <span className="pill ok">✓ Corrigé le {new Date(done.created_at).toLocaleDateString("fr-FR")}</span>
            <SubmitButton className="ui-btn ui-btn-ghost" pending="Annulation…">Annuler</SubmitButton>
          </form>
        ) : (
          <details className="dg-fix">
            <summary className="ui-btn ui-btn-ghost">Corriger</summary>
            <div className="dg-fix-body">
              <div className="dg-fix-label">À faire</div>
              <div>{c.action}</div>
              {c.paste && <code className="dg-paste">{c.paste}</code>}
              {c.fix && enabled ? (
                <form action={applyFixAction} style={{ marginTop: 12 }}>
                  <input type="hidden" name="customer_id" value={customerId} />
                  <input type="hidden" name="constat_id" value={c.id} />
                  <input type="hidden" name="cat" value={cat} />
                  <div className="dg-fix-label">En un clic</div>
                  <div>{describeFix(c.fix)}</div>
                  <div className="dg-foot" style={{ margin: "4px 0 10px" }}>Appliqué tout de suite dans Google Ads, noté au journal, annulable {UNDO_DAYS} jours.</div>
                  <SubmitButton className="ui-btn ui-btn-primary" pending="Envoi à Google Ads…">Appliquer dans Google Ads</SubmitButton>
                </form>
              ) : (
                <div className="dg-foot" style={{ marginTop: 10 }}>À faire dans Google Ads : pas de correction automatique pour ce constat.</div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function Treated({ a, customerId }: { a: ActionLog; customerId: string }) {
  return (
    <div className="dg-row dg-row-treated">
      <div className="dg-prio dg-prio-ok"><span>✓</span></div>
      <div className="dg-row-main">
        <div className="dg-row-title">{highlight(a.title)}</div>
        <div className="dg-row-meta">{a.summary} · le {new Date(a.created_at).toLocaleDateString("fr-FR")}{a.author ? ` par ${a.author}` : ""}</div>
      </div>
      <div className="dg-row-side">
        {canUndo(a) ? (
          <form action={undoFixAction} className="dg-done">
            <input type="hidden" name="action_id" value={a.id} />
            <input type="hidden" name="customer_id" value={customerId} />
            <input type="hidden" name="cat" value="traite" />
            <SubmitButton className="ui-btn ui-btn-ghost" pending="Annulation…">Annuler</SubmitButton>
          </form>
        ) : (
          <div className="dg-amount-sub">Définitif</div>
        )}
      </div>
    </div>
  );
}
