// Bloc « tableau de bord » de l'accueil : période vs précédente, part
// d'impressions, rythme de dépense du mois. Composant serveur.
import Link from "next/link";
import type { ReactNode } from "react";
import type { Dashboard, Kpis } from "@/lib/dashboard";
import { frDate } from "@/lib/reports/periods";
import { setMonthlyBudgetAction } from "@/app/dashboard/actions";

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const eur2 = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pc = (x: number | null, d = 0) => (x === null ? "–" : `${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: d })} %`);
const n1 = (x: number) => (Math.round(x * 10) / 10).toLocaleString("fr-FR");

export const DASH_PERIODS = [
  { key: "7", label: "7 jours" },
  { key: "30", label: "30 jours" },
  { key: "mois", label: "Ce mois-ci" },
  { key: "mois-dernier", label: "Mois dernier" },
];

function Delta({ a, b, lowerIsBetter = false }: { a: number; b: number; lowerIsBetter?: boolean }) {
  if (!b || !Number.isFinite(a) || !Number.isFinite(b)) return <span className="subtitle" style={{ fontSize: 12, margin: 0 }}>–</span>;
  const d = (a - b) / b;
  const good = lowerIsBetter ? d < 0 : d > 0;
  const color = Math.abs(d) < 0.03 ? "var(--muted)" : good ? "var(--green)" : "var(--red)";
  return <span style={{ fontSize: 12, fontWeight: 600, color }}>{d >= 0 ? "▲" : "▼"} {Math.abs(Math.round(d * 100))} %</span>;
}

function Card({ label, value, delta, hint }: { label: string; value: string; delta: ReactNode; hint?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span className="subtitle" style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</span>
        {delta}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {hint && <div className="subtitle" style={{ margin: 0, fontSize: 12 }}>{hint}</div>}
    </div>
  );
}

