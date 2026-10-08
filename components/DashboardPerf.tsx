// Bloc « tableau de bord » de l'accueil, façon Ades : indicateurs période vs
// précédente (chacun explicable par l'IA), courbes par métrique, courbes
// croisées, appareils, budget du mois, part d'impressions, position.
// Composant serveur ; les graphiques interactifs sont dans DashCharts (client).
import Link from "next/link";
import type { ReactNode } from "react";
import type { Dashboard, Kpis } from "@/lib/dashboard";
import { frDate } from "@/lib/reports/periods";
import { setMonthlyBudgetAction } from "@/app/dashboard/actions";
import { MetricCharts, CrossChart, DevicesDonut, ShareDaily, Position, type MetricKey } from "@/components/DashCharts";

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const eur2 = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pc = (x: number | null, d = 1) => (x === null || !Number.isFinite(x) ? "–" : `${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: d })} %`);
const n1 = (x: number) => (Math.round(x * 10) / 10).toLocaleString("fr-FR");

export const DASH_PERIODS = [
  { key: "7", label: "7 jours" },
  { key: "14", label: "14 jours" },
  { key: "30", label: "30 jours" },
  { key: "mois", label: "Ce mois-ci" },
  { key: "mois-dernier", label: "Mois dernier" },
  { key: "90", label: "90 jours" },
];

function Delta({ a, b, lowerIsBetter = false }: { a: number; b: number; lowerIsBetter?: boolean }) {
  if (!b || !Number.isFinite(a) || !Number.isFinite(b)) return <span className="dash-delta">–</span>;
  const d = (a - b) / b;
  const good = lowerIsBetter ? d < 0 : d > 0;
  const color = Math.abs(d) < 0.03 ? "var(--muted)" : good ? "var(--green)" : "var(--red)";
  return <span className="dash-delta" style={{ color }}>{d >= 0 ? "+" : "−"}{Math.abs(Math.round(d * 100))} %</span>;
}

