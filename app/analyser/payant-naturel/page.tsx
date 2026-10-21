// Payant et naturel : croise les termes de recherche payants (Google Ads) avec les
// requêtes naturelles (Search Console). Où tu paies un clic déjà gagné gratuitement,
// et quel contenu manque alors que le payant convertit.
import Link from "next/link";
import OptPage from "@/components/opt/OptPage";
import Table, { type Col } from "@/components/opt/Table";
import { Notice, Panel, Stat } from "@/components/ui";
import { getScope, type ScopeParams } from "@/lib/optimize/scope";
import { termReport, eur, int, type TermRow } from "@/lib/optimize/data";
import { brandWordsOf, demoOrganic, joinPaidOrganic, type Joined } from "@/lib/optimize/organic";
import { dateRange, listSites, queryPerformance, type ScRow, type ScSite } from "@/lib/search-console/client";
import { isScLive } from "@/lib/search-console/config";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const pos = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export default async function PayantNaturel({ searchParams }: { searchParams: Promise<ScopeParams> }) {
  const sp = await searchParams;
  const scope = await getScope("/analyser/payant-naturel", sp);
  const days = Math.max(14, Math.min(90, scope.p.days));

  let terms: TermRow[] = [];
  let sites: ScSite[] = [];
  let organic: ScRow[] = [];
  let err: string | null = null;
  let scErr: string | null = null;
  const site = sp.site && sp.site.length ? sp.site : null;
  let siteUsed: string | null = null;

  if (scope.ads) {
    try { terms = await termReport(scope.ads, scope.p, scope.campaignId); } catch (e) { err = e instanceof Error ? e.message : String(e); }
  }
  try {
    sites = await listSites(scope.dash.mcpToken);
    siteUsed = (site && sites.some((s) => s.siteUrl === site) ? site : sites[0]?.siteUrl) ?? null;
    if (siteUsed) {
      const { startDate, endDate } = dateRange(days);
      organic = await queryPerformance(siteUsed, startDate, endDate, ["query"], 2000, scope.dash.mcpToken);
    }
  } catch (e) { scErr = e instanceof Error ? e.message : String(e); }
  if (!isScLive()) organic = demoOrganic();

  const brand = brandWordsOf(scope.account?.name ?? "");
  const joined = joinPaidOrganic(terms, organic, brand);
  const hasOrganic = organic.length > 0;

  const already = joined.filter((j) => j.org && j.org.position <= 3 && j.cost > 0).sort((a, b) => b.cost - a.cost);
  const alreadyCost = already.filter((j) => !j.brand).reduce((s, j) => s + j.cost, 0);
  const gap = joined.filter((j) => j.conv > 0 && (!j.org || j.org.position > 5)).sort((a, b) => b.conv - a.conv || b.cost - a.cost);
  const matched = joined.filter((j) => j.org).length;
  const totalCost = joined.reduce((s, j) => s + j.cost, 0);

  const colsAlready: Col<Joined>[] = [
    { id: "term", label: "Recherche", render: (j) => <><strong>{j.term}</strong>{j.brand && <span className="op-tag" style={{ marginLeft: 8 }}>Marque</span>}</>, total: `${already.length} recherche${already.length > 1 ? "s" : ""}` },
    { id: "cost", label: "Payant : coût", num: true, render: (j) => eur(j.cost), total: eur(already.reduce((s, j) => s + j.cost, 0)) },
    { id: "clicks", label: "Clics payants", num: true, render: (j) => int(j.clicks) },
    { id: "conv", label: "Conv.", num: true, render: (j) => int(j.conv) },
    { id: "pos", label: "Position naturelle", num: true, render: (j) => <strong>{pos(j.org!.position)}</strong> },
    { id: "oclicks", label: "Clics naturels", num: true, render: (j) => int(j.org!.clicks) },
  ];
  const colsGap: Col<Joined>[] = [
    { id: "term", label: "Recherche", render: (j) => <><strong>{j.term}</strong>{j.brand && <span className="op-tag" style={{ marginLeft: 8 }}>Marque</span>}</> },
    { id: "conv", label: "Conv. payantes", num: true, render: (j) => <strong>{int(j.conv)}</strong> },
    { id: "cost", label: "Coût", num: true, render: (j) => eur(j.cost) },
    { id: "cpa", label: "Coût / conv.", num: true, render: (j) => eur(j.cost / j.conv) },
    { id: "org", label: "Présence naturelle", render: (j) => (j.org ? <span className="op-tag blue">Position {pos(j.org.position)} · {int(j.org.impressions)} affichages</span> : <span className="op-tag red">Aucune</span>) },
  ];

  return (
    <OptPage
      scope={scope}
      title="Payant et naturel"
      sub={hasOrganic ? <>{matched} recherche{matched > 1 ? "s" : ""} payante{matched > 1 ? "s" : ""} sur {joined.length} apparaissent aussi en naturel ; {eur(alreadyCost)} payés sur des recherches où tu es déjà dans les 3 premiers.</> : "Croise ce que tu paies avec ce que tu gagnes gratuitement sur Google."}
      filters="period"
      ia="Compare mes recherches payantes et mes positions naturelles : où je paie un clic que j'aurais gratuitement, et quels contenus créer pour les recherches qui convertissent en payant"
      help={<>
        <p>La page relie les <strong>termes de recherche payants</strong> (Google Ads) aux <strong>requêtes naturelles</strong> (Search Console) du site choisi, en ignorant accents, mots vides et ordre des mots.</p>
        <p><strong>Déjà gagné gratuitement</strong> : tu paies un clic sur une recherche où ton site est déjà dans les 3 premiers résultats naturels. Ne coupe pas à l&apos;aveugle : payant et naturel ensemble captent souvent plus de clics. Teste en mettant la recherche en négatif ou en baissant l&apos;enchère sur quelques semaines et compare le total des clics.</p>
        <p><strong>Convertit en payant, absent en naturel</strong> : des recherches qui t&apos;ont déjà rapporté des demandes mais pour lesquelles aucune page ne se classe : ce sont les prochains contenus à écrire ou à renforcer.</p>
        <p>Les recherches de <strong>marque</strong> sont signalées : garde-les en payant si un concurrent peut te passer devant.</p>
      </>}
    >
      {err && <Notice tone="err">Lecture Google Ads impossible : {err.slice(0, 200)}</Notice>}
      {scErr && <Notice tone="warn">Search Console indisponible : {scErr.slice(0, 200)}. Connecte-le dans Connexions pour voir les positions naturelles.</Notice>}
      {!isScLive() && <Notice tone="warn">Mode démo : données de démonstration.</Notice>}

      {sites.length > 1 && (
        <form className="op-toolbar" action={scope.path}>
          {Object.entries(sp).filter(([k, v]) => v && !["site", "msg"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <span className="op-kw-sub" style={{ marginTop: 0 }}>Site Search Console</span>
          <select name="site" defaultValue={siteUsed ?? ""} className="op-mini-select" aria-label="Site Search Console">
            {sites.map((s) => <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>)}
          </select>
          <button className="ui-btn ui-btn-ghost" type="submit">Appliquer</button>
        </form>
      )}

      <section className="ui-panel op-stats4">
        <Stat label="Recherches payantes lues" value={int(joined.length)} sub={`${eur(totalCost)} dépensés`} />
        <Stat label="Aussi en naturel" value={int(matched)} sub={hasOrganic ? `sur ${int(organic.length)} requêtes naturelles lues` : "Search Console non lu"} />
        <Stat label="Déjà dans le top 3 gratuit" value={eur(alreadyCost)} tone={alreadyCost > 0 ? "warn" : undefined} sub="payés hors marque : à tester" />
        <Stat label="Convertit, sans page qui se classe" value={int(gap.length)} tone={gap.length ? "warn" : undefined} sub="contenus à créer ou à renforcer" />
      </section>

      <Panel title={<span className="op-h2">Tu paies alors que tu es déjà dans le top 3 gratuit</span>} sub="Recherches payantes où ton site se classe en position 1 à 3 en naturel. Test à faire avant de couper." flush>
        {!hasOrganic ? <p className="dg-empty">Pas de données naturelles : connecte Search Console.</p> : (
          <Table cols={colsAlready} rows={already} rowKey={(j) => j.key} limit={15} empty="Aucune recherche payante ne tombe dans le top 3 naturel sur la période." totalLabel="Total" />
        )}
      </Panel>

      <Panel title={<span className="op-h2">Ça convertit en payant, mais aucune page ne se classe</span>} sub="Recherches qui t'ont déjà apporté des demandes, sans présence naturelle (ou au-delà de la 5e position)." flush>
        <Table cols={colsGap} rows={gap} rowKey={(j) => j.key} limit={15} empty="Aucune recherche convertissante sans présence naturelle sur la période." />
      </Panel>

      <p className="dg-foot">
        Sources : Google Ads (termes de recherche, {scope.p.label}) et Search Console ({siteUsed ?? "aucun site"}, {days} derniers jours, décalés de 3 jours). Rapprochement sans accents, mots vides ni ordre. <Link href="/search-console">Voir Search Console</Link>.
      </p>
    </OptPage>
  );
}
