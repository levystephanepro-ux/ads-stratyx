// Rentabilité : KPI cibles (CPA, ROAS, CPL, budget) à partir des marges, puis diagnostic
// du compte et de chaque campagne contre ces cibles, avec conseils chiffrés. Sans IA.
import OptPage from "@/components/opt/OptPage";
import Table, { type Col } from "@/components/opt/Table";
import { Notice, Panel, Stat } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { getScope, type ScopeParams } from "@/lib/optimize/scope";
import { campaignPerf, eur, int, type CampaignPerf } from "@/lib/optimize/data";
import { compute, EXEMPLE, readRenta, verdict, VERDICT_TXT, type RentaInput, type Targets, type Verdict } from "@/lib/optimize/rentabilite";
import { saveRentabiliteAction } from "../../optimiser/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const x2 = (n: number | null) => (n === null ? "–" : n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const e0 = (n: number) => eur(n, 0);
const TONE: Record<Verdict, string> = { bon: "good", limite: "warn", perte: "bad", aucune: "" };

interface Row { id: string; name: string; cost: number; conv: number; ventes: number | null; cpa: number | null; roas: number | null; v: Verdict; lostBudget: number | null }

export default async function Rentabilite({ searchParams }: { searchParams: Promise<ScopeParams> }) {
  const sp = await searchParams;
  const scope = await getScope("/analyser/rentabilite", sp);
  const cid = scope.account?.customerId ?? "";
  const saved = cid ? await readRenta(cid) : null;
  const inp: RentaInput = saved ?? EXEMPLE;
  const t = compute(inp);
  const lead = inp.mode === "lead";

  let perf: CampaignPerf[] = [];
  let err: string | null = null;
  if (scope.ads && saved) {
    try { perf = await campaignPerf(scope.ads, scope.p, scope.campaignId); } catch (e) { err = e instanceof Error ? e.message : String(e); }
  }
  const conv = lead && inp.conv > 0 ? inp.conv / 100 : 1;
  const row = (id: string, name: string, m: CampaignPerf["cur"]): Row => {
    const ventes = lead ? m.conversions * conv : m.conversions;
    const cpa = ventes > 0 ? m.cost / ventes : null;
    const rev = lead ? ventes * inp.panier : m.value;
    return { id, name, cost: m.cost, conv: m.conversions, ventes, cpa, roas: m.cost > 0 && rev > 0 ? rev / m.cost : null, v: verdict(cpa, t), lostBudget: m.lostBudget };
  };
  const rows = perf.filter((c) => c.cur.cost > 0).map((c) => row(c.id, c.name, c.cur)).sort((a, b) => b.cost - a.cost);
  const tot = perf.reduce((s, c) => ({ cost: s.cost + c.cur.cost, conversions: s.conversions + c.cur.conversions, value: s.value + c.cur.value, clicks: 0, impressions: 0 }), { cost: 0, conversions: 0, value: 0, clicks: 0, impressions: 0 });
  const all = saved ? row("all", "Compte", { ...tot, is: null, lostBudget: null, lostRank: null, top: null, absTop: null, eligible: 0 }) : null;
  const advice = saved && all ? advise(inp, t, all, rows, scope.p.days) : [];
  const msg = sp.msg ? { ok: sp.msg.startsWith("ok:"), text: sp.msg.replace(/^(ok|err):/, "") } : null;

  const cols: Col<Row>[] = [
    { id: "name", label: "Campagne", render: (r) => <strong>{r.name}</strong> },
    { id: "cost", label: "Dépense", num: true, render: (r) => eur(r.cost) },
    { id: "conv", label: lead ? "Leads" : "Conversions", num: true, render: (r) => int(r.conv) },
    { id: "cpa", label: "Coût par vente", num: true, render: (r) => (r.cpa === null ? "–" : eur(r.cpa)) },
    { id: "roas", label: "ROAS", num: true, render: (r) => x2(r.roas) },
    { id: "g", label: "Position", render: (r) => <Gauge cpa={r.cpa} t={t} small /> },
    { id: "v", label: "Verdict", render: (r) => <span className={`op-tag ${r.v === "bon" ? "green" : r.v === "limite" ? "" : r.v === "perte" ? "red" : "blue"}`}>{VERDICT_TXT[r.v]}</span> },
  ];

  return (
    <OptPage
      scope={scope}
      title="Rentabilité : ROAS et KPI cibles"
      sub={saved ? <>CPA cible {eur(t.cpaCible)} · CPA critique {eur(t.cpaCritique)} · ROAS cible {x2(t.roasCible)} · ROAS critique {x2(t.roasCritique)}{all ? <> — le compte est : <strong>{VERDICT_TXT[all.v].toLowerCase()}</strong>.</> : null}</> : "Renseigne tes marges pour obtenir ton CPA cible, ton ROAS de rentabilité et ton budget."}
      filters="period"
      ia="Analyse la rentabilité de mon compte par rapport à mon CPA cible et mon ROAS critique, et dis-moi quelles campagnes couper, garder ou pousser, avec les chiffres"
      help={<>
        <p>Tu saisis la <strong>valeur d&apos;une vente</strong> et tes coûts en % de cette valeur. Stratyx en déduit :</p>
        <p><strong>CPA critique</strong> = ce qui reste après tous tes coûts : au-delà, chaque vente fait perdre de l&apos;argent (ROAS critique = seuil de rentabilité). <strong>CPA cible</strong> = CPA critique moins le bénéfice voulu : c&apos;est le coût maximum à viser. <strong>ROAS</strong> = valeur de la vente ÷ CPA.</p>
        <p>En <strong>génération de leads</strong>, le taux prospect → client convertit tes leads en ventes : <strong>CPL cible</strong> = CPA cible × taux de conversion. Le budget mensuel = CPA cible × nombre de ventes pour atteindre ton objectif de chiffre d&apos;affaires.</p>
        <p>Le diagnostic compare le coût par vente réel du compte et de chaque campagne à ces seuils, sur la période choisie. Méthode inspirée du calculateur « Budget pub & KPIs cibles ».</p>
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
            <select name="mode" defaultValue={inp.mode} className="op-mini-select">
              <option value="lead">Génération de leads (devis, contacts)</option>
              <option value="ecom">Vente en ligne</option>
            </select>
          </Field>
          <Num name="panier" label="Valeur moyenne d'une vente HT (€)" v={inp.panier} />
          <Num name="cogs" label="Coûts variables : production, pose (%)" v={inp.cogs} />
          <Num name="livraison" label="Livraison, distribution (%)" v={inp.livraison} />
          <Num name="transaction" label="Frais de transaction, commissions (%)" v={inp.transaction} />
          <Num name="agence" label="Coûts marketing hors pub (%)" v={inp.agence} />
          <Num name="opex" label="Coûts fixes : salaires, locaux (%)" v={inp.opex} />
          <Num name="benefice" label="Bénéfice net voulu (%)" v={inp.benefice} />
          <Num name="conv" label="Prospect → client (%, leads)" v={inp.conv} />
          <Num name="ca" label="Objectif de CA mensuel HT (€)" v={inp.ca} />
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
            <div style={{ marginTop: 16 }}><Gauge cpa={all.cpa} t={t} /></div>
            <ul style={{ margin: "14px 0 0", paddingLeft: 18 }}>
              {advice.map((a, i) => <li key={i} style={{ marginBottom: 6 }}>{a}</li>)}
            </ul>
          </Panel>
          <Panel title="Campagne par campagne" sub="Triées par dépense. Le verdict compare le coût par vente à ta cible et à ton seuil de rentabilité." flush>
            <Table cols={cols} rows={rows} rowKey={(r) => r.id} limit={25} empty="Aucune campagne n'a dépensé sur la période." />
          </Panel>
        </>
      )}
      <p className="dg-foot">Coût par vente = dépense ÷ conversions{lead ? ` × taux prospect → client (${inp.conv} %)` : ""}. Les coûts en % s&apos;appliquent à la valeur moyenne d&apos;une vente.</p>
    </OptPage>
  );
}

