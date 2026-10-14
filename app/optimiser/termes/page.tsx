// Termes de recherche (modèle Ades) : À exclure, Liste, Intentions, N-grammes,
// Matrice, Bloquées. Lecture seule ; l'ajout de négatifs passe par le journal.
import OptPage from "@/components/opt/OptPage";
import Table, { Delta, Bar, type Col } from "@/components/opt/Table";
import { Notice, Panel, Stat } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { getScope, type Scope, type ScopeParams } from "@/lib/optimize/scope";
import { termReport, termHistory, listNegatives, eur, pct, int, ratio, fmtKw, zero, addInto, type TermRow, type Metrics, type NegativeRow } from "@/lib/optimize/data";
import { classify, ngrams, fold, INTENTS, type Intent } from "@/lib/optimize/intents";
import { negativeBlocks } from "@/lib/audit/negatives";
import { addNegativesAction } from "../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TABS = [
  { id: "exclure", label: "À exclure" },
  { id: "liste", label: "Liste" },
  { id: "intentions", label: "Intentions" },
  { id: "ngrammes", label: "N-grammes" },
  { id: "matrice", label: "Matrice" },
  { id: "bloquees", label: "Bloquées" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const STATUS: Record<string, { label: string; tone: string }> = {
  ADDED: { label: "ajoutée en mot-clé", tone: "green" },
  EXCLUDED: { label: "exclue", tone: "red" },
  ADDED_EXCLUDED: { label: "ajoutée et exclue", tone: "red" },
  NONE: { label: "nouvelle recherche", tone: "" },
};
const fmtConv = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("fr-FR", { maximumFractionDigits: 1 }));

export default async function TermsPage({ searchParams }: { searchParams: Promise<ScopeParams> }) {
  const sp = await searchParams;
  const scope = await getScope("/optimiser/termes", sp);
  const tab: Tab = TABS.find((t) => t.id === sp.onglet)?.id ?? (sp.q ? "liste" : "exclure");

  let terms: TermRow[] = [];
  let history: Awaited<ReturnType<typeof termHistory>> = [];
  let negatives: NegativeRow[] = [];
  let err: string | null = null;
  if (scope.ads) {
    try {
      [terms, history, negatives] = await Promise.all([
        termReport(scope.ads, scope.p, scope.campaignId),
        tab === "bloquees" ? termHistory(scope.ads, scope.campaignId) : Promise.resolve([]),
        tab === "bloquees" || tab === "exclure" ? listNegatives(scope.ads, scope.campaignId) : Promise.resolve([] as NegativeRow[]),
      ]);
    } catch (e) { err = e instanceof Error ? e.message : String(e); }
  }
  const msg = sp.msg ? { ok: sp.msg.startsWith("ok:"), text: sp.msg.replace(/^(ok|err):/, "") } : null;
  const tabs = TABS.map((t) => ({ label: t.label, href: scope.href({ onglet: t.id, tri: null, ordre: null, tout: null, n: null, msg: null }), active: t.id === tab }));

  return (
    <OptPage
      scope={scope}
      title="Termes de recherche"
      tour={[{ title: "Termes de recherche · Découvrir ce que vos clients tapent vraiment", text: "Les recherches exactes qui ont déclenché vos annonces. « À exclure » propose les négatifs : coche, puis exclus en un clic (annulable 30 jours)." }, { title: "Termes de recherche · Intentions et n-grammes", text: "Intentions regroupe les recherches par ce que cherche l'internaute (achat, concurrents, emploi…). N-grammes montre le coût par mot, pour trouver les négatifs qui couvrent beaucoup de recherches." }]}
      sub={<>{terms.length} recherches · {scope.p.days} derniers jours</>}
      ia="Analyse mes termes de recherche : ce qu'il faut exclure, les intentions qui coûtent sans convertir, et les recherches à ajouter en mots-clés"
      help={<>
        <p>Les recherches exactes qui ont déclenché tes annonces. <strong>À exclure</strong> : ce qui dépense sans convertir ou ne correspond pas à l&apos;offre (concurrents, emploi, gratuit), à cocher puis exclure en un clic.</p>
        <p><strong>Intentions</strong> : recherches regroupées par ce que cherche l&apos;internaute. <strong>N-grammes</strong> : le coût par mot ou groupe de mots, pour trouver les négatifs qui couvrent beaucoup de recherches. <strong>Bloquées</strong> : recherches déjà exclues, par quel négatif, et ce qu&apos;elles coûtaient avant.</p>
      </>}
      tabs={tabs}
    >
      {msg && <Notice tone={msg.ok ? "ok" : "err"}>{msg.ok ? "✓ " : ""}{msg.text}</Notice>}
      {err && <Notice tone="err">Lecture des termes impossible : {err.slice(0, 220)}</Notice>}
      {tab === "exclure" && <ExcludeTab terms={terms} negatives={negatives} scope={scope} />}
      {tab === "liste" && <ListTab terms={terms} scope={scope} sp={sp} />}
      {tab === "intentions" && <IntentTab terms={terms} scope={scope} />}
      {tab === "ngrammes" && <NgramTab terms={terms} scope={scope} sp={sp} />}
      {tab === "matrice" && <MatrixTab terms={terms} />}
      {tab === "bloquees" && <BlockedTab history={history} negatives={negatives} sp={sp} scope={scope} />}
    </OptPage>
  );
}

