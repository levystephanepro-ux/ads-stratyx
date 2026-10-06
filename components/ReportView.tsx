// Rendu d'un rapport client (aperçu dans l'app, lien public, impression PDF).
// Composant serveur pur : reçoit des données déjà calculées.
import type { ReportData, Totals } from "@/lib/reports/data";
import { frDate } from "@/lib/reports/periods";
import { CHANGE_KINDS } from "@/lib/reports/changes";

export interface ReportMeta {
  title: string;
  accountName: string;
  customerId: string;
  author: string | null;
  mode: string;   // leadgen | ecom
  theme: string;  // clair | sombre
  compare: boolean;
  sections: string[];
  intro: string | null;
  analysis: string | null;
  optimisations: string | null;
}

const eur = (n: number, d = 0) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} €`;
const eur2 = (n: number) => eur(n, n < 100 ? 2 : 0);
const pct = (x: number | null) => (x === null || !Number.isFinite(x) ? "–" : `${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);
const div = (a: number, b: number) => (b > 0 ? a / b : null);
const CHANNEL: Record<string, string> = { SEARCH: "Réseau de Recherche", PERFORMANCE_MAX: "Performance Max", DISPLAY: "Display", VIDEO: "YouTube", DEMAND_GEN: "Demand Gen", SHOPPING: "Shopping", LOCAL_SERVICES: "Local Services", MULTI_CHANNEL: "Applications" };

function Delta({ now, before, invert = false, show }: { now: number | null; before: number | null; invert?: boolean; show: boolean }) {
  if (!show || now === null || before === null || before === 0) return null;
  const d = (now - before) / before;
  const good = invert ? d < 0 : d > 0;
  return (
    <span className="rv-delta" data-good={good ? "1" : "0"}>
      {d > 0 ? "▲" : "▼"} {Math.abs(Math.round(d * 100))} %
    </span>
  );
}

