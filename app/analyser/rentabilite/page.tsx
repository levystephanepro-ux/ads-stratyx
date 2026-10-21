// Rentabilité : KPI cibles (CPA, ROAS, CPL, budget) à partir des marges, taux devis → vente
// mesuré, diagnostic du compte, des campagnes, des mots-clés et des recherches, et
// simulateur « et si ». Sans IA.
import OptPage from "@/components/opt/OptPage";
import Table, { type Col } from "@/components/opt/Table";
import RentaGauge from "@/components/opt/RentaGauge";
import SimuRenta from "@/components/opt/SimuRenta";
import { Notice, Panel, Stat } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { getScope, type ScopeParams } from "@/lib/optimize/scope";
import { campaignPerf, keywordReport, termReport, eur, fmtKw, int, type CampaignPerf, type KeywordRow, type Metrics, type TermRow } from "@/lib/optimize/data";
import { compute, effectiveRate, EXEMPLE, lastMonths, leadsByMonth, readRenta, readSales, verdict, VERDICT_TXT, type RentaInput, type Targets, type Verdict } from "@/lib/optimize/rentabilite";
import { saveRentabiliteAction, saveVentesAction } from "../../optimiser/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const x2 = (n: number | null) => (n === null ? "–" : n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const e0 = (n: number) => eur(n, 0);
const TONE: Record<Verdict, string> = { bon: "good", limite: "warn", perte: "bad", aucune: "" };
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const monthName = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

interface Row { id: string; name: string; cost: number; conv: number; ventes: number | null; cpa: number | null; roas: number | null; v: Verdict; dry: boolean; lostBudget: number | null }

