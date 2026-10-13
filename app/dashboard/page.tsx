// Accueil façon Ades : bienvenue, tableau de bord (période vs précédente,
// part d'impressions, budget du mois), accès rapides.
import Link from "next/link";
import { listClients } from "@/lib/clients/store";
import { getProposal } from "@/lib/clients/proposal";
import { stageOf, stageRank, stageLabel, nextAction } from "@/lib/clients/stages";
import { getDashboardContext } from "@/lib/workspace";
import { requireSub } from "@/lib/subscription";
import Shell from "@/components/Shell";
import UsageWidget from "@/components/UsageWidget";
import { PageHeader, Panel } from "@/components/ui";
import { WatchBanner } from "@/components/opt/OptPage";
import { latestAuditReports } from "@/lib/audit/run";
import { getDefaultAccountInfo, getAccountsInfo } from "@/lib/google-ads/default-account";
import { isLive } from "@/lib/google-ads/config";
import { buildDashboard, type Dashboard as DashData } from "@/lib/dashboard";
import DashboardPerf, { DASH_PERIODS } from "@/components/DashboardPerf";

export const dynamic = "force-dynamic";

const AUDIT_PROMPT =
  "Fais un audit express de mon compte : les 3 problèmes les plus urgents à traiter cette semaine, avec l'impact estimé.";

export const maxDuration = 60;

type SP = Promise<{ account?: string; p?: string }>;

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  requireSub(ctx);
  const sp = await searchParams;
  const q = `?token=${encodeURIComponent(ctx.mcpToken)}`;

  const accountInfo = await getDefaultAccountInfo({ workspaceId: ctx.workspaceId, isOwner: ctx.isOwner });

  // Tableau de bord : owner en mode live (lecture avec le compte administrateur)
  const period = DASH_PERIODS.some((x) => x.key === sp.p) ? sp.p! : "30";
  let perf: { d: DashData; account: string; accounts: { customerId: string; name: string }[] } | null = null;
  let perfError: string | null = null;
  if (ctx.isOwner && isLive()) {
    try {
      const { accounts, defaultCustomerId } = await getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true });
      const account = accounts.some((a) => a.customerId === sp.account) ? sp.account! : defaultCustomerId ?? accounts[0]?.customerId;
      if (account) perf = { d: await buildDashboard({ customerId: account }, period), account, accounts };
    } catch (e) { perfError = e instanceof Error ? e.message : String(e); }
  }

  // Owner : prochaines actions du pipeline clients (hors pause et perdu).
  let todo: { id: string; name: string; stage: string; text: string; href: string }[] = [];
  if (ctx.isOwner) {
    try {
      const list = (await listClients()).filter((c) => !["pause", "perdu"].includes(stageOf(c)));
      const props = await Promise.all(list.map((c) => getProposal(c.id).then((x) => !!x).catch(() => false)));
      todo = list.map((c, i) => ({ c, n: nextAction(c, props[i]) })).filter((x) => x.n)
        .sort((a, b) => stageRank(stageOf(a.c)) - stageRank(stageOf(b.c)))
        .slice(0, 6).map(({ c, n }) => ({ id: c.id, name: c.name, stage: stageLabel(stageOf(c)), text: n!.text, href: n!.href }));
    } catch { /* table clients absente : on n'affiche rien */ }
  }

  // Comptes surveillés : constats du dernier diagnostic, du plus urgent au plus calme.
  let reports: Awaited<ReturnType<typeof latestAuditReports>> = [];
  if (ctx.isOwner) { try { reports = await latestAuditReports(); } catch { /* pas de diagnostic */ } }

  return (
    <Shell active="home" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      {ctx.isOwner && <WatchBanner customerId={accountInfo?.customerId} />}
      <PageHeader
        title="Aujourd'hui"
        lede={<>{ctx.mode === "live" ? "Données réelles" : "Mode démo"}{accountInfo ? <> · <strong>{accountInfo.name}</strong></> : null}. Tes comptes relus chaque matin, du plus urgent au plus calme.</>}
        actions={<>
          <Link className="ui-btn ui-btn-ghost" href={`/copilote${q}&q=${encodeURIComponent(AUDIT_PROMPT)}&auto=1`}>✦ Analyser avec l&apos;IA</Link>
          <Link className="ui-btn ui-btn-ghost" href="/waste">Diagnostic</Link>
          {ctx.isOwner && <Link className="ui-btn ui-btn-primary" href="/comptes">+ Lier des comptes</Link>}
        </>}
      />

      {ctx.isOwner && (
        <Panel title={<span className="op-h2">Comptes, du plus urgent au plus calme</span>} flush>
          {reports.length === 0 ? (
            <p className="dg-empty">Aucun diagnostic pour l&apos;instant : <Link href="/waste">lance le premier</Link>.</p>
          ) : (
            <div className="op-table-wrap" style={{ border: 0, boxShadow: "none", margin: 0, borderRadius: 0 }}>
              <table className="op-table">
                <thead><tr><th>Compte</th><th className="num">Santé</th><th className="num">Prioritaires</th><th className="num">À traiter</th><th className="num">Faible priorité</th><th className="num">À récupérer</th><th className="num">Dépense 30 j</th><th /></tr></thead>
                <tbody>
                  {reports.map((r) => {
                    const n = (sev: string) => r.constats.filter((c) => c.severity === sev).length;
                    return (
                      <tr key={r.customer_id}>
                        <td><Link href={`/waste?account=${r.customer_id}`} className="op-kw-text" style={{ color: "var(--text)" }}>{r.account_name ?? r.customer_id}</Link><div className="op-kw-sub">{r.customer_id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}</div></td>
                        <td className="num"><strong className={r.health_score >= 80 ? "op-good" : r.health_score >= 60 ? "" : "op-bad"}>{r.health_score}</strong></td>
                        <td className="num">{n("critique") ? <strong className="op-bad">{n("critique")}</strong> : 0}</td>
                        <td className="num">{n("important") ? <strong style={{ color: "#d97706" }}>{n("important")}</strong> : 0}</td>
                        <td className="num">{n("mineur")}</td>
                        <td className="num">{Number(r.waste_proven) > 0 ? <span className="op-bad">{Math.round(Number(r.waste_proven)).toLocaleString("fr-FR")} €</span> : "–"}</td>
                        <td className="num">{Number(r.total_cost).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                        <td><Link className="op-link" href={`/waste?account=${r.customer_id}`}>Ouvrir →</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {todo.length > 0 && (
        <Panel title={<span className="op-h2">À faire sur tes clients</span>} right={<Link href="/clients" className="op-link">Pipeline complet →</Link>} flush>
          {todo.map((t) => (
            <div key={t.id} className="op-hist" style={{ gridTemplateColumns: "minmax(140px, 1fr) auto 2fr" }}>
              <Link href={`/clients/${t.id}`} style={{ fontWeight: 600, color: "inherit" }}>{t.name}</Link>
              <span className="op-tag">{t.stage}</span>
              <Link href={t.href} className="op-link" style={{ whiteSpace: "normal" }}>→ {t.text}</Link>
            </div>
          ))}
        </Panel>
      )}

      {perf && <DashboardPerf d={perf.d} account={perf.account} accounts={perf.accounts} period={period} />}
      {perfError && <div className="card" style={{ marginBottom: 18, borderColor: "var(--red)", fontSize: 13 }}>Tableau de bord indisponible : {perfError.slice(0, 200)}</div>}

      {/* Usage API */}
      <UsageWidget />

    </Shell>
  );
}
