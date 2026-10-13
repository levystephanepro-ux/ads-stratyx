// CPC vs marché (modèle Ades « benchmark ») : impressions possibles et perdues
// (budget / classement), position en haut de page, et CPC de chaque mot-clé face à la
// fourchette d'enchère estimée par Google (1re page → haut de page).
import OptPage from "@/components/opt/OptPage";
import { Delta } from "@/components/opt/Table";
import { Notice, Panel, Stat } from "@/components/ui";
import { getScope, type ScopeParams } from "@/lib/optimize/scope";
import { campaignPerf, dailyByCampaign, keywordReport, eur, int, pct, fmtKw, type CampaignPerf, type DayRow, type KeywordRow } from "@/lib/optimize/data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Agg = { impressions: number; eligible: number; lostBudget: number; lostRank: number; top: number; absTop: number; clicks: number };

function aggregate(perf: CampaignPerf[], k: "cur" | "prev"): Agg {
  const a: Agg = { impressions: 0, eligible: 0, lostBudget: 0, lostRank: 0, top: 0, absTop: 0, clicks: 0 };
  for (const c of perf) {
    const m = c[k];
    if (m.is === null) continue; // hors Search
    a.impressions += m.impressions;
    a.clicks += m.clicks;
    a.eligible += m.eligible;
    a.lostBudget += (m.lostBudget ?? 0) * m.eligible;
    a.lostRank += (m.lostRank ?? 0) * m.eligible;
    a.top += (m.top ?? 0) * m.impressions;
    a.absTop += (m.absTop ?? 0) * m.impressions;
  }
  return a;
}