// ── À exclure ─────────────────────────────────────────────────────────────

function ExcludeTab({ terms, negatives, scope }: { terms: TermRow[]; negatives: NegativeRow[]; scope: Scope }) {
  const blocked = (t: TermRow) => negatives.some((n) => (n.level === "ad_group" ? n.adGroupId === t.adGroupId : n.campaignId === t.campaignId) && negativeBlocks(n.text, n.matchType, t.term));
  const cands = terms
    .filter((t) => t.status === "NONE" && !blocked(t))
    .map((t) => {
      const intent = classify(t.term);
      const offTopic = INTENTS[intent].verdict === "exclure";
      const wasted = t.cur.conversions === 0 && (t.cur.clicks >= 3 || t.cur.cost >= 15);
      const reason = offTopic ? INTENTS[intent].label : wasted ? `${t.cur.clicks} clics sans conversion` : null;
      return { t, intent, reason, offTopic };
    })
    .filter((x) => x.reason)
    .sort((a, b) => b.t.cur.cost - a.t.cur.cost || b.t.cur.impressions - a.t.cur.impressions);
  const cost = cands.reduce((s, x) => s + x.t.cur.cost, 0);
  const back = scope.href({ onglet: "exclure", msg: null });

  return (
    <>
      <section className="ui-panel op-stats3">
        <Stat label="Recherches à exclure" value={cands.length} sub="hors sujet ou sans conversion" />
        <Stat label="Coût sur la période" value={eur(cost)} tone={cost > 0 ? "bad" : undefined} sub={`${scope.p.days} derniers jours`} />
        <Stat label="Négatifs déjà en place" value={negatives.length} sub="campagnes, groupes et listes" />
      </section>
      <form action={addNegativesAction} className="op-table-wrap">
        <input type="hidden" name="customer_id" value={scope.account?.customerId ?? ""} />
        <input type="hidden" name="back" value={back} />
        <div className="op-actions-bar">
          <select name="match" className="op-mini-select" defaultValue="EXACT" aria-label="Correspondance">
            <option value="EXACT">En exact [recherche]</option>
            <option value="PHRASE">En expression &quot;recherche&quot;</option>
          </select>
          <SubmitButton className="ui-btn ui-btn-primary" pending="Envoi à Google Ads…">Exclure les recherches cochées</SubmitButton>
          <span className="dg-foot">Les recherches sans conversion ne sont pas cochées d&apos;office : vérifie qu&apos;elles ne correspondent pas à l&apos;offre. Annulable 30 jours.</span>
        </div>
        <table className="op-table">
          <thead><tr><th style={{ width: 36 }} /><th>Recherche</th><th>Campagne</th><th>Pourquoi</th><th className="num">Impr.</th><th className="num">Clics</th><th className="num">Coût</th><th className="num">Conv.</th></tr></thead>
          <tbody>
            {cands.length === 0 ? (
              <tr><td colSpan={8} className="op-empty">Rien à exclure sur la période.</td></tr>
            ) : cands.map(({ t, reason, offTopic }) => (
              <tr key={`${t.adGroupId}~${t.term}`}>
                <td><input className="op-check" type="checkbox" name="t" value={`${t.campaignId}|${encodeURIComponent(t.campaign)}|${encodeURIComponent(t.term)}`} defaultChecked={offTopic} /></td>
                <td><div className="op-kw-text">{t.term}</div></td>
                <td><div className="op-kw-sub" style={{ marginTop: 0 }}>{t.campaign}</div></td>
                <td><span className={`op-tag ${offTopic ? "red" : ""}`}>{reason}</span></td>
                <td className="num">{int(t.cur.impressions)}</td>
                <td className="num">{int(t.cur.clicks)}</td>
                <td className="num">{eur(t.cur.cost)}</td>
                <td className="num">{fmtConv(t.cur.conversions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </form>
    </>
  );
}

// ── Liste ─────────────────────────────────────────────────────────────────

function ListTab({ terms, scope, sp }: { terms: TermRow[]; scope: Scope; sp: ScopeParams }) {
  const q = fold(sp.q ?? "");
  const rows = q ? terms.filter((t) => fold(t.term).includes(q)) : terms;
  const sum = zero();
  rows.forEach((t) => addInto(sum, t.cur));
  const cmp = scope.compare;
  const cols: Col<TermRow>[] = [
    { id: "t", label: "Recherche", sort: (t) => t.term, render: (t) => <div><div className="op-kw-text">{t.term}</div><div className="op-kw-sub">{INTENTS[classify(t.term)].label}</div></div> },
    { id: "c", label: "Campagne", sort: (t) => t.campaign, render: (t) => <span className="op-kw-sub">{t.campaign}</span> },
    { id: "s", label: "Statut", sort: (t) => t.status, render: (t) => <span className={`op-tag ${STATUS[t.status]?.tone ?? ""}`}>{STATUS[t.status]?.label ?? t.status}</span> },
    { id: "impr", label: "Impr.", num: true, sort: (t) => t.cur.impressions, total: int(sum.impressions), render: (t) => <>{int(t.cur.impressions)}<Delta cur={t.cur.impressions} prev={t.prev.impressions} show={cmp} /></> },
    { id: "clics", label: "Clics", num: true, sort: (t) => t.cur.clicks, total: int(sum.clicks), render: (t) => int(t.cur.clicks) },
    { id: "ctr", label: "CTR", num: true, sort: (t) => ratio(t.cur.clicks, t.cur.impressions), render: (t) => pct(ratio(t.cur.clicks, t.cur.impressions)) },
    { id: "cout", label: "Coût", num: true, sort: (t) => t.cur.cost, total: eur(sum.cost), render: (t) => <>{eur(t.cur.cost)}<Delta cur={t.cur.cost} prev={t.prev.cost} show={cmp} lowerIsBetter /></> },
    { id: "conv", label: "Conv.", num: true, sort: (t) => t.cur.conversions, total: fmtConv(sum.conversions), render: (t) => <span className={t.cur.conversions > 0 ? "op-good" : undefined}>{fmtConv(t.cur.conversions)}</span> },
    { id: "cpa", label: "CPA", num: true, sort: (t) => ratio(t.cur.cost, t.cur.conversions), render: (t) => (t.cur.conversions ? eur(t.cur.cost / t.cur.conversions) : "–") },
  ];
  return (
    <>
      <form className="op-toolbar" action={scope.path}>
        {Object.entries(sp).filter(([k, v]) => v && !["q", "tout", "msg"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input className="op-search" name="q" defaultValue={sp.q ?? ""} placeholder={`Chercher dans ${terms.length} recherches`} />
        <button className="ui-btn ui-btn-ghost" type="submit">Filtrer</button>
        <span className="op-count">{rows.length} recherches</span>
      </form>
      <Table cols={cols} rows={rows} rowKey={(t) => `${t.adGroupId}~${t.term}`} sort={sp.tri ?? "cout"} dir={sp.ordre === "asc" ? "asc" : "desc"}
        hrefFor={(c, d) => scope.href({ tri: c, ordre: d })} showAll={sp.tout === "1"} allHref={scope.href({ tout: "1" })} limit={50}
        totalLabel={`${rows.length} recherches`} />
    </>
  );
}

// ── Intentions ────────────────────────────────────────────────────────────

function IntentTab({ terms, scope }: { terms: TermRow[]; scope: Scope }) {
  const total = terms.reduce((s, t) => s + t.cur.cost, 0);
  const groups = new Map<Intent, { m: Metrics; terms: TermRow[] }>();
  for (const t of terms) {
    const k = classify(t.term);
    const g = groups.get(k) ?? { m: zero(), terms: [] };
    addInto(g.m, t.cur);
    g.terms.push(t);
    groups.set(k, g);
  }
  const list = [...groups.entries()].sort((a, b) => b[1].m.cost - a[1].m.cost || b[1].m.impressions - a[1].m.impressions);
  const V = { garder: { label: "À garder", tone: "green" }, surveiller: { label: "À surveiller", tone: "blue" }, exclure: { label: "À exclure", tone: "red" } };
  return (
    <div className="op-table-wrap">
      <table className="op-table">
        <thead><tr><th>Intention</th><th className="num">Recherches</th><th className="num">Impr.</th><th className="num">Clics</th><th className="num">Coût</th><th className="num">Part</th><th className="num">Conv.</th><th className="num">CPA</th></tr></thead>
        {list.length === 0 ? (
          <tbody><tr><td colSpan={8} className="op-empty">Aucune recherche sur la période.</td></tr></tbody>
        ) : list.map(([k, g]) => {
          const v = V[INTENTS[k].verdict];
          return (
            <tbody key={k}>
              <tr className="op-group">
                <td><span className={`op-dot ${v.tone === "green" ? "on" : v.tone === "red" ? "bad" : "all"}`} style={{ marginRight: 8 }} />{INTENTS[k].label} <span className={`op-tag ${v.tone}`} style={{ marginLeft: 6 }}>{v.label}</span><div className="op-kw-sub" style={{ fontWeight: 400 }}>{INTENTS[k].hint}</div></td>
                <td className="num">{g.terms.length}</td>
                <td className="num">{int(g.m.impressions)}</td>
                <td className="num">{int(g.m.clicks)}</td>
                <td className="num">{eur(g.m.cost)}</td>
                <td className="num"><Bar v={total ? g.m.cost / total : 0} /></td>
                <td className="num">{fmtConv(g.m.conversions)}</td>
                <td className="num">{g.m.conversions ? eur(g.m.cost / g.m.conversions) : "–"}</td>
              </tr>
              {g.terms.sort((a, b) => b.cur.cost - a.cur.cost || b.cur.impressions - a.cur.impressions).slice(0, 12).map((t) => (
                <tr key={`${k}~${t.adGroupId}~${t.term}`}>
                  <td style={{ paddingLeft: 30 }}>{t.term}<div className="op-kw-sub">{STATUS[t.status]?.label ?? t.status}</div></td>
                  <td className="num" />
                  <td className="num">{int(t.cur.impressions)}</td>
                  <td className="num">{int(t.cur.clicks)}</td>
                  <td className="num">{eur(t.cur.cost)}</td>
                  <td className="num" />
                  <td className="num">{fmtConv(t.cur.conversions)}</td>
                  <td className="num">{t.cur.conversions ? eur(t.cur.cost / t.cur.conversions) : "–"}</td>
                </tr>
              ))}
              {g.terms.length > 12 && (
                <tr><td colSpan={8} style={{ paddingLeft: 30 }} className="op-kw-sub">+ {g.terms.length - 12} autres : voir l&apos;onglet <a href={scope.href({ onglet: "liste" })}>Liste</a></td></tr>
              )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

// ── N-grammes ─────────────────────────────────────────────────────────────

function NgramTab({ terms, scope, sp }: { terms: TermRow[]; scope: Scope; sp: ScopeParams }) {
  const n = sp.n === "2" ? 2 : sp.n === "3" ? 3 : 1;
  const total = terms.reduce((s, t) => s + t.cur.cost, 0);
  const map = new Map<string, { g: string; terms: number; m: Metrics; noConv: number }>();
  for (const t of terms) {
    for (const g of ngrams(t.term, n)) {
      const e = map.get(g) ?? { g, terms: 0, m: zero(), noConv: 0 };
      e.terms++;
      addInto(e.m, t.cur);
      if (t.cur.conversions === 0) e.noConv += t.cur.cost;
      map.set(g, e);
    }
  }
  const rows = [...map.values()].filter((r) => r.terms >= (n === 1 ? 2 : 1) || r.m.cost > 0);
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { id: "g", label: n === 1 ? "Mot" : "Expression", sort: (r) => r.g, render: (r) => <span className="op-kw-text">{r.g}</span> },
    { id: "rech", label: "Recherches", num: true, sort: (r) => r.terms, render: (r) => r.terms },
    { id: "impr", label: "Impr.", num: true, sort: (r) => r.m.impressions, render: (r) => int(r.m.impressions) },
    { id: "clics", label: "Clics", num: true, sort: (r) => r.m.clicks, render: (r) => int(r.m.clicks) },
    { id: "cout", label: "Coût", num: true, sort: (r) => r.m.cost, render: (r) => eur(r.m.cost) },
    { id: "part", label: "Part du coût", num: true, sort: (r) => r.m.cost, render: (r) => (total ? pct(r.m.cost / total, 0) : "–") },
    { id: "conv", label: "Conv.", num: true, sort: (r) => r.m.conversions, render: (r) => fmtConv(r.m.conversions) },
    { id: "cpa", label: "CPA", num: true, sort: (r) => ratio(r.m.cost, r.m.conversions), render: (r) => (r.m.conversions ? eur(r.m.cost / r.m.conversions) : "–") },
    { id: "tx", label: "Tx conv.", num: true, sort: (r) => ratio(r.m.conversions, r.m.clicks), render: (r) => pct(ratio(r.m.conversions, r.m.clicks), 0) },
    { id: "sans", label: "Sans conv.", num: true, sort: (r) => r.noConv, render: (r) => <span className={r.noConv > 0 ? "op-bad" : undefined}>{eur(r.noConv)}</span> },
  ];
  const sub = (k: 1 | 2 | 3, label: string) => <a href={scope.href({ n: k === 1 ? null : String(k), tri: null, ordre: null, tout: null })} className={n === k ? "active" : undefined}>{label}</a>;
  return (
    <>
      <div>
        <span className="op-subtabs">{sub(1, "1 mot")}{sub(2, "2 mots")}{sub(3, "3 mots")}</span>
        <span className="op-subtitle">{n === 1 ? "Mots seuls" : `Expressions de ${n} mots`}</span>
      </div>
      <Table cols={cols} rows={rows} rowKey={(r) => r.g} sort={sp.tri ?? "cout"} dir={sp.ordre === "asc" ? "asc" : "desc"}
        hrefFor={(c, d) => scope.href({ tri: c, ordre: d })} showAll={sp.tout === "1"} allHref={scope.href({ tout: "1" })} limit={40}
        empty="Pas assez de recherches sur la période." />
    </>
  );
}

// ── Matrice ───────────────────────────────────────────────────────────────

function MatrixTab({ terms }: { terms: TermRow[] }) {
  const conv = terms.filter((t) => t.cur.conversions > 0);
  const noConv = terms.filter((t) => t.cur.conversions === 0 && t.cur.cost > 0);
  const noConvCost = noConv.reduce((s, t) => s + t.cur.cost, 0);
  if (conv.length === 0) {
    return (
      <Panel title="Matrice" sub="Quelles recherches coûtent cher pour chaque conversion ?">
        <p style={{ margin: 0, color: "var(--muted)" }}>Aucune recherche avec conversion à placer sur cette matrice.<br />{noConv.length} recherches sans conversion, {eur(noConvCost)} : pas de coût par conversion, non placées.</p>
      </Panel>
    );
  }
  const cpas = conv.map((t) => t.cur.cost / t.cur.conversions).sort((a, b) => a - b);
  const medCpa = cpas[Math.floor(cpas.length / 2)];
  const costs = conv.map((t) => t.cur.cost).sort((a, b) => a - b);
  const medCost = costs[Math.floor(costs.length / 2)];
  const quad = (hiCost: boolean, hiCpa: boolean) => conv.filter((t) => (t.cur.cost >= medCost) === hiCost && (t.cur.cost / t.cur.conversions >= medCpa) === hiCpa);
  const Q = ({ title, hint, list, tone }: { title: string; hint: string; list: TermRow[]; tone: string }) => (
    <section className={`ui-panel op-quad ${tone}`}>
      <div className="ui-panel-title">{title}</div>
      <div className="ui-panel-sub" style={{ marginBottom: 10 }}>{hint}</div>
      {list.length === 0 ? <div className="op-kw-sub">Aucune</div> : list.map((t) => (
        <div key={t.term + t.adGroupId} className="op-quad-row"><span>{t.term}</span><span>{eur(t.cur.cost / t.cur.conversions)} / conv.</span></div>
      ))}
    </section>
  );
  return (
    <>
      <p className="op-lead">Recherches qui convertissent, rangées selon ce qu&apos;elles dépensent et ce que coûte chaque conversion (médianes : {eur(medCost)} dépensés, {eur(medCpa)} par conversion).</p>
      <div className="op-grid2">
        <Q title="À pousser" hint="Dépensent peu, conversions pas chères" list={quad(false, false)} tone="good" />
        <Q title="Piliers" hint="Dépensent beaucoup, conversions pas chères" list={quad(true, false)} tone="good" />
        <Q title="À tester" hint="Dépensent peu, conversions chères" list={quad(false, true)} tone="" />
        <Q title="À surveiller" hint="Dépensent beaucoup, conversions chères" list={quad(true, true)} tone="bad" />
      </div>
      {noConv.length > 0 && <p className="dg-foot">{noConv.length} recherches sans conversion ({eur(noConvCost)}) non placées : voir l&apos;onglet À exclure.</p>}
    </>
  );
}

// ── Bloquées ──────────────────────────────────────────────────────────────

function BlockedTab({ history, negatives, sp, scope }: { history: { term: string; campaignId: string; m: Metrics }[]; negatives: NegativeRow[]; sp: ScopeParams; scope: Scope }) {
  const rows = history
    .map((h) => {
      const by = negatives.filter((n) => n.campaignId === h.campaignId && negativeBlocks(n.text, n.matchType, h.term));
      return { ...h, by };
    })
    .filter((r) => r.by.length > 0);
  const q = fold(sp.q ?? "");
  const shown = rows.filter((r) => (!q || fold(r.term).includes(q) || r.by.some((n) => fold(n.text).includes(q))) && (sp.conv !== "1" || r.m.conversions > 0))
    .sort((a, b) => b.m.cost - a.m.cost);
  const conv = rows.reduce((s, r) => s + r.m.conversions, 0);
  const cost = rows.reduce((s, r) => s + r.m.cost, 0);
  const exact = rows.filter((r) => r.by.some((n) => fold(n.text) === fold(r.term))).length;
  const LV = { campaign: "négatif de campagne", ad_group: "négatif du groupe", shared: "liste partagée" };
  const MT: Record<string, string> = { EXACT: "exact", PHRASE: "expression", BROAD: "large" };
  return (
    <>
      <section className="ui-panel op-stats3">
        <Stat label="Bloquées aujourd'hui" value={`${rows.length} recherche${rows.length > 1 ? "s" : ""}`} sub={rows.some((r) => r.m.conversions > 0) ? "dont certaines avaient converti" : "aucune n'avait converti"} />
        <Stat label="Sur 12 mois" value={`${fmtConv(conv)} conv. · ${eur(cost)}`} tone={conv > 0 ? "warn" : undefined} sub="dépensé et converti sur ces recherches avant blocage" />
        <Stat label="Exclues mot pour mot" value={exact} sub="la recherche exacte a été ajoutée en négatif" />
      </section>
      <form className="op-toolbar" action={scope.path}>
        {Object.entries(sp).filter(([k, v]) => v && !["q", "conv", "msg"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input className="op-search" name="q" defaultValue={sp.q ?? ""} placeholder="Chercher une recherche ou un négatif…" />
        <label className="op-inline"><input className="op-check" type="checkbox" name="conv" value="1" defaultChecked={sp.conv === "1"} /> Avec conversions seulement</label>
        <button className="ui-btn ui-btn-ghost" type="submit">Filtrer</button>
        <span className="op-count">{shown.length} recherches</span>
      </form>
      <div className="op-table-wrap">
        <table className="op-table">
          <thead><tr><th>Recherche</th><th>Bloquée par</th><th className="num">Clics (12 mois)</th><th className="num">Coût (12 mois)</th><th className="num">Conv.</th></tr></thead>
          <tbody>
            {shown.length === 0 ? <tr><td colSpan={5} className="op-empty">Aucune recherche bloquée sur la sélection.</td></tr> : shown.map((r) => (
              <tr key={r.campaignId + r.term}>
                <td><div className="op-kw-text">{r.term}</div></td>
                <td>{r.by.map((n, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>« {n.text} » <span className="op-tag">{MT[n.matchType] ?? n.matchType}</span> <span className="op-kw-sub">· {LV[n.level]}{n.level === "ad_group" && n.adGroup ? ` « ${n.adGroup} »` : n.sharedSet ? ` « ${n.sharedSet} »` : ""}</span></div>
                ))}</td>
                <td className="num">{int(r.m.clicks)}</td>
                <td className="num">{eur(r.m.cost)}</td>
                <td className="num"><span className={r.m.conversions > 0 ? "op-good" : undefined}>{fmtConv(r.m.conversions)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.some((r) => r.m.conversions > 0) && <Notice tone="warn">Des recherches bloquées avaient converti : vérifie si le négatif n&apos;est pas trop large ({fmtKw("…", "BROAD")} ou expression).</Notice>}
    </>
  );
}