/** Jauge rouge → vert : vert sous le CPA cible, orange jusqu'au CPA critique, rouge au-delà. Le repère noir est le coût par vente réel. */
function Gauge({ cpa, t, small }: { cpa: number | null; t: Targets; small?: boolean }) {
  if (t.cpaCritique <= 0) return null;
  const max = Math.max(t.cpaCritique * 1.5, (cpa ?? 0) * 1.1);
  const at = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const h = small ? 8 : 16;
  return (
    <div style={{ minWidth: small ? 120 : 0 }} aria-label={cpa === null ? "Pas de vente mesurée" : `Coût par vente ${eur(cpa)}`}>
      <div style={{ position: "relative", height: h, borderRadius: h, overflow: "visible", background: `linear-gradient(90deg, #2e9e5b 0, #2e9e5b ${at(t.cpaCible)}, #e8a21a ${at(t.cpaCible)}, #e8a21a ${at(t.cpaCritique)}, #d64545 ${at(t.cpaCritique)}, #d64545 100%)` }}>
        {cpa !== null && <span style={{ position: "absolute", left: at(cpa), top: -3, width: 4, height: h + 6, marginLeft: -2, background: "#111", border: "1px solid #fff", borderRadius: 2 }} />}
      </div>
      {!small && (
        <div style={{ position: "relative", height: 34, fontSize: 12, marginTop: 6 }}>
          <span style={{ position: "absolute", left: 0 }}>0 €</span>
          <span style={{ position: "absolute", left: at(t.cpaCible), transform: "translateX(-50%)", textAlign: "center" }}>cible<br /><strong>{eur(t.cpaCible)}</strong></span>
          <span style={{ position: "absolute", left: at(t.cpaCritique), transform: "translateX(-50%)", textAlign: "center" }}>seuil de perte<br /><strong>{eur(t.cpaCritique)}</strong></span>
          {cpa !== null && <span style={{ position: "absolute", right: 0, top: 0 }}>réel : <strong>{eur(cpa)}</strong></span>}
        </div>
      )}
    </div>
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