function Bars({ daily }: { daily: Dashboard["daily"] }) {
  if (daily.length < 2) return null;
  const max = Math.max(...daily.map((d) => d.cost), 1);
  return (
    <div role="img" aria-label="Dépense et conversions par jour">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }}>
        {daily.map((d) => (
          <div key={d.date} title={`${frDate(d.date)} : ${eur(d.cost)}, ${n1(d.conv)} conv.`}
            style={{ flex: 1, minWidth: 2, height: `${Math.max(2, (d.cost / max) * 100)}%`, background: "var(--accent)", opacity: 0.6, borderRadius: "3px 3px 0 0" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 3, height: 12, marginTop: 4 }}>
        {daily.map((d) => (
          <div key={d.date} style={{ flex: 1, minWidth: 2, display: "flex", justifyContent: "center" }}>
            {d.conv > 0 && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)" }} />}
          </div>
        ))}
      </div>
      <div className="subtitle" style={{ display: "flex", justifyContent: "space-between", margin: 0, fontSize: 11 }}>
        <span>{frDate(daily[0].date)}</span><span>max {eur(max)}/jour</span><span>{frDate(daily[daily.length - 1].date)}</span>
      </div>
    </div>
  );
}

export default function DashboardPerf({ d, account, accounts, period }: {
  d: Dashboard; account: string; accounts: { customerId: string; name: string }[]; period: string;
}) {
  const href = (o: { account?: string; p?: string }) => `/dashboard?account=${o.account ?? account}&p=${o.p ?? period}`;
  const cpa = (k: Kpis) => (k.conv ? k.cost / k.conv : NaN);
  const cvr = (k: Kpis) => (k.clicks ? k.conv / k.clicks : 0);
  const ctr = (k: Kpis) => (k.impressions ? k.clicks / k.impressions : 0);
  const p = d.pacing;
  const ref = p.target ?? p.googleCap;
  const pctSpent = ref ? Math.min(1, p.spent / ref) : 0;
  const pctProj = ref ? Math.min(1, p.projection / ref) : 0;
  const pctTime = p.daysElapsed / p.daysInMonth;
  const ecart = p.target ? p.projection - p.target : null;
  // lead gen : Google met souvent 1 € par conversion par défaut ; ROAS affiché seulement si la valeur pèse
  const ecom = d.now.value > 0 && d.now.value >= d.now.cost * 0.1;

  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>Tableau de bord</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DASH_PERIODS.map((x) => <Link key={x.key} href={href({ p: x.key })} className={`pill ${x.key === period ? "ok" : ""}`}>{x.label}</Link>)}
        </div>
      </div>
      {accounts.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {accounts.map((a) => <Link key={a.customerId} href={href({ account: a.customerId })} className={`pill ${a.customerId === account ? "ok" : ""}`}>{a.name}</Link>)}
        </div>
      )}
      <p className="subtitle" style={{ margin: "0 0 10px", fontSize: 12 }}>
        Du {frDate(d.range.since)} au {frDate(d.range.until)}, comparé au {frDate(d.prev.since)} → {frDate(d.prev.until)}.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <Card label="Dépense" value={eur(d.now.cost)} delta={<Delta a={d.now.cost} b={d.before.cost} lowerIsBetter />} />
        <Card label="Conversions" value={n1(d.now.conv)} delta={<Delta a={d.now.conv} b={d.before.conv} />} />
        <Card label="Coût / conversion" value={d.now.conv ? eur(cpa(d.now)) : "–"} delta={<Delta a={cpa(d.now)} b={cpa(d.before)} lowerIsBetter />} />
        <Card label="Taux de conversion" value={pc(cvr(d.now), 1)} delta={<Delta a={cvr(d.now)} b={cvr(d.before)} />} />
        <Card label="Clics" value={d.now.clicks.toLocaleString("fr-FR")} delta={<Delta a={d.now.clicks} b={d.before.clicks} />} hint={`CPC ${d.now.clicks ? eur2(d.now.cost / d.now.clicks) : "–"}`} />
        <Card label="Taux de clic" value={pc(ctr(d.now), 1)} delta={<Delta a={ctr(d.now)} b={ctr(d.before)} />} hint={`${d.now.impressions.toLocaleString("fr-FR")} affichages`} />
        {ecom && <Card label="ROAS" value={d.now.cost ? `${n1(d.now.value / d.now.cost)}` : "–"} delta={<Delta a={d.now.value / (d.now.cost || 1)} b={d.before.value / (d.before.cost || 1)} />} hint={`${eur(d.now.value)} de valeur`} />}
      </div>
      {d.now.conv + d.before.conv < 10 && (
        <p className="subtitle" style={{ fontSize: 12, margin: "6px 0 0" }}>Moins de 10 conversions sur les deux périodes : les écarts de conversions et de CPA peuvent venir du hasard.</p>
      )}

      <div className="card" style={{ marginTop: 10 }}>
        <div className="subtitle" style={{ margin: "0 0 6px", fontSize: 12 }}>Dépense par jour · points verts : jours avec conversion</div>
        <Bars daily={d.daily} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 10, marginTop: 10 }}>
        {/* Budget du mois */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
            <strong>Budget du mois</strong>
            <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>jour {p.daysElapsed} / {p.daysInMonth}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{eur(p.spent)} <span className="subtitle" style={{ fontSize: 14, fontWeight: 400 }}>sur {p.target ? eur(p.target) : `${eur(p.googleCap)} max. Google`}</span></div>
          <div style={{ position: "relative", height: 10, borderRadius: 6, background: "var(--surface-2)", margin: "10px 0 6px", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, width: `${pctProj * 100}%`, background: "var(--accent)", opacity: 0.25 }} />
            <div style={{ position: "absolute", inset: 0, width: `${pctSpent * 100}%`, background: ecart !== null && ecart > 0 ? "var(--red)" : "var(--accent)" }} />
            <div title="Aujourd'hui" style={{ position: "absolute", top: -2, bottom: -2, left: `${pctTime * 100}%`, width: 2, background: "var(--text)" }} />
          </div>
          <div style={{ fontSize: 13 }}>
            Au rythme des 7 derniers jours ({eur(p.avgLast7)}/jour) : <strong>{eur(p.projection)}</strong> en fin de mois
            {ecart !== null && <> · <span style={{ color: Math.abs(ecart) < p.target! * 0.05 ? "var(--green)" : ecart > 0 ? "var(--red)" : "#f59e0b" }}>
              {Math.abs(ecart) < p.target! * 0.05 ? "dans la cible" : ecart > 0 ? `${eur(ecart)} au-dessus` : `${eur(-ecart)} en dessous`}</span></>}
            .
          </div>
          {p.target && (
            <div className="subtitle" style={{ margin: "4px 0 0", fontSize: 12 }}>
              Pour finir pile : {eur(Math.max(0, p.target - p.spent) / Math.max(1, p.daysInMonth - p.daysElapsed + 1))}/jour jusqu&apos;à la fin du mois. Budgets quotidiens actuels : {eur(p.dailyBudgets)}/jour.
            </div>
          )}
          <form action={setMonthlyBudgetAction} style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
            <input type="hidden" name="customer_id" value={account} />
            <input name="amount" inputMode="decimal" placeholder="Budget mensuel, ex. 1000" defaultValue={p.target ?? ""} style={{ padding: "7px 10px", fontSize: 13, maxWidth: 200 }} />
            <button type="submit" className="btn-ghost" style={{ padding: "7px 12px", fontSize: 13 }}>{p.target ? "Modifier" : "Définir"}</button>
          </form>
        </div>

        {/* Part d'impressions */}
        <div className="card">
          <strong>Part d&apos;impressions (Search)</strong>
          {d.share.impressionShare === null ? (
            <p className="subtitle" style={{ fontSize: 13 }}>Pas de campagne Search sur la période.</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 22, marginTop: 8, flexWrap: "wrap" }}>
                <div><div className="subtitle" style={{ margin: 0, fontSize: 11 }}>OBTENUE</div><div style={{ fontSize: 24, fontWeight: 700 }}>{pc(d.share.impressionShare)}</div></div>
                <div><div className="subtitle" style={{ margin: 0, fontSize: 11 }}>PERDUE (BUDGET)</div><div style={{ fontSize: 24, fontWeight: 700, color: (d.share.lostBudget ?? 0) > 0.15 ? "#f59e0b" : undefined }}>{pc(d.share.lostBudget)}</div></div>
                <div><div className="subtitle" style={{ margin: 0, fontSize: 11 }}>PERDUE (CLASSEMENT)</div><div style={{ fontSize: 24, fontWeight: 700, color: (d.share.lostRank ?? 0) > 0.3 ? "#f59e0b" : undefined }}>{pc(d.share.lostRank)}</div></div>
              </div>
              <p className="subtitle" style={{ fontSize: 12, margin: "6px 0 8px" }}>
                {(d.share.lostBudget ?? 0) > 0.15
                  ? "Tes annonces s'arrêtent souvent faute de budget : plus de budget, ou un ciblage plus serré, ramènerait du volume."
                  : (d.share.lostRank ?? 0) > 0.3
                    ? "Tu perds surtout au classement : enchères ou qualité des annonces et des pages à travailler."
                    : "Tu es affiché sur l'essentiel des recherches visées."}
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr>{["Campagne", "Obtenue", "Budget", "Classement"].map((h, i) => <th key={h} style={{ textAlign: i ? "right" : "left", padding: "4px 0", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {d.share.campaigns.map((c) => (
                    <tr key={c.name}>
                      <td style={{ padding: "4px 8px 4px 0", borderBottom: "1px solid var(--border)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</td>
                      <td style={{ textAlign: "right", borderBottom: "1px solid var(--border)" }}>{pc(c.impressionShare)}</td>
                      <td style={{ textAlign: "right", borderBottom: "1px solid var(--border)" }}>{pc(c.lostBudget)}</td>
                      <td style={{ textAlign: "right", borderBottom: "1px solid var(--border)" }}>{pc(c.lostRank)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
      {d.errors.length > 0 && <p className="subtitle" style={{ fontSize: 11 }}>Lectures incomplètes : {d.errors.map((e) => e.slice(0, 100)).join(" · ")}</p>}
    </section>
  );
}
