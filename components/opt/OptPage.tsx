// Gabarit des pages façon Ades : bandeau de veille, titre + sous-titre chiffré,
// boutons (Comment ça marche, Analyser avec l'IA, Tout actualiser), filtres, onglets.
import Link from "next/link";
import type { ReactNode } from "react";
import Shell from "@/components/Shell";
import FilterBar from "./FilterBar";
import { Tabs, Notice } from "@/components/ui";
import { latestAuditReports } from "@/lib/audit/run";
import { listActions } from "@/lib/fixes/store";
import type { Scope } from "@/lib/optimize/scope";

/** Bandeau « Stratyx relit tes comptes chaque matin · x corrections faites · y alertes du matin ». */
export async function WatchBanner({ customerId }: { customerId?: string | null }) {
  let done = 0, alerts = 0, readAt: string | null = null;
  try {
    const reports = await latestAuditReports();
    const r = reports.find((x) => x.customer_id === customerId) ?? reports[0];
    if (r) {
      alerts = r.constats.filter((c) => c.severity !== "mineur").length;
      readAt = r.created_at
        ? new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" })
        : new Date(r.run_date).toLocaleDateString("fr-FR");
    }
  } catch { /* base indisponible : bandeau simple */ }
  try {
    done = (await listActions(customerId ?? undefined, 500)).filter((a) => a.status === "done").length;
  } catch { /* journal absent */ }
  return (
    <div className="dg-watch">
      <span>Stratyx relit tes comptes chaque matin{readAt ? <>, dernière lecture le {readAt}</> : null}</span>
      <span className="dg-watch-figures">
        <span><strong>{done}</strong> correction{done > 1 ? "s" : ""} faite{done > 1 ? "s" : ""}</span>
        <Link href="/alertes"><strong>{alerts}</strong> alerte{alerts > 1 ? "s" : ""} du matin</Link>
      </span>
    </div>
  );
}

export default async function OptPage({
  scope,
  title,
  sub,
  help,
  ia,
  tabs,
  extraActions,
  filters = "full",
  allLabel,
  children,
}: {
  scope: Scope;
  title: string;
  sub?: ReactNode;
  help?: ReactNode;
  /** Question envoyée au Copilote par « Analyser avec l'IA ». */
  ia?: string;
  tabs?: { label: string; href: string; active?: boolean; count?: number }[];
  extraActions?: ReactNode;
  filters?: "full" | "period" | "none" | "no-compare";
  allLabel?: string;
  children: ReactNode;
}) {
  const { dash } = scope;
  const iaQ = ia && scope.account ? `${ia} (compte ${scope.account.name}, ${scope.account.customerId}${scope.campaign ? `, campagne « ${scope.campaign.name} »` : ""}, ${scope.p.days} derniers jours)` : null;
  return (
    <Shell active="waste" token={dash.mcpToken} trialDaysLeft={dash.trialDaysLeft} showAdmin={dash.isOwner} accountName={dash.defaultAccountName}>
      <WatchBanner customerId={scope.account?.customerId} />
      <header className="op-head">
        <div className="op-head-text">
          <h1 className="ui-title">{title}</h1>
          {sub && <p className="op-sub">{sub}</p>}
        </div>
        <div className="ui-header-actions">
          {help && (
            <details className="ui-help">
              <summary className="ui-btn ui-btn-ghost">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="m10 8 6 4-6 4z" /></svg>
                Comment ça marche
              </summary>
              <div className="ui-help-body">{help}</div>
            </details>
          )}
          {iaQ && <Link className="ui-btn ui-btn-ghost" href={`/copilote?q=${encodeURIComponent(iaQ)}&auto=1`}>✦ Analyser avec l&apos;IA</Link>}
          {extraActions}
          <Link className="ui-btn ui-btn-ghost" href={scope.href()} prefetch={false}>Tout actualiser</Link>
        </div>
      </header>
      {filters !== "none" && (
        <FilterBar
          campaigns={scope.campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status }))}
          campaignId={scope.campaignId}
          days={scope.p.days}
          compare={scope.compare}
          accounts={scope.accounts}
          accountId={scope.account?.customerId}
          allLabel={allLabel}
          hideCampaign={filters === "period"}
          hideCompare={filters === "no-compare"}
        />
      )}
      {scope.error && <Notice tone="err">Lecture Google Ads impossible : {scope.error.slice(0, 220)}</Notice>}
      {!scope.account && !scope.error && <Notice tone="warn">Aucun compte Google Ads lié. Ajoute un compte dans Comptes et réglages.</Notice>}
      {tabs && <Tabs items={tabs} />}
      {children}
    </Shell>
  );
}