function Spark({ values, height = 46 }: { values: number[]; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 300;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - (v / max) * (height - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="rv-spark" aria-hidden="true">
      <polyline points={`0,${height} ${pts} ${w},${height}`} className="rv-spark-area" />
      <polyline points={pts} className="rv-spark-line" />
    </svg>
  );
}

function Chart({ title, values, labels, fmt }: { title: string; values: number[]; labels: string[]; fmt: (n: number) => string }) {
  const h = 160, w = 600;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${values.length > 1 ? (i / (values.length - 1)) * w : 0},${h - (v / max) * (h - 10) - 5}`).join(" ");
  return (
    <div className="rv-card">
      <div className="rv-label">{title}</div>
      <div className="rv-chart-max">{fmt(max)}</div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="rv-chart" role="img" aria-label={title}>
        <polyline points={`0,${h} ${pts} ${w},${h}`} className="rv-spark-area" />
        <polyline points={pts} className="rv-spark-line" />
      </svg>
      <div className="rv-axis"><span>{labels[0] ? frDate(labels[0]) : ""}</span><span>{labels.at(-1) ? frDate(labels.at(-1)!) : ""}</span></div>
    </div>
  );
}

export default function ReportView({ meta, data }: { meta: ReportMeta; data: ReportData }) {
  const s = new Set(meta.sections);
  const ecom = meta.mode === "ecom";
  const n = data.now, b = data.before;
  const cpa = div(n.cost, n.conversions), cpaB = div(b.cost, b.conversions);
  const roas = div(n.value, n.cost), roasB = div(b.value, b.cost);
  let num = 0;
  const H = ({ children }: { children: React.ReactNode }) => <h2 className="rv-h2"><span className="rv-num">{++num}</span>{children}</h2>;
  const series = (f: (t: Totals) => number) => data.daily.map((d) => f(d.t));

  const kpis: { label: string; value: string; sub: string; now: number | null; before: number | null; invert?: boolean; spark: number[] }[] = [
    { label: "Investissement", value: eur2(n.cost), sub: "dépense publicitaire", now: n.cost, before: b.cost, invert: true, spark: series((t) => t.cost) },
    ecom
      ? { label: "Valeur des ventes", value: eur2(n.value), sub: "chiffre d'affaires mesuré", now: n.value, before: b.value, spark: series((t) => t.value) }
      : { label: "Conversions", value: n.conversions.toLocaleString("fr-FR", { maximumFractionDigits: 1 }), sub: "leads ou actions mesurées", now: n.conversions, before: b.conversions, spark: series((t) => t.conversions) },
    ecom
      ? { label: "ROAS", value: roas === null ? "–" : `${roas.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ×`, sub: "valeur ÷ dépense", now: roas, before: roasB, spark: [] }
      : { label: "Coût par conversion", value: cpa === null ? "–" : eur2(cpa), sub: "ce que coûte un résultat", now: cpa, before: cpaB, invert: true, spark: [] },
    { label: "Taux de conversion", value: pct(div(n.conversions, n.clicks)), sub: "conversions ÷ clics", now: div(n.conversions, n.clicks), before: div(b.conversions, b.clicks), spark: [] },
    { label: "Clics", value: n.clicks.toLocaleString("fr-FR"), sub: "visites depuis les annonces", now: n.clicks, before: b.clicks, spark: series((t) => t.clicks) },
    { label: "Affichages", value: n.impressions.toLocaleString("fr-FR"), sub: "fois où les annonces sont apparues", now: n.impressions, before: b.impressions, spark: series((t) => t.impressions) },
    { label: "Taux de clic", value: pct(div(n.clicks, n.impressions)), sub: "clics ÷ affichages", now: div(n.clicks, n.impressions), before: div(b.clicks, b.impressions), spark: [] },
  ];

  return (
    <article className="rv" data-theme={meta.theme === "sombre" ? "dark" : "light"}>
      <header className="rv-head">
        <div className="rv-kicker">Rapport de performance Google Ads</div>
        <h1 className="rv-title">{meta.title || meta.accountName}</h1>
        <div className="rv-meta">
          {meta.accountName} · {meta.customerId.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")} · du {frDate(data.range.since)} au {frDate(data.range.until)}
          {meta.compare ? ` (vs ${frDate(data.prev.since)} → ${frDate(data.prev.until)})` : ""}
          {meta.author ? ` · préparé par ${meta.author}` : ""}
        </div>
      </header>

      {meta.intro && <p className="rv-intro">{meta.intro}</p>}

      {s.has("chiffres") && (
        <section>
          <H>Résultats</H>
          <p className="rv-lead">
            <strong>{eur2(n.cost)}</strong> investis ont apporté{" "}
            {ecom
              ? <><strong>{eur2(n.value)}</strong> de ventes, soit un ROAS de <strong>{roas === null ? "–" : roas.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</strong>.</>
              : <><strong>{n.conversions.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</strong> conversion(s){cpa !== null && <>, à <strong>{eur2(cpa)}</strong> l&apos;une</>}.</>}
          </p>
          <div className="rv-grid">
            {kpis.map((k) => (
              <div key={k.label} className="rv-card">
                <div className="rv-row"><div className="rv-label">{k.label}</div><Delta now={k.now} before={k.before} invert={k.invert} show={meta.compare} /></div>
                <div className="rv-big">{k.value}</div>
                <div className="rv-sub">{k.sub}</div>
                <Spark values={k.spark} />
              </div>
            ))}
          </div>
        </section>
      )}

      {meta.analysis && (<section><H>Analyse</H><p className="rv-text">{meta.analysis}</p></section>)}

      {s.has("courbes") && data.daily.length > 1 && (
        <section>
          <H>Évolution jour par jour</H>
          <div className="rv-grid2">
            <Chart title="Dépense, jour par jour" values={series((t) => t.cost)} labels={data.daily.map((d) => d.date)} fmt={eur} />
            <Chart title={ecom ? "Ventes, jour par jour" : "Conversions, jour par jour"} values={series((t) => (ecom ? t.value : t.conversions))} labels={data.daily.map((d) => d.date)} fmt={(v) => (ecom ? eur(v) : v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }))} />
          </div>
        </section>
      )}

      {s.has("jour_par_jour") && data.daily.length > 0 && (
        <section>
          <H>Jour par jour</H>
          <p className="rv-sub">Plus récent en premier. Le jour même est absent : Google consolide ses chiffres le lendemain.</p>
          <table className="rv-table">
            <thead><tr><th>Jour</th><th>Dépense</th><th>Clics</th><th>Conv.</th><th>Coût / conv.</th><th>Taux de conv.</th></tr></thead>
            <tbody>
              {[...data.daily].reverse().map((d) => (
                <tr key={d.date}>
                  <td>{new Date(d.date + "T00:00:00Z").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" })}</td>
                  <td>{eur(d.t.cost, 2)}</td><td>{d.t.clicks}</td><td>{d.t.conversions.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</td>
                  <td>{d.t.conversions ? eur(d.t.cost / d.t.conversions, 2) : "–"}</td><td>{pct(div(d.t.conversions, d.t.clicks))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {s.has("sante") && data.health && (
        <section>
          <H>Santé du compte</H>
          <div className="rv-grid">
            <div className="rv-card"><div className="rv-label">Note du compte</div><div className="rv-big">{data.health.score} / 100</div><div className="rv-sub">diagnostic du {frDate(data.health.date)}</div></div>
            <div className="rv-card"><div className="rv-label">Dépense mal placée, prouvée</div><div className="rv-big">{eur(data.health.proven)}</div><div className="rv-sub">sur 30 jours</div></div>
            <div className="rv-card"><div className="rv-label">À surveiller</div><div className="rv-big">{eur(data.health.watch)}</div><div className="rv-sub">volume encore trop faible pour conclure</div></div>
          </div>
        </section>
      )}

      {s.has("types") && data.types.length > 0 && (
        <section>
          <H>Par type de campagne</H>
          <table className="rv-table">
            <thead><tr><th>Type</th><th>Dépense</th><th>Clics</th><th>{ecom ? "Ventes" : "Conv."}</th><th>{ecom ? "ROAS" : "CPA"}</th></tr></thead>
            <tbody>{data.types.map((t) => (
              <tr key={t.type}><td>{CHANNEL[t.type] ?? t.type}</td><td>{eur(t.t.cost)}</td><td>{t.t.clicks}</td>
                <td>{ecom ? eur(t.t.value) : t.t.conversions.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</td>
                <td>{ecom ? (t.t.cost ? (t.t.value / t.t.cost).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : "–") : t.t.conversions ? eur(t.t.cost / t.t.conversions) : "–"}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      {s.has("campagnes") && data.campaigns.length > 0 && (
        <section>
          <H>Par campagne</H>
          <table className="rv-table">
            <thead><tr><th>Campagne</th><th>Dépense</th>{meta.compare && <th>vs avant</th>}<th>{ecom ? "Ventes" : "Conv."}</th>{meta.compare && <th>vs avant</th>}<th>{ecom ? "ROAS" : "CPA"}</th></tr></thead>
            <tbody>{data.campaigns.map((c) => (
              <tr key={c.name}><td>{c.name}</td><td>{eur(c.t.cost)}</td>
                {meta.compare && <td><Delta now={c.t.cost} before={c.before.cost} invert show /></td>}
                <td>{ecom ? eur(c.t.value) : c.t.conversions.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</td>
                {meta.compare && <td><Delta now={ecom ? c.t.value : c.t.conversions} before={ecom ? c.before.value : c.before.conversions} show /></td>}
                <td>{ecom ? (c.t.cost ? (c.t.value / c.t.cost).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : "–") : c.t.conversions ? eur(c.t.cost / c.t.conversions) : "–"}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      {s.has("recherches") && (
        <section>
          <H>Recherches qui ont converti</H>
          {data.searches.length === 0 ? <p className="rv-sub">Aucune recherche convertie sur la période.</p> : (
            <table className="rv-table">
              <thead><tr><th>Ce que les gens ont tapé</th><th>Clics</th><th>Conv.</th><th>Coût</th></tr></thead>
              <tbody>{data.searches.map((x) => (<tr key={x.term}><td>{x.term}</td><td>{x.t.clicks}</td><td>{x.t.conversions.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</td><td>{eur(x.t.cost, 2)}</td></tr>))}</tbody>
            </table>
          )}
        </section>
      )}

      {s.has("mots_cles") && (
        <section>
          <H>Mots-clés qui portent les résultats</H>
          {data.keywords.length === 0 ? <p className="rv-sub">Aucun mot-clé n&apos;a converti sur la période.</p> : (
            <table className="rv-table">
              <thead><tr><th>Mot-clé</th><th>Clics</th><th>Conv.</th><th>Coût / conv.</th></tr></thead>
              <tbody>{data.keywords.map((x) => (<tr key={x.text}><td>{x.text}</td><td>{x.t.clicks}</td><td>{x.t.conversions.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</td><td>{x.t.conversions ? eur(x.t.cost / x.t.conversions) : "–"}</td></tr>))}</tbody>
            </table>
          )}
        </section>
      )}

      {s.has("fait") && (
        <section>
          <H>Ce qui a été fait</H>
          {meta.optimisations && <p className="rv-text">{meta.optimisations}</p>}
          {data.changes.length === 0 ? <p className="rv-sub">Aucune modification enregistrée{data.changesSince && data.changesSince > data.range.since ? ` depuis le ${frDate(data.changesSince)} (Google conserve 30 jours d'historique)` : ""}.</p> : (
            <ul className="rv-list">
              {data.changes.slice(0, 40).map((c, i) => (
                <li key={i}><span className="rv-date">{frDate(c.date)}</span> <span className="rv-tag">{CHANGE_KINDS[c.kind] ?? c.kind}</span> {c.text}{c.detail.length ? ` : ${c.detail.slice(0, 4).join(", ")}${c.detail.length > 4 ? ` (+${c.detail.length - 4})` : ""}` : ""}</li>
              ))}
            </ul>
          )}
        </section>
      )}
      {!s.has("fait") && meta.optimisations && (<section><H>Ce qui a été fait</H><p className="rv-text">{meta.optimisations}</p></section>)}

      {s.has("actions") && data.actions.length > 0 && (
        <section>
          <H>Prochaines actions</H>
          <ol className="rv-list rv-ol">{data.actions.map((a, i) => (<li key={i}><strong>{a.title}</strong><br /><span className="rv-sub">{a.action}</span></li>))}</ol>
        </section>
      )}

      <footer className="rv-foot">Chiffres lus dans Google Ads le {new Date().toLocaleDateString("fr-FR")}.</footer>
    </article>
  );
}
