// Comptes et réglages : tous les comptes publicitaires gérés (MCC ou accès direct), dépense 30 jours,
// santé, surveillance, compte par défaut ; synchronisation et invitation depuis le MCC ; connecteur Claude.
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import AdsMark from "@/components/AdsMark";
import SubmitButton from "@/components/SubmitButton";
import McpUrlBox from "@/components/McpUrlBox";
import CampaignSelector from "@/components/CampaignSelector";
import { getDashboardContext } from "@/lib/workspace";
import { getAppUrl } from "@/lib/app-url";
import { INTERNAL_MODE } from "@/lib/internal";
import { getSetting } from "@/lib/agent/store";
import { adsConfig, isLive, hasEnvAccount } from "@/lib/google-ads/config";
import { searchRaw, listPendingInvites } from "@/lib/google-ads/client";
import { ownerAccounts, isMonitored, latestAuditReports } from "@/lib/audit/run";
import { periodRange, frDate } from "@/lib/reports/periods";
import { toggleMonitoringAction, setDefaultAccountAction, syncAccountsAction, inviteAccountAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const fmtId = (id: string) => id.replace(/^(\d{3})(\d{3})(\d+)$/, "$1-$2-$3");
type SP = Promise<{ msg?: string; err?: string }>;

interface Row {
  customerId: string; name: string; monitored: boolean; direct: boolean;
  cost: number | null; conv: number; lastDay: string | null; error: string | null; score: number | null;
}

export default async function ComptesPage({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/connexions");
  const sp = await searchParams;

  const range = periodRange("30");
  let rows: Row[] = [];
  let error: string | null = null;
  let pending: { customerId: string }[] = [];
  const defaultId = (await getSetting("default_customer_id")) || adsConfig.customerId;

  if (isLive() && !hasEnvAccount()) error = "Aucun compte Google Ads n'est relié : vérifie les variables Google Ads dans Vercel (Bilan de santé).";
  else {
    try {
      const [accounts, audits, inv] = await Promise.all([ownerAccounts(), latestAuditReports().catch(() => []), listPendingInvites().catch(() => [])]);
      pending = inv;
      rows = await Promise.all(accounts.map(async (a): Promise<Row> => {
        const audit = audits.find((r) => r.customer_id === a.customerId);
        const base: Row = { customerId: a.customerId, name: a.name, direct: a.source === "direct", monitored: await isMonitored(a.customerId), cost: null, conv: 0, lastDay: null, error: null, score: audit?.health_score ?? null };
        if (!isLive()) return { ...base, cost: 0 };
        try {
          const daily = await searchRaw({ customerId: a.customerId },
            `SELECT segments.date, metrics.cost_micros, metrics.conversions FROM customer WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`);
          let cost = 0, conv = 0, lastDay: string | null = null;
          for (const r of daily) {
            const c = Number(r.metrics?.costMicros ?? 0) / 1e6;
            cost += c; conv += Number(r.metrics?.conversions ?? 0);
            const d = String(r.segments?.date ?? "");
            if (c > 0 && (!lastDay || d > lastDay)) lastDay = d;
          }
          return { ...base, cost, conv, lastDay };
        } catch (e) { return { ...base, error: e instanceof Error ? e.message : String(e) }; }
      }));
      rows.sort((x, y) => Number(y.customerId === defaultId) - Number(x.customerId === defaultId) || (y.cost ?? -1) - (x.cost ?? -1));
    } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }

  const monitored = rows.filter((r) => r.monitored).length;
  const total = rows.reduce((a, r) => a + (r.cost ?? 0), 0);
  const withSpend = rows.filter((r) => (r.cost ?? 0) > 0).length;
  const known = new Set(rows.map((r) => r.customerId));
  const waiting = pending.filter((p) => !known.has(p.customerId));
  const pct = (a: number, b: number) => `${b ? Math.round((a / b) * 100) : 0}%`;

  return (
    <Shell active="comptes" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 4px" }}>Comptes et réglages</h1>
          <p className="subtitle" style={{ margin: 0 }}>Les comptes publicitaires que tu gères{adsConfig.loginCustomerId ? `, via ton MCC ${fmtId(adsConfig.loginCustomerId)}` : ""}.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form action={syncAccountsAction}><SubmitButton className="btn-ghost" pending="Lecture...">Synchroniser</SubmitButton></form>
          <details className="acc-invite">
            <summary className="btn-ghost"><AdsMark size={15} /> Inviter un compte</summary>
            <form action={inviteAccountAction} className="card acc-invite-pop">
              <strong>Associer un compte à ton MCC</strong>
              <span className="subtitle" style={{ margin: 0, fontSize: 13 }}>Tape l&apos;identifiant du compte du client (questionnaire ou en haut de son Google Ads). Il recevra une demande à accepter dans Google Ads.</span>
              <input name="customer_id" placeholder="123-456-7890" inputMode="numeric" required className="acc-input" />
              <SubmitButton pending="Envoi...">Envoyer l&apos;invitation</SubmitButton>
            </form>
          </details>
          <span className="pill" style={{ alignSelf: "center", opacity: 0.7 }}>Meta Ads · bientôt</span>
        </div>
      </div>

      {sp.msg && <div className="card" style={{ borderColor: "var(--green)", marginTop: 14 }}>{sp.msg}</div>}
      {sp.err && <div className="card" style={{ borderColor: "var(--red)", marginTop: 14 }}>{sp.err}</div>}
      {!isLive() && <div className="card" style={{ marginTop: 14 }}>Mode démo : un seul compte fictif est affiché.</div>}

      {error ? <div className="card" style={{ borderColor: "var(--red)", marginTop: 14 }}>{error}</div> : (
        <>
          <div className="acc-kpis">
            <div className="card">
              <div className="acc-k">Comptes</div>
              <div className="acc-v">{rows.length} <span>client{rows.length > 1 ? "s" : ""}</span></div>
              <div className="acc-bar"><i style={{ width: pct(monitored, rows.length) }} /></div>
              <div className="acc-s">{monitored} surveillé{monitored > 1 ? "s" : ""}{waiting.length ? ` · ${waiting.length} invitation${waiting.length > 1 ? "s" : ""} en attente` : ""}</div>
            </div>
            <div className="card">
              <div className="acc-k">Dépenses · 30 j</div>
              <div className="acc-v">{eur(total)}</div>
              <div className="acc-bar"><i style={{ width: pct(withSpend, rows.length) }} /></div>
              <div className="acc-s">{withSpend} compte{withSpend > 1 ? "s" : ""} actif{withSpend > 1 ? "s" : ""} sur {rows.length} · du {frDate(range.since)} au {frDate(range.until)}</div>
            </div>
          </div>

          <h2 style={{ fontSize: 17, margin: "22px 0 10px" }}>Comptes</h2>
          <div className="card acc-table-wrap">
            <table className="acc-table">
              <thead><tr>
                <th>Nom du compte</th><th>Identifiant</th><th className="r">Dépense 30 j</th><th className="r">Conv.</th><th className="r">Santé</th>
                <th>Connexion</th><th>Plateforme</th><th>Surveillance</th><th />
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const isDef = r.customerId === defaultId;
                  return (
                    <tr key={r.customerId} className={r.monitored ? "" : "off"}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {isDef ? <span className="acc-star on" title="Compte par défaut">★</span> : (
                            <form action={setDefaultAccountAction}><input type="hidden" name="customer_id" value={r.customerId} />
                              <button type="submit" className="acc-star" title="Définir comme compte par défaut">☆</button></form>
                          )}
                          <strong style={{ fontWeight: 600 }}>{r.name}</strong>
                        </div>
                        {isDef && <div className="acc-s" style={{ marginLeft: 22 }}>compte par défaut</div>}
                        {r.error && <div style={{ color: "var(--red)", fontSize: 12, marginLeft: 22 }}>Lecture impossible : {r.error.slice(0, 90)}</div>}
                      </td>
                      <td className="mono">{fmtId(r.customerId)}</td>
                      <td className="r">{r.cost === null ? "–" : r.cost === 0 ? <span className="acc-s">aucune</span> : eur(r.cost)}</td>
                      <td className="r">{r.conv ? Math.round(r.conv * 10) / 10 : "–"}{r.conv > 0 && r.cost ? <div className="acc-s">{eur(r.cost / r.conv)} / conv.</div> : null}</td>
                      <td className="r" style={{ fontWeight: 700, color: r.score === null ? undefined : r.score >= 80 ? "var(--green)" : r.score >= 60 ? undefined : "var(--red)" }}>{r.score === null ? "–" : r.score}</td>
                      <td><span className="acc-pill">● {r.direct ? "Accès direct" : "MCC"}</span></td>
                      <td><span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><AdsMark size={15} /> Google Ads</span></td>
                      <td>
                        <form action={toggleMonitoringAction}>
                          <input type="hidden" name="customer_id" value={r.customerId} />
                          <input type="hidden" name="on" value={r.monitored ? "0" : "1"} />
                          <button type="submit" className={`acc-switch${r.monitored ? " on" : ""}`} aria-pressed={r.monitored}
                            title={r.monitored ? "Surveillé : diagnostic du matin et rapport du lundi. Cliquer pour couper." : "Non surveillé. Cliquer pour activer."}><i /></button>
                        </form>
                      </td>
                      <td className="r"><Link href={`/waste?account=${r.customerId}`} className="acc-open">Ouvrir →</Link></td>
                    </tr>
                  );
                })}
                {waiting.map((p) => (
                  <tr key={`inv-${p.customerId}`} className="off">
                    <td><span style={{ marginLeft: 22 }}>Invitation envoyée</span></td>
                    <td className="mono">{fmtId(p.customerId)}</td>
                    <td className="r">–</td><td className="r">–</td><td className="r">–</td>
                    <td><span className="acc-pill wait">● En attente</span></td>
                    <td><span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><AdsMark size={15} /> Google Ads</span></td>
                    <td /><td />
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={9} className="acc-s">Aucun compte visible depuis ton MCC.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="subtitle" style={{ fontSize: 12, marginTop: 10 }}>
            ★ Compte par défaut : utilisé quand aucun client n&apos;est sélectionné. Surveillance : le compte passe dans le diagnostic du matin et le rapport du lundi. Chiffres jusqu&apos;à hier inclus, note de santé du dernier diagnostic.
          </p>
        </>
      )}

      <details className="card" style={{ marginTop: 20 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Campagnes de travail du copilote</summary>
        <p className="subtitle" style={{ fontSize: 13 }}>Les campagnes sur lesquelles travaillent le copilote et les agents, pour le compte actif. Par défaut : toutes.</p>
        <CampaignSelector token={ctx.mcpToken} accountName={ctx.defaultAccountName ?? ""} />
      </details>
      <details className="card" style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Connecteur Claude</summary>
        <p className="subtitle" style={{ fontSize: 13 }}>Pour utiliser Stratyx depuis Claude.ai : Réglages, Connecteurs, Ajouter un connecteur personnalisé, puis colle cette adresse. Ne la partage pas.</p>
        <McpUrlBox url={`${getAppUrl()}/api/mcp?token=${ctx.mcpToken}`} />
        <p className="subtitle" style={{ fontSize: 13, marginBottom: 0 }}>Connecteurs officiels à ajouter à côté (Meta, etc.) : <Link href="/connexions">voir la page des connecteurs</Link>.</p>
      </details>
      {!INTERNAL_MODE && <p style={{ marginTop: 16 }}><Link className="btn-ghost" href="/admin">Administration des abonnés</Link></p>}
    </Shell>
  );
}
