// Comptes liés : tous les comptes Google Ads accessibles, avec la dépense
// des 30 derniers jours, la dernière note du diagnostic et la surveillance
// (diagnostic du matin + rapport du lundi) activable compte par compte.
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { isLive, hasEnvAccount } from "@/lib/google-ads/config";
import { searchRaw } from "@/lib/google-ads/client";
import { ownerAccounts, isMonitored, latestAuditReports } from "@/lib/audit/run";
import { periodRange, frDate } from "@/lib/reports/periods";
import { toggleMonitoringAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const fmtId = (id: string) => id.replace(/^(\d{3})(\d{3})(\d+)$/, "$1-$2-$3");

interface Row {
  customerId: string; name: string; monitored: boolean;
  cost: number | null; conv: number; clicks: number; lastDay: string | null; error: string | null;
  score: number | null; scoreDate: string | null;
}

export default async function ComptesLies() {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");

  const range = periodRange("30");
  let rows: Row[] = [];
  let error: string | null = null;
  if (isLive() && !hasEnvAccount()) error = "Aucun compte Google Ads n'est relié. Branche-le depuis la page Connexions.";
  else {
    try {
      const [accounts, audits] = await Promise.all([ownerAccounts(), latestAuditReports().catch(() => [])]);
      rows = await Promise.all(accounts.map(async (a): Promise<Row> => {
        const audit = audits.find((r) => r.customer_id === a.customerId);
        const base: Row = {
          customerId: a.customerId, name: a.name, monitored: await isMonitored(a.customerId),
          cost: null, conv: 0, clicks: 0, lastDay: null, error: null,
          score: audit?.health_score ?? null, scoreDate: audit?.run_date ?? null,
        };
        if (!isLive()) return { ...base, cost: 0 };
        try {
          const daily = await searchRaw({ customerId: a.customerId },
            `SELECT segments.date, metrics.cost_micros, metrics.conversions, metrics.clicks FROM customer WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'`);
          let cost = 0, conv = 0, clicks = 0, lastDay: string | null = null;
          for (const r of daily) {
            const c = Number(r.metrics?.costMicros ?? 0) / 1e6;
            cost += c; conv += Number(r.metrics?.conversions ?? 0); clicks += Number(r.metrics?.clicks ?? 0);
            const d = String(r.segments?.date ?? "");
            if (c > 0 && (!lastDay || d > lastDay)) lastDay = d;
          }
          return { ...base, cost, conv, clicks, lastDay };
        } catch (e) {
          return { ...base, error: e instanceof Error ? e.message : String(e) };
        }
      }));
      rows.sort((x, y) => (y.cost ?? -1) - (x.cost ?? -1));
    } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }

  const active = rows.filter((r) => r.monitored).length;
  const total = rows.reduce((a, r) => a + (r.cost ?? 0), 0);

  return (
    <Shell active="comptes" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <h1 style={{ margin: "0 0 4px" }}>Comptes liés</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Les comptes Google Ads auxquels Stratyx a accès. Un compte surveillé passe dans le diagnostic du matin et le rapport du lundi ;
        coupe ceux qui ne dépensent plus pour garder des emails utiles.
      </p>
      {!isLive() && <div className="card" style={{ marginBottom: 12 }}>Mode démo : un seul compte fictif est affiché.</div>}

      {error ? <div className="card" style={{ borderColor: "var(--red)" }}>{error} <Link href="/connexions">Connexions</Link></div> : (
        <>
          <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 12 }}>
            <div><div className="subtitle" style={{ margin: 0, fontSize: 12 }}>COMPTES</div><div style={{ fontSize: 22, fontWeight: 700 }}>{rows.length}</div></div>
            <div><div className="subtitle" style={{ margin: 0, fontSize: 12 }}>SURVEILLÉS</div><div style={{ fontSize: 22, fontWeight: 700 }}>{active}</div></div>
            <div><div className="subtitle" style={{ margin: 0, fontSize: 12 }}>DÉPENSE 30 J (TOUS)</div><div style={{ fontSize: 22, fontWeight: 700 }}>{eur(total)}</div></div>
            <div><div className="subtitle" style={{ margin: 0, fontSize: 12 }}>PÉRIODE</div><div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{frDate(range.since)} → {frDate(range.until)}</div></div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r) => {
              const idle = r.cost === 0;
              return (
                <div key={r.customerId} className="card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", opacity: r.monitored ? 1 : 0.65 }}>
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                    <div className="subtitle" style={{ margin: 0, fontSize: 12 }}>
                      {fmtId(r.customerId)}
                      {r.lastDay ? ` · dernière dépense le ${frDate(r.lastDay)}` : idle ? " · aucune dépense sur 30 jours" : ""}
                    </div>
                    {r.error && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>Lecture impossible : {r.error.slice(0, 140)}</div>}
                  </div>
                  <div style={{ flex: "0 0 110px" }}>
                    <div className="subtitle" style={{ margin: 0, fontSize: 11 }}>DÉPENSE 30 J</div>
                    <div style={{ fontWeight: 700 }}>{r.cost === null ? "–" : eur(r.cost)}</div>
                  </div>
                  <div style={{ flex: "0 0 110px" }}>
                    <div className="subtitle" style={{ margin: 0, fontSize: 11 }}>CONVERSIONS</div>
                    <div style={{ fontWeight: 700 }}>{Math.round(r.conv * 10) / 10}{r.conv > 0 && r.cost ? <span className="subtitle" style={{ fontSize: 12, fontWeight: 400 }}> · {eur(r.cost / r.conv)}</span> : null}</div>
                  </div>
                  <div style={{ flex: "0 0 90px" }}>
                    <div className="subtitle" style={{ margin: 0, fontSize: 11 }}>SANTÉ</div>
                    <div style={{ fontWeight: 700, color: r.score === null ? undefined : r.score >= 80 ? "var(--green)" : r.score >= 60 ? undefined : "var(--red)" }}>
                      {r.score === null ? "–" : `${r.score}/100`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <Link className="btn-ghost" style={{ padding: "7px 10px", fontSize: 13 }} href={`/waste?account=${r.customerId}`}>Diagnostic</Link>
                    <Link className="btn-ghost" style={{ padding: "7px 10px", fontSize: 13 }} href={`/rapports/impact?account=${r.customerId}`}>Change Impact</Link>
                    <form action={toggleMonitoringAction}>
                      <input type="hidden" name="customer_id" value={r.customerId} />
                      <input type="hidden" name="on" value={r.monitored ? "0" : "1"} />
                      <button type="submit" className={r.monitored ? "" : "btn-ghost"} style={{ padding: "7px 12px", fontSize: 13, minWidth: 150 }}
                        title={r.monitored ? "Cliquer pour couper la surveillance" : "Cliquer pour activer la surveillance"}>
                        {r.monitored ? "● Surveillé" : "○ Non surveillé"}
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && <div className="card"><p className="subtitle" style={{ margin: 0 }}>Aucun compte client visible depuis le compte administrateur.</p></div>}
          </div>
          <p className="subtitle" style={{ fontSize: 11, marginTop: 12 }}>Chiffres lus dans Google Ads à l&apos;ouverture de la page, jusqu&apos;à hier inclus. La note de santé vient du dernier diagnostic.</p>
        </>
      )}
    </Shell>
  );
}
