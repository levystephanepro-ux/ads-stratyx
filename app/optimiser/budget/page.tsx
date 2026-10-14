// Budget Optimizer (modèle Ades) : cible du mois, rythme de dépense, atterrissage,
// courbe cumulée et budget/jour conseillé par campagne. Rien n'est modifié dans
// Google Ads : la page donne les budgets à mettre.
import OptPage from "@/components/opt/OptPage";
import { Notice, Panel, Stat } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { getScope, type ScopeParams } from "@/lib/optimize/scope";
import { dailyByCampaign, eur, type DayRow } from "@/lib/optimize/data";
import { monthFrame, pace, readTargets, type MonthFrame } from "@/lib/optimize/budget";
import { saveBudgetTargetsAction } from "../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const e0 = (n: number) => eur(n, 0);

export default async function BudgetPage({ searchParams }: { searchParams: Promise<ScopeParams> }) {
  const sp = await searchParams;
  const scope = await getScope("/optimiser/budget", sp);
  const f = monthFrame();
  let rows: DayRow[] = [];
  let err: string | null = null;
  if (scope.ads) {
    try {
      rows = await dailyByCampaign(scope.ads, f.rateSince < f.first ? f.rateSince : f.first, f.yesterday, null);
    } catch (e) { err = e instanceof Error ? e.message : String(e); }
  }
  const targets = scope.account ? await readTargets(scope.account.customerId, f.month) : {};
  const P = pace(scope.campaigns, rows, f, targets);
  const landing = P.target > 0 ? P.projected / P.target - 1 : 0;
  const recommended = f.remaining > 0 ? Math.max(0, (P.target - P.spent) / f.remaining) : 0;
  const msg = sp.msg ? { ok: sp.msg.startsWith("ok:"), text: sp.msg.replace(/^(ok|err):/, "") } : null;
  const monthName = MONTHS[Number(f.month.slice(5)) - 1];
  const pctTxt = `${landing >= 0 ? "+" : "−"}${Math.abs(Math.round(landing * 100))} %`;

  return (
    <OptPage
      scope={scope}
      title="Budget Optimizer"
      tour={[{ title: "Budget Optimizer · Tenir le budget du mois", text: "Saisis la cible du mois : Stratyx projette la fin du mois au rythme des 7 derniers jours et donne le budget par jour à mettre pour tomber pile." }]}
      sub={<>{scope.account ? <><strong>{scope.account.name}</strong> · </> : null}Fin de mois prévue à {e0(P.projected)} pour une cible de {e0(P.target)} ({pctTxt}), au rythme récent.</>}
      ia="Analyse le rythme de dépense du mois et dis-moi comment répartir le budget restant entre les campagnes, sans dépasser la cible"
      filters="none"
      help={<>
        <p>La <strong>cible du mois</strong> est le budget à ne pas dépasser. Sans cible saisie, Stratyx prend la somme des budgets journaliers des campagnes actives × {f.daysInMonth} jours.</p>
        <p>La <strong>fin de mois prévue</strong> = dépensé depuis le 1er + rythme des 7 derniers jours × jours restants. Le <strong>budget journalier recommandé</strong> est celui qui fait tomber pile sur la cible.</p>
        <p>Rien n&apos;est modifié dans Google Ads : tu reportes les budgets toi-même (ou demandes au Copilote).</p>
      </>}
    >
      {msg && <Notice tone={msg.ok ? "ok" : "err"}>{msg.ok ? "✓ " : ""}{msg.text}</Notice>}
      {err && <Notice tone="err">Lecture des dépenses impossible : {err.slice(0, 220)}</Notice>}

      <form action={saveBudgetTargetsAction} className="ui-panel op-target">
        <input type="hidden" name="customer_id" value={scope.account?.customerId ?? ""} />
        <input type="hidden" name="month" value={f.month} />
        <input type="hidden" name="part" value="total" />
        <input type="hidden" name="back" value={scope.href({ msg: null })} />
        <div className="ui-stat-label">Cible du mois (EUR)</div>
        <div className="op-target-row">
          <input name="total" inputMode="decimal" defaultValue={P.targetIsDerived ? "" : String(P.target)} placeholder={String(Math.round(P.derived))} className="op-target-input" aria-label="Cible du mois" />
          <SubmitButton className="ui-btn ui-btn-ghost" pending="…">Enregistrer</SubmitButton>
        </div>
        <div className="ui-stat-sub">{P.targetIsDerived ? `Sans cible saisie : ${eur(P.derived)}, déduite des budgets journaliers actifs.` : `Cible saisie pour ${monthName}.`}</div>
      </form>

      <div className="op-grid2 op-cards">
        <Card label="Investi ce mois" value={eur(P.spent)} sub={`${f.elapsed} jour${f.elapsed > 1 ? "s" : ""} écoulé${f.elapsed > 1 ? "s" : ""}`} />
        <Card label="Budget mensuel prévu" value={eur(P.projected)} sub="au rythme récent de chaque campagne" />
        <Card label="Dépense moyenne par jour" value={eur(f.elapsed ? P.spent / f.elapsed : 0)} sub={`cible ${eur(P.target / f.daysInMonth)} par jour`} />
        <Card label="Budget journalier recommandé" value={eur(recommended)} sub={`pour atteindre la cible en ${f.remaining} jours`} />
        <Card label="Budget restant" value={eur(Math.max(0, P.target - P.spent))} sub={`sur ${eur(P.target)}`} />
      </div>

      <div className="op-grid2">
        <Panel title="Atterrissage (rythme actuel vs cible)">
          <div className="op-land">
            <div className={`op-land-pct ${Math.abs(landing) <= 0.05 ? "good" : landing > 0 ? "bad" : "warn"}`}>{pctTxt}</div>
            <div className="op-land-side">
              <strong>{eur(Math.abs(P.projected - P.target))}</strong>
              <span>{P.projected >= P.target ? "de dépassement prévu" : "non dépensés prévus"}</span>
            </div>
          </div>
          <Gauge ratio={P.target > 0 ? P.projected / P.target : 1} />
          <p style={{ margin: "14px 0 0" }}>{Math.abs(landing) <= 0.05 ? `Dans le rythme : ${Math.round((1 + landing) * 100)} % du prévu, cible ${e0(P.target)}.` : landing > 0 ? `Au-dessus du rythme : baisse à ${eur(recommended)}/jour au total pour finir sur la cible.` : `En dessous du rythme : il reste de la marge, jusqu'à ${eur(recommended)}/jour au total.`}</p>
        </Panel>
        <Panel title="Dépenses vs objectif">
          <Donut spent={P.spent} target={P.target} />
          <div className="op-note">Fin du mois dans {f.remaining} jour{f.remaining > 1 ? "s" : ""} · reste {P.target > 0 ? Math.max(0, Math.round((1 - P.spent / P.target) * 100)) : 0} % du budget.</div>
        </Panel>
      </div>

      <Panel title="Évolution cumulée du budget" sub="Cible linéaire, dépense cumulée et projection au rythme des 7 derniers jours.">
        <Cumul f={f} days={P.days} target={P.target} projected={P.projected} />
        <div className="op-legend"><span className="l-target">Cible cumulée</span><span className="l-spent">Dépense cumulée</span><span className="l-proj">Projection</span></div>
      </Panel>

      <form action={saveBudgetTargetsAction} className="ui-panel">
        <input type="hidden" name="customer_id" value={scope.account?.customerId ?? ""} />
        <input type="hidden" name="month" value={f.month} />
        <input type="hidden" name="back" value={scope.href({ msg: null })} />
        <input type="hidden" name="part" value="campagnes" />
        <div className="ui-panel-head">
          <div>
            <div className="ui-panel-title">Budget du mois par campagne</div>
            <div className="ui-panel-sub">Tape le budget à respecter sur le mois : la prévision se recalcule et donne le budget par jour à mettre pendant {f.remaining} jours.</div>
          </div>
          <SubmitButton className="ui-btn ui-btn-ghost" pending="…">Enregistrer</SubmitButton>
        </div>
        <div className="op-table-wrap" style={{ boxShadow: "none", margin: 0 }}>
          <table className="op-table">
            <thead><tr><th>Campagne</th><th className="num">Budget/jour</th><th className="num">Dépensé</th><th className="num">Rythme 7 j</th><th className="num">Fin de mois</th><th className="num">Budget du mois</th><th className="num">Écart</th><th className="num">À mettre/jour</th></tr></thead>
            <tbody>
              {P.list.length === 0 ? <tr><td colSpan={8} className="op-empty">Aucune campagne active.</td></tr> : P.list.map((c) => {
                const gap = c.target !== null ? c.projected - c.target : null;
                return (
                  <tr key={c.id}>
                    <td style={{ minWidth: 220 }}><span className={`op-dot ${c.status === "ENABLED" ? "on" : "off"}`} style={{ marginRight: 8 }} />{c.name}</td>
                    <td className="num">{eur(c.dailyBudget)}</td>
                    <td className="num">{eur(c.spent)}</td>
                    <td className="num">{eur(c.rate)}</td>
                    <td className="num">{eur(c.projected)}</td>
                    <td className="num"><input name={`c_${c.id}`} inputMode="decimal" defaultValue={c.target ?? ""} placeholder="–" className="op-cell-input" aria-label={`Budget du mois ${c.name}`} /></td>
                    <td className="num">{gap === null ? "–" : <span className={Math.abs(gap) < 1 ? undefined : gap > 0 ? "op-bad" : "op-good"}>{gap > 0 ? "+" : ""}{eur(gap)}</span>}</td>
                    <td className="num"><strong>{c.perDay === null ? "–" : eur(c.perDay)}</strong></td>
                  </tr>
                );
              })}
            </tbody>
            {P.list.length > 0 && (
              <tfoot><tr>
                <td>Total</td>
                <td className="num">{eur(P.list.reduce((s, c) => s + c.dailyBudget, 0))}</td>
                <td className="num">{eur(P.spent)}</td>
                <td className="num">{eur(P.rate)}</td>
                <td className="num">{eur(P.projected)}</td>
                <td className="num">–</td><td className="num" /><td className="num" />
              </tr></tfoot>
            )}
          </table>
        </div>
        <p className="dg-foot" style={{ margin: "10px 0 0" }}>Écart = fin de mois au rythme actuel − budget voulu (+ : dépassement). Sans budget saisi, une campagne garde son rythme.</p>
      </form>
    </OptPage>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <section className="ui-panel">
      <Stat label={label} value={value} sub={sub} />
    </section>
  );
}