/** Écart en points (pour les parts en %). */
function DeltaPts({ a, b, lowerIsBetter = false }: { a: number | null; b: number | null; lowerIsBetter?: boolean }) {
  if (a === null || b === null) return <span className="dash-delta">–</span>;
  const d = (a - b) * 100;
  const good = lowerIsBetter ? d < 0 : d > 0;
  const color = Math.abs(d) < 0.5 ? "var(--muted)" : good ? "var(--green)" : "var(--red)";
  return <span className="dash-delta" style={{ color }}>{d >= 0 ? "+" : "−"}{Math.abs(d).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts</span>;
}

function Card({ label, value, delta, hint, href }: { label: string; value: string; delta: ReactNode; hint?: string; href: string }) {
  return (
    <Link href={href} className="card interactive dash-kpi" title="Expliquer cette évolution avec l'IA">
      <div className="dash-kpi-head">
        <span className="dash-kicker">{label}</span>
        {delta}
      </div>
      <div className="dash-kpi-value">{value}</div>
      <div className="dash-kpi-foot">
        <span>{hint ?? ""}</span>
        <span className="dash-ia-mini">✦ Expliquer</span>
      </div>
    </Link>
  );
}

export default function DashboardPerf({ d, account, accounts, period }: {
  d: Dashboard; account: string; accounts: { customerId: string; name: string }[]; period: string;
}) {
  const href = (o: { account?: string; p?: string }) => `/dashboard?account=${o.account ?? account}&p=${o.p ?? period}`;
  const cpa = (k: Kpis) => (k.conv ? k.cost / k.conv : NaN);
  const cpc = (k: Kpis) => (k.clicks ? k.cost / k.clicks : NaN);
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
  const sh = d.share, sb = d.share.before;
  const accountName = accounts.find((a) => a.customerId === account)?.name ?? account;

  // Lien « Expliquer avec l'IA » : ouvre le Copilote et pose la question tout de suite.
  const ia = (label: string, now: string, before: string) => {
    const q = `Explique l'évolution de « ${label} » du ${frDate(d.range.since)} au ${frDate(d.range.until)} (${now}) par rapport à la période précédente du ${frDate(d.prev.since)} au ${frDate(d.prev.until)} (${before}), sur le compte ${accountName} (${account}) : quelles campagnes, quels appareils ou quelles modifications l'expliquent, et que faire.`;
    return `/copilote?q=${encodeURIComponent(q)}&auto=1`;
  };
  const iaShare = (label: string, a: number | null, b: number | null) => ia(label, pc(a), pc(b));

  const iaCharts: Partial<Record<MetricKey, string>> = {
    cost: ia("Dépense", eur(d.now.cost), eur(d.before.cost)),
    clicks: ia("Clics", String(d.now.clicks), String(d.before.clicks)),
    conv: ia("Conversions", n1(d.now.conv), n1(d.before.conv)),
    cpc: ia("CPC moyen", eur2(cpc(d.now) || 0), eur2(cpc(d.before) || 0)),
    ctr: ia("CTR", pc(ctr(d.now)), pc(ctr(d.before))),
    cvr: ia("Taux de conversion", pc(cvr(d.now)), pc(cvr(d.before))),
  };

  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>Tableau de bord</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {DASH_PERIODS.map((x) => <Link key={x.key} href={href({ p: x.key })} className={`pill ${x.key === period ? "ok" : ""}`}>{x.label}</Link>)}
          <Link href={ia("l'ensemble du compte", `${eur(d.now.cost)} dépensés, ${n1(d.now.conv)} conversions`, `${eur(d.before.cost)} dépensés, ${n1(d.before.conv)} conversions`)}
            className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }}>✦ Analyser avec l&apos;IA</Link>
        </div>
      </div>
      {accounts.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {accounts.map((a) => <Link key={a.customerId} href={href({ account: a.customerId })} className={`pill ${a.customerId === account ? "ok" : ""}`}>{a.name}</Link>)}
        </div>
      )}
      <p className="subtitle" style={{ margin: "0 0 10px", fontSize: 12 }}>
        Du {frDate(d.range.since)} au {frDate(d.range.until)}, comparé au {frDate(d.prev.since)} → {frDate(d.prev.until)}. Clique sur un indicateur pour que l&apos;IA explique son évolution.
      </p>

      <div className="dash-kpis">
        <Card label="Dépense" value={eur(d.now.cost)} delta={<Delta a={d.now.cost} b={d.before.cost} lowerIsBetter />} href={iaCharts.cost!} />
        <Card label="Impressions" value={d.now.impressions.toLocaleString("fr-FR")} delta={<Delta a={d.now.impressions} b={d.before.impressions} />}
          href={ia("Impressions", String(d.now.impressions), String(d.before.impressions))} />
        <Card label="Clics" value={d.now.clicks.toLocaleString("fr-FR")} delta={<Delta a={d.now.clicks} b={d.before.clicks} />} href={iaCharts.clicks!} />
        <Card label="CTR" value={pc(ctr(d.now))} delta={<Delta a={ctr(d.now)} b={ctr(d.before)} />} href={iaCharts.ctr!} />
        <Card label="CPC moyen" value={d.now.clicks ? eur2(cpc(d.now)) : "–"} delta={<Delta a={cpc(d.now)} b={cpc(d.before)} lowerIsBetter />} href={iaCharts.cpc!} />
        <Card label="Conversions" value={n1(d.now.conv)} delta={<Delta a={d.now.conv} b={d.before.conv} />} href={iaCharts.conv!} />
        <Card label="Taux de conversion" value={pc(cvr(d.now))} delta={<Delta a={cvr(d.now)} b={cvr(d.before)} />} href={iaCharts.cvr!} />
        <Card label="Coût / conversion" value={d.now.conv ? eur(cpa(d.now)) : "–"} delta={<Delta a={cpa(d.now)} b={cpa(d.before)} lowerIsBetter />}
          href={ia("Coût par conversion", d.now.conv ? eur(cpa(d.now)) : "–", d.before.conv ? eur(cpa(d.before)) : "–")} />
        {sh.impressionShare !== null && <>
          <Card label="Part d'impressions" value={pc(sh.impressionShare)} delta={<DeltaPts a={sh.impressionShare} b={sb.share} />} href={iaShare("Part d'impressions", sh.impressionShare, sb.share)} />
          <Card label="Part perdue (budget)" value={pc(sh.lostBudget)} delta={<DeltaPts a={sh.lostBudget} b={sb.lostBudget} lowerIsBetter />} href={iaShare("Part perdue (budget)", sh.lostBudget, sb.lostBudget)} />
          <Card label="Part perdue (classement)" value={pc(sh.lostRank)} delta={<DeltaPts a={sh.lostRank} b={sb.lostRank} lowerIsBetter />} href={iaShare("Part perdue (classement)", sh.lostRank, sb.lostRank)} />
        </>}
        {sh.top !== null && <>
          <Card label="Impr. en haut de page" value={pc(sh.top)} delta={<DeltaPts a={sh.top} b={sb.top} />} href={iaShare("Impressions en haut de page", sh.top, sb.top)} />
          <Card label="Impr. en 1re position" value={pc(sh.absTop)} delta={<DeltaPts a={sh.absTop} b={sb.absTop} />} href={iaShare("Impressions en 1re position", sh.absTop, sb.absTop)} />
        </>}
        {ecom && <>
          <Card label="Valeur des conversions" value={eur(d.now.value)} delta={<Delta a={d.now.value} b={d.before.value} />} href={ia("Valeur des conversions", eur(d.now.value), eur(d.before.value))} />
          <Card label="ROAS" value={d.now.cost ? `${n1(d.now.value / d.now.cost)}×` : "–"} delta={<Delta a={d.now.value / (d.now.cost || 1)} b={d.before.value / (d.before.cost || 1)} />}
            href={ia("ROAS", `${n1(d.now.value / (d.now.cost || 1))}×`, `${n1(d.before.value / (d.before.cost || 1))}×`)} />
        </>}
      </div>
      {d.now.conv + d.before.conv < 10 && (
        <p className="subtitle" style={{ fontSize: 12, margin: "6px 0 0" }}>Moins de 10 conversions sur les deux périodes : les écarts de conversions et de CPA peuvent venir du hasard.</p>
      )}

      <div style={{ marginTop: 16 }}>
        <MetricCharts cur={d.series.cur} prev={d.series.prev} ia={iaCharts} />
      </div>

      <CrossChart cur={d.series.cur} />

      <div className="dash-two">
        <DevicesDonut devices={d.devices} ia={ia("la répartition par appareil", d.devices.map((x) => `${x.label} ${x.clicks} clics`).join(", "), "période précédente")} />

        {/* Budget du mois */}
        <div className="card">
          <div className="dash-chart-head">
            <span className="dash-kicker">Budget du mois</span>
            <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>jour {p.daysElapsed} / {p.daysInMonth}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{eur(p.spent)} <span className="subtitle" style={{ fontSize: 14, fontWeight: 400 }}>sur {p.target ? eur(p.target) : `${eur(p.googleCap)} max. Google`}</span></div>
          <div style={{ position: "relative", height: 10, borderRadius: 6, background: "var(--surface-2)", margin: "10px 0 6px", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, width: `${pctProj * 100}%`, background: "var(--accent)", opacity: 0.25 }} />
            <div style={{ position: "absolute", inset: 0, width: `${pctSpent * 100}%`, background: ecart !== null && p.target && ecart > p.target * 0.05 ? "var(--red)" : "var(--accent)" }} />
            <div title="Aujourd'hui" style={{ position: "absolute", top: -2, bottom: -2, left: `${pctTime * 100}%`, width: 2, background: "var(--text)" }} />
          </div>
          {p.target && (() => {
            const ratio = p.projection / p.target;
            const pos = Math.max(0, Math.min(1, (ratio - 0.5) / 1));
            const label = Math.abs(ratio - 1) < 0.05 ? "Sur la cible" : ratio > 1 ? "Sur-dépense" : "Sous-dépense";
            const col = Math.abs(ratio - 1) < 0.05 ? "var(--green)" : ratio > 1 ? "var(--red)" : "var(--orange-dark)";
            return (
              <div style={{ margin: "10px 0 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span className="subtitle" style={{ margin: 0 }}>Rythme de dépense (projection fin de mois)</span>
                  <strong style={{ color: col }}>{label} · {Math.round(ratio * 100)} %</strong>
                </div>
                <div className="dash-gauge"><i style={{ left: `${pos * 100}%` }} /></div>
                <div className="subtitle" style={{ display: "flex", justifyContent: "space-between", margin: 0, fontSize: 11 }}>
                  <span>Sous-dépense</span><span>Sur la cible</span><span>Sur-dépense</span>
                </div>
              </div>
            );
          })()}
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
      </div>

      <ShareDaily daily={sh.daily} got={sh.got} missedBudget={sh.missedBudget} missedRank={sh.missedRank}
        ia={iaShare("Part d'impressions", sh.impressionShare, sb.share)}>
        <p className="subtitle" style={{ fontSize: 12, margin: "10px 0 6px" }}>
          {(sh.lostBudget ?? 0) > 0.15
            ? "Tes annonces s'arrêtent souvent faute de budget : plus de budget, ou un ciblage plus serré, ramènerait du volume."
            : (sh.lostRank ?? 0) > 0.3
              ? "Tu perds surtout au classement : enchères ou qualité des annonces et des pages à travailler."
              : "Tu es affiché sur l'essentiel des recherches visées."}
          {" "}Les « manqué » sont des estimations : impressions perdues × ton taux de clic × ton taux de conversion.
        </p>
        {sh.campaigns.length > 0 && (
          <details>
            <summary style={{ cursor: "pointer", fontSize: 13 }}>Détail par campagne</summary>
            <table className="dash-table" style={{ marginTop: 6 }}>
              <thead><tr><th>Campagne</th><th>Obtenue</th><th>Perdue budget</th><th>Perdue classement</th></tr></thead>
              <tbody>
                {sh.campaigns.map((c) => (
                  <tr key={c.name}>
                    <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</td>
                    <td>{pc(c.impressionShare)}</td><td>{pc(c.lostBudget)}</td><td>{pc(c.lostRank)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </ShareDaily>

      <Position top={sh.top} absTop={sh.absTop} daily={sh.daily} ia={iaShare("Impressions en haut de page", sh.top, sb.top)} />

      {d.errors.length > 0 && <p className="subtitle" style={{ fontSize: 11 }}>Lectures incomplètes : {d.errors.map((e) => e.slice(0, 100)).join(" · ")}</p>}
    </section>
  );
}
