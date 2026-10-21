"use client";
// Simulateur « et si » : on bouge le taux de signature, le coût par lead, le budget ou la
// valeur d'une vente, et on voit tout de suite le coût par vente, les ventes et le bénéfice.
import { useState } from "react";
import RentaGauge from "./RentaGauge";
import { compute, type RentaInput } from "@/lib/optimize/rentabilite-calc";

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const n1 = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

interface Props {
  inp: RentaInput;
  /** taux prospect → client réel, en % (100 si vente en ligne) */
  rate: number;
  /** coût réel d'un lead (ou d'une conversion) */
  unitCost: number;
  /** dépense mensuelle réelle (ou, à défaut, budget conseillé) */
  budget: number;
}

export default function SimuRenta({ inp, rate, unitCost, budget }: Props) {
  const lead = inp.mode === "lead";
  const base = { rate: Math.max(1, rate), unit: Math.max(1, unitCost), budget: Math.max(100, budget), panier: Math.max(1, inp.panier) };
  const [rt, setRt] = useState(base.rate);
  const [unit, setUnit] = useState(base.unit);
  const [bud, setBud] = useState(base.budget);
  const [pan, setPan] = useState(base.panier);

  const t = compute({ ...inp, panier: pan });
  const leads = bud / unit;
  const ventes = leads * (lead ? rt / 100 : 1);
  const cpa = ventes > 0 ? bud / ventes : null;
  const profit = ventes * t.mc3 - bud;
  const baseT = compute(inp);
  const baseVentes = (base.budget / base.unit) * (lead ? base.rate / 100 : 1);
  const baseProfit = baseVentes * baseT.mc3 - base.budget;
  const changed = rt !== base.rate || unit !== base.unit || bud !== base.budget || pan !== base.panier;

  const Slider = ({ label, v, set, min, max, step, f, ref0 }: { label: string; v: number; set: (n: number) => void; min: number; max: number; step: number; f: (n: number) => string; ref0: number }) => (
    <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
      <span style={{ display: "flex", justifyContent: "space-between" }}><span>{label}</span><span><strong>{f(v)}</strong> <span style={{ opacity: 0.6 }}>(réel {f(ref0)})</span></span></span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(Number(e.target.value))} aria-label={label} />
    </label>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
        {lead && <Slider label="Taux devis → vente" v={rt} set={setRt} min={1} max={Math.max(60, Math.ceil(base.rate * 2))} step={0.5} f={(n) => `${n1(n)} %`} ref0={base.rate} />}
        <Slider label={lead ? "Coût par lead" : "Coût par vente"} v={unit} set={setUnit} min={Math.max(1, Math.round(base.unit * 0.2))} max={Math.round(base.unit * 2.5)} step={Math.max(1, Math.round(base.unit / 100))} f={eur} ref0={base.unit} />
        <Slider label="Budget pub par mois" v={bud} set={setBud} min={Math.round(base.budget * 0.2)} max={Math.round(base.budget * 3)} step={Math.max(10, Math.round(base.budget / 100))} f={eur} ref0={base.budget} />
        <Slider label="Valeur d'une vente" v={pan} set={setPan} min={Math.round(base.panier * 0.5)} max={Math.round(base.panier * 2)} step={Math.max(1, Math.round(base.panier / 100))} f={eur} ref0={base.panier} />
      </div>
      <div style={{ margin: "18px 0 6px" }}><RentaGauge cpa={cpa} cible={t.cpaCible} critique={t.cpaCritique} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 8 }}>
        <Out label="Coût par vente" v={cpa === null ? "–" : eur(cpa)} />
        <Out label={lead ? "Leads par mois" : "Ventes"} v={n1(leads)} />
        <Out label="Ventes par mois" v={n1(ventes)} />
        <Out label="Chiffre d'affaires" v={eur(ventes * pan)} />
        <Out label="Bénéfice après pub" v={eur(profit)} tone={profit >= 0 ? "#2e9e5b" : "#d64545"} />
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 13 }}>
        {changed
          ? <>Par rapport à aujourd&apos;hui : bénéfice {profit >= baseProfit ? "+" : "−"}{eur(Math.abs(profit - baseProfit))} par mois. </>
          : <>Déplace un curseur pour voir l&apos;effet sur le bénéfice. </>}
        Bénéfice après pub = ventes × marge avant publicité ({eur(t.mc3)}) − budget.
        {changed && <> <button type="button" className="ui-btn ui-btn-ghost" style={{ marginLeft: 8 }} onClick={() => { setRt(base.rate); setUnit(base.unit); setBud(base.budget); setPan(base.panier); }}>Revenir au réel</button></>}
      </p>
    </div>
  );
}

function Out({ label, v, tone }: { label: string; v: string; tone?: string }) {
  return <div><div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 600, color: tone }}>{v}</div></div>;
}