function Gauge({ ratio }: { ratio: number }) {
  // 0,7 → bord gauche, 1 → centre, 1,3 → bord droit
  const pos = Math.max(0, Math.min(1, (ratio - 0.7) / 0.6));
  const label = Math.abs(ratio - 1) <= 0.05 ? "Sur la cible" : ratio > 1 ? "Sur-dépense" : "Sous-dépense";
  return (
    <div className="op-gauge">
      <div className="op-gauge-top"><span>Rythme de dépense</span><span className={Math.abs(ratio - 1) <= 0.05 ? "op-good" : "op-bad"}>{label} · {Math.round(ratio * 100)} %</span></div>
      <div className="op-gauge-bar"><span className="op-gauge-dot" style={{ left: `${pos * 100}%` }} /></div>
      <div className="op-gauge-x"><span>Sous-dépense</span><span>Sur la cible</span><span>Sur-dépense</span></div>
    </div>
  );
}

function Donut({ spent, target }: { spent: number; target: number }) {
  const share = target > 0 ? Math.min(1, spent / target) : 0;
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="op-donut">
      <svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label={`${Math.round(share * 100)} % dépensé`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--green)" strokeWidth="20" opacity="0.85" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--accent-2)" strokeWidth="20" strokeDasharray={`${share * c} ${c}`} transform="rotate(-90 70 70)" className="op-donut-spent" />
        <text x="70" y="64" textAnchor="middle" fontSize="12" fill="var(--muted)">{Math.round(share * 100)} %</text>
        <text x="70" y="84" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--text)">{e0(target)}</text>
      </svg>
      <div className="op-donut-legend">
        <div><span className="sw spent" />Dépensé<strong>{e0(spent)}</strong><em>{Math.round(share * 100)} %</em></div>
        <div><span className="sw left" />Restant<strong>{e0(Math.max(0, target - spent))}</strong><em>{100 - Math.round(share * 100)} %</em></div>
      </div>
    </div>
  );
}