export default async function CpcPage({ searchParams }: { searchParams: Promise<ScopeParams> }) {
  const sp = await searchParams;
  const scope = await getScope("/analyser/cpc", sp);
  let perf: CampaignPerf[] = [], days: DayRow[] = [], kws: KeywordRow[] = [];
  let err: string | null = null;
  if (scope.ads) {
    try {
      [perf, days, kws] = await Promise.all([
        campaignPerf(scope.ads, scope.p, scope.campaignId),
        dailyByCampaign(scope.ads, scope.p.since, scope.p.until, scope.campaignId),
        keywordReport(scope.ads, scope.p, scope.campaignId),
      ]);
    } catch (e) { err = e instanceof Error ? e.message : String(e); }
  }
  const cur = aggregate(perf, "cur"), prev = aggregate(perf, "prev");
  const share = cur.eligible ? cur.impressions / cur.eligible : null;
  const lb = cur.eligible ? cur.lostBudget / cur.eligible : null;
  const lr = cur.eligible ? cur.lostRank / cur.eligible : null;
  const top = cur.impressions ? cur.top / cur.impressions : null;
  const absTop = cur.impressions ? cur.absTop / cur.impressions : null;
  const pTop = prev.impressions ? prev.top / prev.impressions : null;
  const ctr = cur.impressions ? cur.clicks / cur.impressions : 0;

  // mots-clés : CPC moyen face à la fourchette 1re page → haut de page
  const market = kws
    .filter((k) => k.status === "ENABLED" && k.cur.clicks > 0 && k.topPageCpc !== null)
    .map((k) => {
      const cpc = k.cur.cost / k.cur.clicks;
      const lo = k.firstPageCpc ?? 0, hi = k.topPageCpc!;
      const verdict = cpc > hi * 1.05 ? "au-dessus" : cpc < lo ? "en dessous" : "dans la fourchette";
      return { k, cpc, lo, hi, verdict };
    })
    .sort((a, b) => b.k.cur.cost - a.k.cur.cost)
    .slice(0, 15);
  const above = market.filter((m) => m.verdict === "au-dessus").length;
  const lowQs = market.filter((m) => (m.k.qs ?? 10) <= 4).length;
  const scaleMax = Math.max(1, ...market.map((m) => Math.max(m.cpc, m.hi))) * 1.1;

  return (
    <OptPage
      scope={scope}
      title="CPC vs marché"
      sub={share !== null ? <>{int(cur.eligible)} impressions possibles, {pct(lb, 0)} perdues faute de budget ; {above} mot{above > 1 ? "s" : ""}-clé{above > 1 ? "s" : ""} sur {market.length} payé{above > 1 ? "s" : ""} au-dessus du marché.</> : <>Campagnes Search sur {scope.p.days} jours.</>}
      ia="Analyse mes parts d'impressions perdues et mes CPC face au marché : est-ce un problème de budget, de qualité ou d'enchère, et que faire à budget constant"
      help={<>
        <p><strong>Impressions possibles</strong> : celles que tes annonces auraient pu obtenir. Elles se perdent faute de <strong>budget</strong> (campagne limitée) ou de <strong>classement</strong> (Quality Score et enchère trop bas).</p>
        <p><strong>Marché</strong> : la fourchette estimée par Google pour apparaître en 1re page (bas) et en haut de page (haut). Un CPC au-dessus du haut avec un Quality Score bas = tu paies la mauvaise qualité.</p>
      </>}
    >
      {err && <Notice tone="err">Lecture impossible : {err.slice(0, 220)}</Notice>}

      <section className="ui-panel op-stats4">
        <Stat label="Part d'impressions" value={pct(share, 1)} sub={<>{int(cur.impressions)} sur {int(cur.eligible)} possibles <Delta cur={share ?? 0} prev={prev.eligible ? prev.impressions / prev.eligible : 0} show={scope.compare} /></>} />
        <Stat label="Perdue faute de budget" value={pct(lb, 1)} tone={(lb ?? 0) > 0.1 ? "warn" : undefined} sub={`≈ ${int(cur.lostBudget)} impressions`} />
        <Stat label="Perdue au classement" value={pct(lr, 1)} tone={(lr ?? 0) > 0.2 ? "bad" : undefined} sub={`≈ ${int(cur.lostRank)} impressions (enchère, qualité)`} />
        <Stat label="En haut de page" value={pct(top, 1)} sub={<>dont {pct(absTop, 0)} en toute première position <Delta cur={top ?? 0} prev={pTop ?? 0} show={scope.compare} /></>} />
      </section>

      <Panel title="Impressions obtenues et perdues, jour par jour" sub="Part obtenue, perdue faute de budget, perdue au classement (campagnes Search).">
        <IsBars days={days} />
        <div className="op-legend"><span className="l-spent">Obtenues</span><span className="l-proj">Perdues (budget)</span><span className="l-rank">Perdues (classement)</span></div>
        {share !== null && (
          <p style={{ margin: "14px 0 0" }}>
            {(lr ?? 0) > (lb ?? 0) * 1.5
              ? <>Le frein principal est le <strong>classement</strong> ({pct(lr, 0)} perdues contre {pct(lb, 0)} faute de budget) : remonter le Quality Score (annonces et pages plus proches des recherches) rapporte plus qu&apos;augmenter le budget.</>
              : (lb ?? 0) > 0.1
                ? <>Le <strong>budget</strong> limite la diffusion ({pct(lb, 0)} perdues) : à budget constant, recentre-le sur les mots-clés et heures qui convertissent.</>
                : <>Peu d&apos;impressions perdues : la diffusion n&apos;est pas le frein, regarde plutôt le CTR et le taux de conversion.</>}
            {" "}CTR moyen : {pct(ctr, 1)}.
          </p>
        )}
      </Panel>

      <Panel title="CPC des mots-clés face au marché" sub={`Les ${market.length} mots-clés qui coûtent le plus : ${above} au-dessus du marché, ${lowQs} avec un Quality Score de 4 ou moins.`}>
        {market.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>Pas d&apos;estimation de marché sur la période (mots-clés sans clic ou sans estimation Google).</p>
        ) : (
          <div className="op-mkt">
            <div className="op-mkt-head"><span>Mot-clé</span><span /><span className="num">Votre CPC</span><span className="num">Marché</span><span className="num">Qualité</span><span>Verdict</span></div>
            {market.map(({ k, cpc, lo, hi, verdict }) => (
              <div className="op-mkt-row" key={k.key}>
                <span className="op-kw-text">{fmtKw(k.text, k.matchType)}</span>
                <span className="op-mkt-track" title={`Marché ${eur(lo)} – ${eur(hi)} · votre CPC ${eur(cpc)}`}>
                  <span className="op-mkt-band" style={{ left: `${(lo / scaleMax) * 100}%`, width: `${((hi - lo) / scaleMax) * 100}%` }} />
                  <span className={`op-mkt-dot ${verdict === "au-dessus" ? "bad" : ""}`} style={{ left: `${(cpc / scaleMax) * 100}%` }} />
                </span>
                <span className="num"><strong>{eur(cpc)}</strong></span>
                <span className="num op-kw-sub" style={{ marginTop: 0 }}>{eur(lo)} – {eur(hi)}</span>
                <span className={`num op-qs ${k.qs === null ? "" : k.qs <= 3 ? "bad" : k.qs <= 5 ? "warn" : "good"}`}>{k.qs === null ? "–" : `${k.qs}/10`}</span>
                <span><span className={`op-tag ${verdict === "au-dessus" ? "red" : verdict === "en dessous" ? "blue" : "green"}`}>{verdict === "au-dessus" ? "Au-dessus" : verdict === "en dessous" ? "En dessous" : "Dans la fourchette"}</span></span>
              </div>
            ))}
            <p className="dg-foot" style={{ margin: "10px 0 0" }}>Point : votre CPC moyen sur la période. Bande : de l&apos;enchère 1re page à l&apos;enchère haut de page estimées par Google.</p>
          </div>
        )}
      </Panel>
    </OptPage>
  );
}

function IsBars({ days }: { days: DayRow[] }) {
  const byDate = new Map<string, { imp: number; elig: number; lb: number; lr: number }>();
  for (const d of days) {
    if (d.is === null || d.is <= 0) continue;
    const elig = d.impressions / d.is;
    const e = byDate.get(d.date) ?? { imp: 0, elig: 0, lb: 0, lr: 0 };
    e.imp += d.impressions; e.elig += elig; e.lb += (d.lostBudget ?? 0) * elig; e.lr += (d.lostRank ?? 0) * elig;
    byDate.set(d.date, e);
  }
  const list = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (!list.length) return <p style={{ margin: 0, color: "var(--muted)" }}>Pas de données de part d&apos;impressions sur la période.</p>;
  return (
    <div className="op-isbars">
      {list.map(([date, e]) => {
        const s = e.imp / e.elig, b = e.lb / e.elig, r = Math.max(0, 1 - s - b);
        return (
          <div key={date} className="op-isbar" title={`${date} : ${Math.round(s * 100)} % obtenues, ${Math.round(b * 100)} % perdues budget, ${Math.round(r * 100)} % perdues classement`}>
            <div className="op-isbar-stack">
              <span className="rk" style={{ height: `${r * 100}%` }} />
              <span className="bd" style={{ height: `${b * 100}%` }} />
              <span className="ok" style={{ height: `${s * 100}%` }} />
            </div>
            <div className="op-histo-x">{new Date(date + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })}</div>
          </div>
        );
      })}
    </div>
  );
}