export default async function Rentabilite({ searchParams }: { searchParams: Promise<ScopeParams> }) {
  const sp = await searchParams;
  const scope = await getScope("/analyser/rentabilite", sp);
  const cid = scope.account?.customerId ?? "";
  const saved = cid ? await readRenta(cid) : null;
  const base: RentaInput = saved ?? EXEMPLE;
  const lead = base.mode === "lead";

  // Taux devis → vente : mesuré à partir des ventes signées saisies, sinon celui saisi.
  const [sales, leadsM] = cid && saved && lead
    ? await Promise.all([readSales(cid), leadsByMonth(cid).catch(() => ({} as Record<string, number>))])
    : [{}, {} as Record<string, number>];
  const eff = effectiveRate(base, sales, leadsM);
  const inp: RentaInput = lead ? { ...base, conv: eff.rate } : base;
  const t = compute(inp);

  let perf: CampaignPerf[] = [];
  let kws: KeywordRow[] = [];
  let terms: TermRow[] = [];
  let err: string | null = null;
  if (scope.ads && saved) {
    try {
      [perf, kws, terms] = await Promise.all([
        campaignPerf(scope.ads, scope.p, scope.campaignId),
        keywordReport(scope.ads, scope.p, scope.campaignId).catch(() => [] as KeywordRow[]),
        termReport(scope.ads, scope.p, scope.campaignId).catch(() => [] as TermRow[]),
      ]);
    } catch (e) { err = e instanceof Error ? e.message : String(e); }
  }
  const conv = lead && inp.conv > 0 ? inp.conv / 100 : 1;
  // Seuil sous lequel une dépense sans résultat est encore normale : le coût d'un lead (ou d'une vente) au seuil de perte.
  const dryLimit = lead ? (t.cplCritique ?? 0) : t.cpaCritique;
  const row = (id: string, name: string, m: Metrics, lostBudget: number | null = null): Row => {
    const ventes = lead ? m.conversions * conv : m.conversions;
    const cpa = ventes > 0 ? m.cost / ventes : null;
    const rev = lead ? ventes * inp.panier : m.value;
    const dry = m.conversions === 0 && dryLimit > 0 && m.cost >= dryLimit;
    return { id, name, cost: m.cost, conv: m.conversions, ventes, cpa, roas: m.cost > 0 && rev > 0 ? rev / m.cost : null, v: dry ? "perte" : verdict(cpa, t), dry, lostBudget };
  };
  const rows = perf.filter((c) => c.cur.cost > 0).map((c) => row(c.id, c.name, c.cur, c.cur.lostBudget)).sort((a, b) => b.cost - a.cost);
  const kwRows = kws.filter((k) => k.cur.cost > 0).map((k) => row(k.key, `${fmtKw(k.text, k.matchType)} · ${k.campaign}`, k.cur)).sort((a, b) => b.cost - a.cost);
  const termRows = terms.filter((k) => k.cur.cost > 0).map((k) => row(`${k.campaignId}|${k.term}`, `${k.term} · ${k.campaign}`, k.cur)).sort((a, b) => b.cost - a.cost);
  const lossOf = (rs: Row[]) => rs.filter((r) => r.v === "perte").reduce((s, r) => s + r.cost, 0);
  const tot: Metrics = perf.reduce((s, c) => ({ cost: s.cost + c.cur.cost, conversions: s.conversions + c.cur.conversions, value: s.value + c.cur.value, clicks: 0, impressions: 0 }), { cost: 0, conversions: 0, value: 0, clicks: 0, impressions: 0 });
  const all = saved ? row("all", "Compte", tot) : null;
  const advice = saved && all ? advise(inp, t, all, rows, scope.p.days) : [];
  const msg = sp.msg ? { ok: sp.msg.startsWith("ok:"), text: sp.msg.replace(/^(ok|err):/, "") } : null;
  const monthly = all ? (all.cost / Math.max(1, scope.p.days)) * 30 : 0;
  const unitCost = all && all.conv > 0 ? all.cost / all.conv : lead ? t.cplCible ?? 50 : t.cpaCible;

  const cols = (first: string): Col<Row>[] => [
    { id: "name", label: first, render: (r) => <strong>{r.name}</strong> },
    { id: "cost", label: "Dépense", num: true, render: (r) => eur(r.cost) },
    { id: "conv", label: lead ? "Leads" : "Conversions", num: true, render: (r) => int(r.conv) },
    { id: "cpa", label: "Coût par vente", num: true, render: (r) => (r.cpa === null ? "–" : eur(r.cpa)) },
    { id: "roas", label: "ROAS", num: true, render: (r) => x2(r.roas) },
    { id: "g", label: "Position", render: (r) => <RentaGauge cpa={r.cpa ?? (r.dry ? t.cpaCritique * 1.4 : null)} cible={t.cpaCible} critique={t.cpaCritique} small /> },
    { id: "v", label: "Verdict", render: (r) => <span className={`op-tag ${r.v === "bon" ? "green" : r.v === "limite" ? "" : r.v === "perte" ? "red" : "blue"}`}>{r.dry ? "Dépensé sans résultat" : r.cost > 0 && r.v === "aucune" ? "Trop tôt pour juger" : VERDICT_TXT[r.v]}</span> },
  ];
  const months = lastMonths(6);
  const nowM = new Date().toISOString().slice(0, 7);

  return (
    <OptPage
      scope={scope}
      title="Rentabilité : ROAS et KPI cibles"
      sub={saved ? <>CPA cible {eur(t.cpaCible)} · CPA critique {eur(t.cpaCritique)} · ROAS cible {x2(t.roasCible)} · ROAS critique {x2(t.roasCritique)}{all ? <> — le compte est : <strong>{VERDICT_TXT[all.v].toLowerCase()}</strong>.</> : null}</> : "Renseigne tes marges pour obtenir ton CPA cible, ton ROAS de rentabilité et ton budget."}
      filters="period"
      ia="Analyse la rentabilité de mon compte par rapport à mon CPA cible et mon ROAS critique, et dis-moi quelles campagnes, mots-clés ou recherches couper, garder ou pousser, avec les chiffres"
      help={<>
        <p>Tu saisis la <strong>valeur d&apos;une vente</strong> et tes coûts en % de cette valeur. Stratyx en déduit :</p>
        <p><strong>CPA critique</strong> = ce qui reste après tous tes coûts : au-delà, chaque vente fait perdre de l&apos;argent (ROAS critique = seuil de rentabilité). <strong>CPA cible</strong> = CPA critique moins le bénéfice voulu : c&apos;est le coût maximum à viser. <strong>ROAS</strong> = valeur de la vente ÷ CPA.</p>
        <p>En <strong>génération de leads</strong>, le taux devis → vente convertit tes leads en ventes : <strong>CPL cible</strong> = CPA cible × taux. Tu peux le saisir à la main ou, mieux, laisser Stratyx le <strong>mesurer</strong> : note chaque mois les ventes signées, et le taux est calculé sur tes vrais chiffres (au moins 10 leads, mois en cours exclu).</p>
        <p>Le diagnostic compare le coût par vente réel à ces seuils pour le compte, chaque campagne, chaque mot-clé et chaque recherche. Une ligne sans conversion est « dépensée sans résultat » quand sa dépense dépasse déjà ce qu&apos;un lead peut coûter au maximum.</p>
        <p>Le <strong>simulateur</strong> montre l&apos;effet d&apos;un meilleur taux de signature, d&apos;un coût par lead plus bas ou d&apos;un autre budget sur ton bénéfice. Rien n&apos;est modifié dans Google Ads.</p>
      </>}
    >
      {msg && <Notice tone={msg.ok ? "ok" : "err"}>{msg.ok ? "✓ " : ""}{msg.text}</Notice>}
      {err && <Notice tone="err">Lecture des campagnes impossible : {err.slice(0, 200)}</Notice>}
      {!saved && <Notice tone="warn">Valeurs d&apos;exemple (boutique en ligne à 120 €). Remplace-les par les tiens et enregistre pour lancer le diagnostic.</Notice>}

      <form action={saveRentabiliteAction} className="ui-panel">
        <input type="hidden" name="customer_id" value={cid} />
        <input type="hidden" name="back" value={scope.href({ msg: null })} />
        <div className="ui-stat-label">Tes chiffres{scope.account ? ` · ${scope.account.name}` : ""}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, margin: "10px 0" }}>
          <Field label="Type d'activité">
            <select name="mode" defaultValue={base.mode} className="op-mini-select">
              <option value="lead">Génération de leads (devis, contacts)</option>
              <option value="ecom">Vente en ligne</option>
            </select>
          </Field>
          <Num name="panier" label="Valeur moyenne d'une vente HT (€)" v={base.panier} />
          <Num name="cogs" label="Coûts variables : production, pose (%)" v={base.cogs} />
          <Num name="livraison" label="Livraison, distribution (%)" v={base.livraison} />
          <Num name="transaction" label="Frais de transaction, commissions (%)" v={base.transaction} />
          <Num name="agence" label="Coûts marketing hors pub (%)" v={base.agence} />
          <Num name="opex" label="Coûts fixes : salaires, locaux (%)" v={base.opex} />
          <Num name="benefice" label="Bénéfice net voulu (%)" v={base.benefice} />
          <Num name="conv" label="Devis → vente estimé (%, leads)" v={base.conv} />
          <Num name="ca" label="Objectif de CA mensuel HT (€)" v={base.ca} />
        </div>
        <SubmitButton className="ui-btn ui-btn-ghost" pending="…">Enregistrer et analyser</SubmitButton>
      </form>

      {!t.viable && <Notice tone="err">Avec ces coûts il ne reste aucune marge pour la publicité : {x2(t.mc3)} € par vente. Baisse les coûts ou augmente la valeur de la vente avant de dépenser en publicité.</Notice>}

      <section className="ui-panel op-stats4">
        <Stat label="CPA cible" value={eur(t.cpaCible)} sub="coût max par vente pour le bénéfice voulu" />
        <Stat label="CPA critique" value={eur(t.cpaCritique)} sub="seuil de rentabilité : au-delà, tu perds" />
        <Stat label="ROAS cible" value={x2(t.roasCible)} sub="à viser" />
        <Stat label="ROAS critique" value={x2(t.roasCritique)} sub="en dessous, tu perds de l'argent" />
        {lead && <Stat label="CPL cible" value={eur(t.cplCible ?? 0)} sub={`max par lead (critique ${eur(t.cplCritique ?? 0)})`} />}
        <Stat label="Budget mensuel conseillé" value={e0(t.budgetMois)} sub={`${e0(t.budgetJour)} par jour · ${int(t.ventes)} ventes${lead ? ` · ${int(t.leads ?? 0)} leads` : ""}`} />
      </section>

      {saved && lead && (
        <Panel title="Ventes signées : ton vrai taux devis → vente" sub={eff.measured ? `Taux mesuré : ${x2(eff.rate)} % (${int(eff.signed)} ventes pour ${int(eff.leads)} leads sur ${eff.months} mois). C'est lui qui sert au diagnostic.` : `Pas encore assez de données (il faut au moins 10 leads sur des mois complets) : le taux saisi, ${x2(base.conv)} %, est utilisé.`}>
          <form action={saveVentesAction}>
            <input type="hidden" name="customer_id" value={cid} />
            <input type="hidden" name="back" value={scope.href({ msg: null })} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
              {months.map((m) => (
                <label key={m} style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <span><strong>{monthName(m)}</strong> · {int(leadsM[m] ?? 0)} leads{m === nowM ? " (en cours, non compté)" : (sales[m] ?? null) !== null && (leadsM[m] ?? 0) > 0 ? ` · ${x2(((sales[m] ?? 0) / leadsM[m]) * 100)} %` : ""}</span>
                  <input name={`m_${m}`} inputMode="numeric" defaultValue={sales[m] !== undefined ? String(sales[m]) : ""} placeholder="ventes signées" className="op-target-input" aria-label={`Ventes signées ${monthName(m)}`} />
                </label>
              ))}
            </div>
            <p className="dg-foot" style={{ margin: "10px 0" }}>Compte les devis signés qui viennent de la publicité. Laisse vide un mois que tu ne sais pas. Les leads viennent de Google Ads (conversions).</p>
            <SubmitButton className="ui-btn ui-btn-ghost" pending="…">Enregistrer les ventes</SubmitButton>
          </form>
        </Panel>
      )}

      {all && (
        <>
          <Panel title="Le compte contre tes cibles" sub={`Période : ${scope.p.label}`}>
            <div className="op-land">
              <div className={`op-land-pct ${TONE[all.v]}`}>{all.cpa === null ? "–" : eur(all.cpa)}</div>
              <div className="op-land-side">
                <strong>{VERDICT_TXT[all.v]}</strong>
                <span>coût par vente réel · cible {eur(t.cpaCible)} · critique {eur(t.cpaCritique)} · ROAS réel {x2(all.roas)}</span>
              </div>
            </div>
            <div style={{ marginTop: 16 }}><RentaGauge cpa={all.cpa} cible={t.cpaCible} critique={t.cpaCritique} /></div>
            <ul style={{ margin: "14px 0 0", paddingLeft: 18 }}>
              {advice.map((a, i) => <li key={i} style={{ marginBottom: 6 }}>{a}</li>)}
            </ul>
          </Panel>
          <Panel title="Et si ? Simulateur" sub="Bouge un curseur : coût par vente, ventes et bénéfice se recalculent. Les valeurs de départ sont tes chiffres réels.">
            <SimuRenta key={`${Math.round(eff.rate * 10)}-${Math.round(unitCost)}-${Math.round(monthly)}`} inp={inp} rate={lead ? inp.conv : 100} unitCost={unitCost} budget={monthly > 0 ? monthly : t.budgetMois} />
          </Panel>
          <Panel title="Campagne par campagne" sub="Triées par dépense. Le verdict compare le coût par vente à ta cible et à ton seuil de rentabilité." flush>
            <Table cols={cols("Campagne")} rows={rows} rowKey={(r) => r.id} limit={25} empty="Aucune campagne n'a dépensé sur la période." />
          </Panel>
          <Panel title="Mot-clé par mot-clé" sub={kwRows.length ? `${e0(lossOf(kwRows))} dépensés sur des mots-clés au-dessus du seuil de perte ou sans résultat.` : undefined} flush>
            <Table cols={cols("Mot-clé · campagne")} rows={kwRows} rowKey={(r) => r.id} limit={15} empty="Aucun mot-clé n'a dépensé sur la période." />
          </Panel>
          <Panel title="Recherche par recherche" sub={termRows.length ? `${e0(lossOf(termRows))} dépensés sur des recherches au-dessus du seuil de perte ou sans résultat. Ajoute-les en négatifs depuis Termes de recherche.` : undefined} flush>
            <Table cols={cols("Recherche · campagne")} rows={termRows} rowKey={(r) => r.id} limit={15} empty="Aucune recherche n'a dépensé sur la période." />
          </Panel>
        </>
      )}
      <p className="dg-foot">Coût par vente = dépense ÷ conversions{lead ? ` × taux devis → vente (${x2(inp.conv)} %${eff.measured ? ", mesuré" : ", saisi"})` : ""}. Les coûts en % s&apos;appliquent à la valeur moyenne d&apos;une vente.</p>
    </OptPage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "grid", gap: 4, fontSize: 13 }}><span>{label}</span>{children}</label>;
}
function Num({ name, label, v }: { name: string; label: string; v: number }) {
  return <Field label={label}><input name={name} inputMode="decimal" defaultValue={String(v).replace(".", ",")} className="op-target-input" aria-label={label} /></Field>;
}