function Cumul({ f, days, target, projected }: { f: MonthFrame; days: { date: string; cum: number }[]; target: number; projected: number }) {
  const W = 1000, H = 280, L = 64, R = 16, T = 14, B = 30;
  const n = f.daysInMonth;
  const maxY = Math.max(target, projected, days.at(-1)?.cum ?? 0) * 1.08 || 1;
  const x = (d: number) => L + ((d - 1) / (n - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / maxY) * (H - T - B);
  const step = maxY > 4000 ? 1000 : maxY > 2000 ? 500 : maxY > 800 ? 250 : maxY > 300 ? 100 : 50;
  const ticks = Array.from({ length: Math.floor(maxY / step) + 1 }, (_, i) => i * step);
  const last = days.at(-1);
  const spentPath = days.map((d, i) => `${i ? "L" : "M"}${x(i + 1).toFixed(1)},${y(d.cum).toFixed(1)}`).join(" ");
  const xs = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, n].filter((d, i, a) => d <= n && a.indexOf(d) === i && !(d === n - 1));
  const mon = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"][Number(f.month.slice(5)) - 1];
  const dot = ["mars", "mai", "juin", "août"].includes(mon) ? "" : ".";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="op-chart" role="img" aria-label="Évolution cumulée du budget">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">{t.toLocaleString("fr-FR")} €</text>
        </g>
      ))}
      {xs.map((d) => <text key={d} x={x(d)} y={H - 8} textAnchor={d === n ? "end" : "middle"} fontSize="12" fill="var(--muted)">{d} {mon}{dot}</text>)}
      <line x1={x(1)} y1={y(target / n)} x2={x(n)} y2={y(target)} stroke="var(--muted)" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
      {last && <line x1={x(days.length)} y1={y(last.cum)} x2={x(n)} y2={y(projected)} stroke="var(--orange)" strokeWidth="2.5" strokeDasharray="7 6" />}
      {days.length > 0 && <path d={spentPath} fill="none" stroke="var(--accent-2)" strokeWidth="3" strokeLinejoin="round" />}
      {days.map((d, i) => <circle key={d.date} cx={x(i + 1)} cy={y(d.cum)} r="3.5" fill="var(--accent-2)"><title>{`${d.date.slice(8)} ${mon}${dot} : ${eur(d.cum)}`}</title></circle>)}
      {last && <circle cx={x(n)} cy={y(projected)} r="4.5" fill="var(--orange)"><title>{`Projection fin de mois : ${eur(projected)}`}</title></circle>}
    </svg>
  );
}
