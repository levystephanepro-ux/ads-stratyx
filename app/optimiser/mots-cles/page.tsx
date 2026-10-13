// Mots-clés (modèle Ades) : tableau QS / coût / CTR / CPC / CPA, onglets Quality Score,
// Correspondance et Idées. Lecture seule, sans IA.
import Link from "next/link";
import OptPage from "@/components/opt/OptPage";
import Table, { Delta, Bar, type Col } from "@/components/opt/Table";
import { Panel, Stat, Notice } from "@/components/ui";
import { getScope, type ScopeParams } from "@/lib/optimize/scope";
import { keywordReport, termReport, eur, pct, int, ratio, fmtKw, MATCH_LABEL, zero, addInto, type KeywordRow, type TermRow, type Metrics } from "@/lib/optimize/data";
import { normKw } from "@/lib/audit/negatives";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TABS = [
  { id: "liste", label: "Mots-clés" },
  { id: "qs", label: "Quality Score" },
  { id: "correspondance", label: "Correspondance" },
  { id: "idees", label: "Idées" },
] as const;

export default async function KeywordsPage({ searchParams }: { searchParams: Promise<ScopeParams> }) {
  const sp = await searchParams;
  const scope = await getScope("/optimiser/mots-cles", sp);
  const tab = TABS.find((t) => t.id === sp.onglet)?.id ?? "liste";

  let rows: KeywordRow[] = [];
  let terms: TermRow[] = [];
  let err: string | null = null;
  if (scope.ads) {
    try {
      [rows, terms] = await Promise.all([
        keywordReport(scope.ads, scope.p, scope.campaignId),
        tab === "idees" ? termReport(scope.ads, scope.p, scope.campaignId) : Promise.resolve([] as TermRow[]),
      ]);
    } catch (e) { err = e instanceof Error ? e.message : String(e); }
  }
  const active = rows.filter((r) => r.status === "ENABLED");
  const q = (sp.q ?? "").trim().toLowerCase();
  const listed = (sp.statut === "tous" ? rows : active).filter((r) => !q || r.text.toLowerCase().includes(q) || r.adGroup.toLowerCase().includes(q));

  const tabs = TABS.map((t) => ({ label: t.label, href: scope.href({ onglet: t.id === "liste" ? null : t.id, tri: null, ordre: null, tout: null }), active: t.id === tab }));
  const sortHref = (c: string, d: "asc" | "desc") => scope.href({ tri: c, ordre: d });

  return (
    <OptPage
      scope={scope}
      title="Mots-clés"
      sub={<>{active.length} mots-clés actifs · {scope.p.days} derniers jours</>}
      ia="Analyse mes mots-clés : lesquels coûtent sans convertir, lesquels ont un Quality Score qui fait payer trop cher, et quoi faire à budget constant"
      help={<>
        <p>Chaque mot-clé avec ce qu&apos;il a coûté et rapporté sur la période, et son <strong>Quality Score</strong> (1 à 10) : plus il est bas, plus chaque clic coûte cher.</p>
        <p><strong>Quality Score</strong> : détail des 3 composantes (CTR attendu, pertinence de l&apos;annonce, page de destination). <strong>Correspondance</strong> : exact, expression, large. <strong>Idées</strong> : recherches qui marchent mais ne sont pas encore des mots-clés.</p>
      </>}
      tabs={tabs}
    >
      {err && <Notice tone="err">Lecture des mots-clés impossible : {err.slice(0, 220)}</Notice>}
      {tab === "liste" && <KeywordList rows={listed} total={active.length} scope={scope} sp={sp} sortHref={sortHref} />}
      {tab === "qs" && <QualityTab rows={active} />}
      {tab === "correspondance" && <MatchTab rows={active} compare={scope.compare} />}
      {tab === "idees" && <IdeasTab terms={terms} kws={rows} />}
    </OptPage>
  );
}