/** Conseils chiffrés, sans IA, tirés de l'écart entre le réel et les cibles. */
function advise(i: RentaInput, t: Targets, all: Row, rows: Row[], days: number): string[] {
  const out: string[] = [];
  if (!t.viable) return ["Le modèle économique ne laisse pas de marge pour la publicité : corrige d'abord les coûts ou la valeur de la vente."];
  if (all.cpa === null) return ["Aucune vente mesurée sur la période : vérifie le suivi des conversions avant d'interpréter la rentabilité."];
  const gap = all.cpa / t.cpaCible - 1;
  if (all.v === "bon") out.push(`Le coût par vente (${eur(all.cpa)}) est ${Math.round(-gap * 100)} % sous ta cible : tu as de la marge pour dépenser plus tant que le coût par vente reste sous ${eur(t.cpaCible)}.`);
  if (all.v === "limite") out.push(`Le coût par vente (${eur(all.cpa)}) dépasse ta cible de ${Math.round(gap * 100)} % : tu gagnes de l'argent, mais moins que les ${i.benefice} % voulus. Vise ${eur(t.cpaCible)}.`);
  if (all.v === "perte") out.push(`Le coût par vente (${eur(all.cpa)}) dépasse le seuil de rentabilité (${eur(t.cpaCritique)}) : chaque vente fait perdre ${eur(all.cpa - t.cpaCritique)} avant bénéfice. Priorité : couper ou corriger ce qui dépasse.`);
  const perte = rows.filter((r) => r.v === "perte");
  if (perte.length) {
    const c = perte.reduce((s, r) => s + r.cost, 0);
    out.push(`${perte.length} campagne${perte.length > 1 ? "s" : ""} au-dessus du seuil de rentabilité (${perte.map((r) => r.name).slice(0, 3).join(", ")}) : ${e0(c)} dépensés sur la période. Réduis leur budget ou resserre les mots-clés avant de toucher aux autres.`);
  }
  const push = rows.filter((r) => r.v === "bon" && (r.lostBudget ?? 0) > 0.1);
  if (push.length) out.push(`À pousser : ${push.map((r) => `${r.name} (${Math.round((r.lostBudget ?? 0) * 100)} % d'impressions perdues faute de budget)`).slice(0, 3).join(", ")}. Elles sont sous ta cible et plafonnées par le budget.`);
  const perMonth = all.cost / Math.max(1, days) * 30;
  if (t.budgetMois > 0) out.push(`Rythme actuel ${e0(perMonth)} par mois contre ${e0(t.budgetMois)} conseillés pour atteindre ${e0(i.ca)} de chiffre d'affaires. ${perMonth < t.budgetMois * 0.8 ? "Tu es en dessous : l'objectif ne sera atteint qu'en augmentant le budget (si le coût par vente le permet)." : perMonth > t.budgetMois * 1.2 ? "Tu dépenses plus que nécessaire pour l'objectif : vérifie que le surplus rapporte." : "C'est cohérent avec l'objectif."}`);
  if (i.mode === "lead" && t.cplCible !== null) {
    const cpl = all.conv > 0 ? all.cost / all.conv : null;
    if (cpl !== null) out.push(`Coût par lead réel ${eur(cpl)} contre ${eur(t.cplCible)} visés. ${cpl > t.cplCible ? `Deux leviers : baisser le coût par lead, ou faire passer le taux prospect → client au-dessus de ${i.conv} % (il suffit de ${Math.round((cpl / t.cpaCible) * 1000) / 10} % pour être dans la cible).` : "Le coût par lead est dans la cible."}`);
  }
  return out;
}