function qsTone(qs: number | null) {
  if (qs === null) return "";
  return qs <= 3 ? "bad" : qs <= 5 ? "warn" : "good";
}

function KeywordList({ rows, total, scope, sp, sortHref }: { rows: KeywordRow[]; total: number; scope: Awaited<ReturnType<typeof getScope>>; sp: ScopeParams; sortHref: (c: string, d: "asc" | "desc") => string }) {
  const cmp = scope.compare;
  const sum = zero();
  rows.forEach((r) => addInto(sum, r.cur));
  const cols: Col<KeywordRow>[] = [
    {
      id: "kw", label: "Mot-clé", sort: (r) => r.text,
      render: (r) => (
        <div className="op-kw">
          <span className={`op-dot ${r.status === "ENABLED" ? "on" : "off"}`} />
          <div>
            <div className="op-kw-text">{fmtKw(r.text, r.matchType)}</div>
            <div className="op-kw-sub">{r.campaign} › {r.adGroup}</div>
          </div>
        </div>
      ),
    },
    { id: "qs", label: "QS", num: true, sort: (r) => r.qs, render: (r) => <span className={`op-qs ${qsTone(r.qs)}`}>{r.qs ?? "–"}</span> },
    { id: "cout", label: "Coût", num: true, sort: (r) => r.cur.cost, total: eur(sum.cost), render: (r) => <>{eur(r.cur.cost)}<Delta cur={r.cur.cost} prev={r.prev.cost} show={cmp} lowerIsBetter /></> },
    { id: "impr", label: "Impr.", num: true, sort: (r) => r.cur.impressions, total: int(sum.impressions), render: (r) => <>{int(r.cur.impressions)}<Delta cur={r.cur.impressions} prev={r.prev.impressions} show={cmp} /></> },
    { id: "clics", label: "Clics", num: true, sort: (r) => r.cur.clicks, total: int(sum.clicks), render: (r) => <>{int(r.cur.clicks)}<Delta cur={r.cur.clicks} prev={r.prev.clicks} show={cmp} /></> },
    { id: "ctr", label: "CTR", num: true, sort: (r) => ratio(r.cur.clicks, r.cur.impressions), total: pct(ratio(sum.clicks, sum.impressions)), render: (r) => pct(ratio(r.cur.clicks, r.cur.impressions)) },
    { id: "cpc", label: "CPC", num: true, sort: (r) => ratio(r.cur.cost, r.cur.clicks), total: sum.clicks ? eur(sum.cost / sum.clicks) : "–", render: (r) => (r.cur.clicks ? eur(r.cur.cost / r.cur.clicks) : "–") },
    { id: "conv", label: "Conv.", num: true, sort: (r) => r.cur.conversions, total: int(sum.conversions), render: (r) => <span className={r.cur.conversions > 0 ? "op-good" : undefined}>{fmtConv(r.cur.conversions)}</span> },
    { id: "cpa", label: "CPA", num: true, sort: (r) => ratio(r.cur.cost, r.cur.conversions), total: sum.conversions ? eur(sum.cost / sum.conversions) : "–", render: (r) => (r.cur.conversions ? eur(r.cur.cost / r.cur.conversions) : "–") },
    { id: "go", label: "", render: (r) => <Link className="op-link" href={scope.href({ onglet: "liste", q: r.text, tri: null, ordre: null }, "/optimiser/termes")}>Explorer →</Link> },
  ];
  return (
    <>
      <form className="op-toolbar" action={scope.path}>
        {Object.entries(sp).filter(([k, v]) => v && !["q", "statut", "tout"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input className="op-search" name="q" defaultValue={sp.q ?? ""} placeholder={`Rechercher dans ${total} mots-clés`} />
        <select name="statut" defaultValue={sp.statut ?? ""} className="op-mini-select" aria-label="Statut">
          <option value="">Actifs</option>
          <option value="tous">Tous (pauses comprises)</option>
        </select>
        <button className="ui-btn ui-btn-ghost" type="submit">Filtrer</button>
        <span className="op-count">{rows.length} sur {total}</span>
      </form>
      <Table
        cols={cols}
        rows={rows}
        rowKey={(r) => r.key}
        sort={sp.tri ?? "cout"}
        dir={sp.ordre === "asc" ? "asc" : "desc"}
        hrefFor={sortHref}
        showAll={sp.tout === "1"}
        allHref={scope.href({ tout: "1" })}
        totalLabel={`${rows.length} mots-clés`}
        empty="Aucun mot-clé sur cette sélection."
      />
    </>
  );
}

const fmtConv = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("fr-FR", { maximumFractionDigits: 1 }));

function QualityTab({ rows }: { rows: KeywordRow[] }) {
  const withQs = rows.filter((r) => r.qs !== null);
  const cost = withQs.reduce((s, r) => s + r.cur.cost, 0);
  const weighted = cost > 0 ? withQs.reduce((s, r) => s + (r.qs ?? 0) * r.cur.cost, 0) / cost : null;
  const low = withQs.filter((r) => (r.qs ?? 10) <= 4);
  const lowCost = low.reduce((s, r) => s + r.cur.cost, 0);
  const dist = Array.from({ length: 10 }, (_, i) => withQs.filter((r) => r.qs === i + 1));
  const maxN = Math.max(1, ...dist.map((d) => d.length));
  const comp = (k: "ctrQ" | "adQ" | "lpQ") => withQs.filter((r) => r[k] === "faible").length;
  const Q = ({ v }: { v: KeywordRow["ctrQ"] }) => <span className={`op-q ${v ?? "na"}`}>{v ? v[0].toUpperCase() + v.slice(1) : "–"}</span>;
  const cols: Col<KeywordRow>[] = [
    { id: "kw", label: "Mot-clé", render: (r) => <div><div className="op-kw-text">{fmtKw(r.text, r.matchType)}</div><div className="op-kw-sub">{r.adGroup}</div></div> },
    { id: "qs", label: "QS", num: true, render: (r) => <span className={`op-qs ${qsTone(r.qs)}`}>{r.qs ?? "–"}</span> },
    { id: "ctr", label: "CTR attendu", render: (r) => <Q v={r.ctrQ} /> },
    { id: "ad", label: "Pertinence de l'annonce", render: (r) => <Q v={r.adQ} /> },
    { id: "lp", label: "Page de destination", render: (r) => <Q v={r.lpQ} /> },
    { id: "cout", label: "Coût", num: true, render: (r) => eur(r.cur.cost) },
  ];
  return (
    <>
      <section className="ui-panel op-stats4">
        <Stat label="QS pondéré par le coût" value={weighted === null ? "–" : weighted.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} tone={weighted === null ? undefined : weighted < 5 ? "bad" : weighted < 7 ? "warn" : "good"} sub="sur 10, là où part l'argent" />
        <Stat label="QS 4 ou moins" value={`${low.length}`} sub={`${eur(lowCost)} dépensés dessus`} tone={low.length ? "bad" : "good"} />
        <Stat label="CTR attendu faible" value={comp("ctrQ")} sub="annonces peu cliquées" />
        <Stat label="Page faible" value={comp("lpQ")} sub="page de destination à revoir" />
      </section>
      <Panel title="Répartition des Quality Scores">
        <div className="op-histo">
          {dist.map((d, i) => (
            <div key={i} className="op-histo-col">
              <div className="op-histo-n">{d.length || ""}</div>
              <div className={`op-histo-bar ${qsTone(i + 1)}`} style={{ height: `${(d.length / maxN) * 120 + (d.length ? 4 : 0)}px` }} />
              <div className="op-histo-x">{i + 1}</div>
            </div>
          ))}
        </div>
        {rows.length - withQs.length > 0 && <p className="dg-foot" style={{ margin: "10px 0 0" }}>{rows.length - withQs.length} mot(s)-clé(s) sans Quality Score (pas assez de recherches).</p>}
      </Panel>
      <Table cols={cols} rows={[...withQs].sort((a, b) => b.cur.cost - a.cur.cost)} rowKey={(r) => r.key} limit={50} />
    </>
  );
}

function MatchTab({ rows, compare }: { rows: KeywordRow[]; compare: boolean }) {
  const groups = new Map<string, { n: number; cur: Metrics; prev: Metrics }>();
  for (const r of rows) {
    const g = groups.get(r.matchType) ?? { n: 0, cur: zero(), prev: zero() };
    g.n++; addInto(g.cur, r.cur); addInto(g.prev, r.prev);
    groups.set(r.matchType, g);
  }
  const total = [...groups.values()].reduce((s, g) => s + g.cur.cost, 0);
  const list = [...groups.entries()].map(([k, g]) => ({ k, ...g })).sort((a, b) => b.cur.cost - a.cur.cost);
  const cols: Col<(typeof list)[number]>[] = [
    { id: "t", label: "Correspondance", render: (g) => <strong>{MATCH_LABEL[g.k] ?? g.k}</strong> },
    { id: "n", label: "Mots-clés", num: true, render: (g) => g.n },
    { id: "cout", label: "Coût", num: true, render: (g) => <>{eur(g.cur.cost)}<Delta cur={g.cur.cost} prev={g.prev.cost} show={compare} lowerIsBetter /></> },
    { id: "part", label: "Part du coût", num: true, render: (g) => <Bar v={total ? g.cur.cost / total : 0} /> },
    { id: "clics", label: "Clics", num: true, render: (g) => int(g.cur.clicks) },
    { id: "ctr", label: "CTR", num: true, render: (g) => pct(ratio(g.cur.clicks, g.cur.impressions)) },
    { id: "conv", label: "Conv.", num: true, render: (g) => fmtConv(g.cur.conversions) },
    { id: "cpa", label: "CPA", num: true, render: (g) => (g.cur.conversions ? eur(g.cur.cost / g.cur.conversions) : "–") },
  ];
  return <Table cols={cols} rows={list} rowKey={(g) => g.k} />;
}

function IdeasTab({ terms, kws }: { terms: TermRow[]; kws: KeywordRow[] }) {
  const have = new Set(kws.map((k) => normKw(k.text)));
  const ideas = terms
    .filter((t) => t.status === "NONE" && !have.has(normKw(t.term)) && (t.cur.conversions > 0 || t.cur.clicks >= 3))
    .sort((a, b) => b.cur.conversions - a.cur.conversions || b.cur.clicks - a.cur.clicks);
  const cols: Col<TermRow>[] = [
    { id: "t", label: "Recherche", render: (t) => <div><div className="op-kw-text">{t.term}</div><div className="op-kw-sub">{t.campaign} › {t.adGroup}</div></div> },
    { id: "clics", label: "Clics", num: true, render: (t) => int(t.cur.clicks) },
    { id: "cout", label: "Coût", num: true, render: (t) => eur(t.cur.cost) },
    { id: "conv", label: "Conv.", num: true, render: (t) => <span className={t.cur.conversions > 0 ? "op-good" : undefined}>{fmtConv(t.cur.conversions)}</span> },
    { id: "add", label: "À ajouter en", render: (t) => <code className="op-code">[{t.term}]</code> },
  ];
  return (
    <>
      <p className="op-lead">Recherches qui ont converti (ou reçu 3 clics ou plus) mais ne sont pas encore des mots-clés : en exact, tu contrôles leur enchère et leur annonce.</p>
      <Table cols={cols} rows={ideas} rowKey={(t) => `${t.adGroupId}~${t.term}`} empty="Aucune idée sur la période : allonge la période à 30 ou 90 jours." />
    </>
  );
}
