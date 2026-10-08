"use client";
// Graphiques du tableau de bord (SVG maison, sans librairie) :
// courbes par métrique (période vs précédente), courbes croisées, appareils,
// part d'impressions jour par jour, position dans les résultats.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { Day, DeviceRow, Missed, ShareDay } from "@/lib/dashboard";

// ---------- formats ----------
const fr = (n: number, d = 0) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const F = {
  eur: (n: number) => `${fr(n, n < 100 ? 2 : 0)} €`,
  eur0: (n: number) => `${fr(n)} €`,
  int: (n: number) => fr(Math.round(n)),
  n1: (n: number) => fr(Math.round(n * 10) / 10, n % 1 ? 1 : 0),
  pct: (n: number) => `${fr(n * 100, 1)} %`,
  pct0: (n: number) => `${fr(n * 100)} %`,
};
const short = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

// ---------- métriques jour par jour ----------
export type MetricKey = "cost" | "clicks" | "conv" | "cpc" | "ctr" | "cvr" | "impressions" | "cpa";
export const METRICS: Record<MetricKey, { label: string; get: (d: Day) => number | null; fmt: (n: number) => string; color: string }> = {
  cost: { label: "Dépense", get: (d) => d.cost, fmt: F.eur, color: "#2f6fb0" },
  impressions: { label: "Impressions", get: (d) => d.impressions, fmt: F.int, color: "#2f9e77" },
  clicks: { label: "Clics", get: (d) => d.clicks, fmt: F.int, color: "#e0912a" },
  ctr: { label: "CTR", get: (d) => (d.impressions ? d.clicks / d.impressions : null), fmt: F.pct, color: "#8b5cf6" },
  conv: { label: "Conversions", get: (d) => d.conv, fmt: F.n1, color: "#d64545" },
  cpc: { label: "CPC moyen", get: (d) => (d.clicks ? d.cost / d.clicks : null), fmt: F.eur, color: "#64748b" },
  cvr: { label: "Taux de conversion", get: (d) => (d.clicks ? d.conv / d.clicks : null), fmt: F.pct, color: "#0e7490" },
  cpa: { label: "Coût / conversion", get: (d) => (d.conv ? d.cost / d.conv : null), fmt: F.eur, color: "#b45309" },
};

// ---------- courbe générique ----------
interface Series { name: string; values: (number | null)[]; dates: string[]; color: string; dashed?: boolean; fill?: boolean; fmt: (n: number) => string }

const PL = 52, PR = 12, PT = 12, PB = 26, FS = 11;

function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  return step * 4;
}

/** Chemin lissé (Catmull-Rom → Bézier), points nuls ignorés (coupure). */
function smoothPath(pts: ([number, number] | null)[], bottom: number): string {
  const segs: [number, number][][] = [];
  let cur: [number, number][] = [];
  pts.forEach((p) => { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } });
  if (cur.length) segs.push(cur);
  const top = PT;
  const cl = (y: number) => Math.max(top, Math.min(bottom, y));
  return segs.map((s) => {
    if (s.length === 1) return `M${s[0][0]},${s[0][1]}h0.01`;
    let d = `M${s[0][0]},${s[0][1]}`;
    for (let i = 0; i < s.length - 1; i++) {
      const p0 = s[i - 1] ?? s[i], p1 = s[i], p2 = s[i + 1], p3 = s[i + 2] ?? p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = cl(p1[1] + (p2[1] - p0[1]) / 6);
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = cl(p2[1] - (p3[1] - p1[1]) / 6);
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }).join(" ");
}

/** Largeur réelle du conteneur : 1 unité SVG = 1 pixel, le texte garde sa taille. */
function useWidth(initial = 320) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const set = () => setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    set();
    const ro = new ResizeObserver(set); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function LineChart({ series, yMax: fixedMax, yFmt, normalize = false, rightLabels = false, height = 170 }: {
  series: Series[]; yMax?: number; yFmt: (n: number) => string; normalize?: boolean; rightLabels?: boolean; height?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [box, W] = useWidth();
  const H = height;
  const [hover, setHover] = useState<number | null>(null);
  const n = Math.max(...series.map((s) => s.values.length), 0);
  const pr = rightLabels ? 70 : PR;
  const pl = normalize ? 12 : PL;
  const innerW = W - pl - pr, innerH = H - PT - PB;
  const max = fixedMax ?? niceMax(Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null))));
  const x = (i: number) => (n <= 1 ? pl + innerW / 2 : pl + (i / (n - 1)) * innerW);
  const yOf = (v: number, s: Series) => {
    const m = normalize ? Math.max(0, ...s.values.filter((u): u is number => u !== null)) || 1 : max;
    return PT + innerH - (Math.min(Math.max(0, v), m) / m) * innerH * (normalize ? 0.92 : 1);
  };
  if (!n) return <div ref={box}><p className="subtitle" style={{ fontSize: 13 }}>Pas de données sur la période.</p></div>;
  const ticks = [0, 1, 2, 3, 4].map((i) => (max * i) / 4);
  const nl = Math.max(2, Math.min(8, Math.floor(innerW / 85), n));
  const labelIdx = [...new Set([...Array(nl).keys()].map((k) => Math.round((k * (n - 1)) / Math.max(1, nl - 1))))];
  const ref0 = series[0];

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    const vx = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((vx - pl) / innerW) * (n - 1)))));
  };

  return (
    <div ref={box} style={{ position: "relative" }}>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={series.map((s) => s.name).join(", ")}>
        {!normalize && ticks.map((t) => {
          const yy = PT + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={pl} x2={W - pr} y1={yy} y2={yy} style={{ stroke: "var(--border)" }} strokeWidth={0.6} />
              <text x={pl - 6} y={yy + 4} textAnchor="end" fontSize={FS} style={{ fill: "var(--muted)" }}>{yFmt(t)}</text>
            </g>
          );
        })}
        {normalize && [0, 1, 2, 3, 4].map((i) => {
          const yy = PT + (innerH * i) / 4;
          return <line key={i} x1={pl} x2={W - pr} y1={yy} y2={yy} style={{ stroke: "var(--border)" }} strokeWidth={0.6} />;
        })}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 7} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={FS} style={{ fill: "var(--muted)" }}>
            {ref0.dates[i] ? short(ref0.dates[i]) : ""}
          </text>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : ([x(i), yOf(v, s)] as [number, number])));
          const d = smoothPath(pts, PT + innerH);
          const valid = pts.filter((p): p is [number, number] => !!p);
          return (
            <g key={s.name}>
              {s.fill && valid.length > 1 && (
                <path d={`${d} L${valid[valid.length - 1][0]},${PT + innerH} L${valid[0][0]},${PT + innerH} Z`} style={{ fill: s.color, opacity: 0.1 }} />
              )}
              <path d={d} fill="none" style={{ stroke: s.color }} strokeWidth={s.dashed ? 1.5 : 2.2} strokeDasharray={s.dashed ? "4 4" : undefined} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
        {rightLabels && (() => {
          const labs = series.map((s) => {
            const last = s.values[s.values.length - 1];
            return last === null || last === undefined ? null : { s, text: s.fmt(last), y: yOf(last, s) };
          }).filter((l): l is { s: Series; text: string; y: number } => !!l).sort((a, b) => a.y - b.y);
          for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 13) labs[i].y = labs[i - 1].y + 13;
          return labs.map((l) => <text key={l.s.name} x={W - pr + 6} y={l.y + 4} fontSize={FS} fontWeight={600} style={{ fill: l.s.color }}>{l.text}</text>);
        })()}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PT} y2={PT + innerH} style={{ stroke: "var(--muted)" }} strokeWidth={0.6} strokeDasharray="2 2" />
            {series.map((s) => {
              const v = s.values[hover];
              return v === null || v === undefined ? null : <circle key={s.name} cx={x(hover)} cy={yOf(v, s)} r={3.2} style={{ fill: "var(--surface)", stroke: s.color }} strokeWidth={1.4} />;
            })}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="dash-tip" style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${x(hover) / W > 0.6 ? "-105%" : "8px"})` }}>
          {series.map((s) => {
            const v = s.values[hover];
            return (
              <div key={s.name} className="dash-tip-row">
                <span className="dash-dot" style={{ background: s.color, opacity: s.dashed ? 0.6 : 1 }} />
                <span>{s.dates[hover] ? short(s.dates[hover]) : s.name}</span>
                <strong>{v === null || v === undefined ? "–" : s.fmt(v)}</strong>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IaLink({ href }: { href?: string }) {
  if (!href) return null;
  return <Link href={href} className="dash-ia" title="Expliquer cette évolution avec l'IA">✦ Expliquer</Link>;
}

// ---------- 1. courbes par métrique ----------
export function MetricCharts({ cur, prev, ia }: { cur: Day[]; prev: Day[]; ia: Partial<Record<MetricKey, string>> }) {
  const keys: MetricKey[] = ["cost", "clicks", "conv", "cpc", "ctr", "cvr"];
  return (
    <>
      <div className="dash-legend">
        <span><i className="dash-line" /> période</span>
        <span><i className="dash-line dashed" /> période précédente</span>
      </div>
      <div className="dash-charts">
        {keys.map((k) => {
          const m = METRICS[k];
          const s: Series[] = [
            { name: "Période", values: cur.map(m.get), dates: cur.map((d) => d.date), color: "var(--accent)", fill: true, fmt: m.fmt },
            { name: "Période précédente", values: prev.map(m.get), dates: prev.map((d) => d.date), color: "var(--muted)", dashed: true, fmt: m.fmt },
          ];
          return (
            <div key={k} className="card dash-chart">
              <div className="dash-chart-head">
                <span className="dash-kicker">{m.label}</span>
                <IaLink href={ia[k]} />
              </div>
              <LineChart series={s} yFmt={k === "ctr" || k === "cvr" ? F.pct0 : k === "cost" || k === "cpc" ? F.eur0 : F.n1} />
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------- 2. courbes croisées ----------
export function CrossChart({ cur }: { cur: Day[] }) {
  const all: MetricKey[] = ["cost", "impressions", "clicks", "ctr", "conv", "cpc", "cvr"];
  const [on, setOn] = useState<MetricKey[]>(["cost", "impressions", "clicks", "ctr"]);
  const series: Series[] = on.map((k) => ({
    name: METRICS[k].label, values: cur.map(METRICS[k].get), dates: cur.map((d) => d.date), color: METRICS[k].color, fmt: METRICS[k].fmt,
  }));
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="dash-chart-head">
        <span className="dash-kicker">Courbes croisées</span>
        <span className="subtitle" style={{ margin: 0, fontSize: 11 }}>chaque courbe à sa propre échelle</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0 8px" }}>
        {all.map((k) => {
          const active = on.includes(k);
          return (
            <button key={k} type="button" className={`dash-toggle ${active ? "on" : ""}`}
              onClick={() => setOn(active ? on.filter((x) => x !== k) : [...on, k])}>
              <span className="dash-dot" style={{ background: METRICS[k].color }} />{METRICS[k].label}
            </button>
          );
        })}
      </div>
      {series.length ? <LineChart series={series} yFmt={F.n1} normalize rightLabels height={270} /> : <p className="subtitle" style={{ fontSize: 13 }}>Coche au moins une courbe.</p>}
    </div>
  );
}

// ---------- 3. appareils ----------
const DEVICE_COLORS = ["#2f6fb0", "#2f9e77", "#e0912a", "#8b5cf6", "#64748b"];
export function DevicesDonut({ devices, ia }: { devices: DeviceRow[]; ia?: string }) {
  const [metric, setMetric] = useState<"clicks" | "cost" | "conv">("clicks");
  const fmt = metric === "cost" ? F.eur0 : metric === "conv" ? F.n1 : F.int;
  const total = devices.reduce((a, d) => a + d[metric], 0);
  const R = 40, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="card">
      <div className="dash-chart-head">
        <span className="dash-kicker">{metric === "clicks" ? "Clics" : metric === "cost" ? "Dépense" : "Conversions"} par appareil</span>
        <IaLink href={ia} />
      </div>
      <div style={{ display: "flex", gap: 6, margin: "6px 0 10px" }}>
        {([["clicks", "Clics"], ["cost", "Dépense"], ["conv", "Conversions"]] as const).map(([k, l]) => (
          <button key={k} type="button" className={`dash-toggle ${metric === k ? "on" : ""}`} onClick={() => setMetric(k)}>{l}</button>
        ))}
      </div>
      {!total ? <p className="subtitle" style={{ fontSize: 13 }}>Pas de données sur la période.</p> : (
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <svg viewBox="0 0 110 110" style={{ width: 130, height: 130, flex: "none" }} role="img" aria-label="Répartition par appareil">
            <circle cx={55} cy={55} r={R} fill="none" style={{ stroke: "var(--surface-2)" }} strokeWidth={14} />
            {devices.map((d, i) => {
              const len = (d[metric] / total) * C;
              const el = (
                <circle key={d.device} cx={55} cy={55} r={R} fill="none" stroke={DEVICE_COLORS[i % DEVICE_COLORS.length]} strokeWidth={14}
                  strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 55 55)" />
              );
              acc += len;
              return el;
            })}
            <text x={55} y={51} textAnchor="middle" fontSize={8} style={{ fill: "var(--muted)" }}>Total</text>
            <text x={55} y={64} textAnchor="middle" fontSize={13} fontWeight={700} style={{ fill: "var(--text)" }}>{fmt(total)}</text>
          </svg>
          <div style={{ flex: 1, minWidth: 160, display: "grid", gap: 8 }}>
            {devices.map((d, i) => (
              <div key={d.device} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <span className="dash-dot" style={{ background: DEVICE_COLORS[i % DEVICE_COLORS.length] }} />
                <span style={{ flex: 1 }}>{d.label}</span>
                <strong>{fmt(d[metric])}</strong>
                <span className="subtitle" style={{ margin: 0, fontSize: 12, minWidth: 40, textAlign: "right" }}>{F.pct0(d[metric] / total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 4. part d'impressions jour par jour ----------
export function ShareDaily({ daily, got, missedBudget, missedRank, ia, children }: {
  daily: ShareDay[]; got: Missed | null; missedBudget: Missed | null; missedRank: Missed | null; ia?: string; children?: ReactNode;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const rows: [string, string, Missed | null, boolean][] = [
    ["Obtenu", "var(--accent)", got, false],
    ["Manqué faute de budget", "#5b8fd6", missedBudget, true],
    ["Manqué au classement (enchère, qualité)", "#e0912a", missedRank, true],
  ];
  const h = hover !== null ? daily[hover] : null;
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="dash-chart-head">
        <strong>Part d&apos;impressions Search</strong>
        <IaLink href={ia} />
      </div>
      {!got ? <p className="subtitle" style={{ fontSize: 13 }}>Pas de campagne Search sur la période.</p> : (
        <>
          <table className="dash-table">
            <thead><tr><th /><th>Impr.</th><th>Clics</th><th>Conv.</th></tr></thead>
            <tbody>
              {rows.map(([l, c, m, approx]) => (
                <tr key={l}>
                  <td><span className="dash-dot" style={{ background: c }} /> {l}</td>
                  <td>{m ? `${approx ? "≈ " : ""}${F.int(m.impr)}` : "–"}</td>
                  <td>{m ? `${approx ? "≈ " : ""}${F.int(m.clicks)}` : "–"}</td>
                  <td>{m ? `${approx ? "≈ " : ""}${F.n1(m.conv)}` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ position: "relative" }}>
            <div className="dash-bars" onMouseLeave={() => setHover(null)}>
              {daily.map((d, i) => {
                const s = d.share ?? 0, b = d.lostBudget ?? 0, r = d.lostRank ?? 0;
                const tot = s + b + r || 1;
                return (
                  <div key={d.date} className={`dash-bar ${hover === i ? "hl" : ""}`} onMouseEnter={() => setHover(i)}>
                    {d.share === null ? <div style={{ flex: 1, background: "var(--surface-2)" }} /> : (
                      <>
                        <div style={{ flex: r / tot, background: "#e0912a", opacity: 0.75 }} />
                        <div style={{ flex: b / tot, background: "#5b8fd6", opacity: 0.85 }} />
                        <div style={{ flex: s / tot, background: "var(--accent)", opacity: 0.8 }} />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {h && hover !== null && (
              <div className="dash-tip" style={{ top: 10, left: `${((hover + 0.5) / daily.length) * 100}%`, transform: `translateX(${hover / daily.length > 0.6 ? "-105%" : "8px"})` }}>
                <div style={{ fontWeight: 600, marginBottom: 2, textTransform: "capitalize" }}>{longDate(h.date)}</div>
                {h.share === null ? <div>Pas d&apos;affichage ce jour-là</div> : (
                  <>
                    <div className="dash-tip-row"><span className="dash-dot" style={{ background: "var(--accent)" }} /><span>Obtenue</span><strong>{F.pct(h.share)}</strong></div>
                    <div className="dash-tip-row"><span className="dash-dot" style={{ background: "#5b8fd6" }} /><span>Perdue (budget)</span><strong>{F.pct(h.lostBudget ?? 0)}</strong></div>
                    <div className="dash-tip-row"><span className="dash-dot" style={{ background: "#e0912a" }} /><span>Perdue (classement)</span><strong>{F.pct(h.lostRank ?? 0)}</strong></div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="dash-xaxis">
            <span>{daily[0] ? short(daily[0].date) : ""}</span>
            <span>{daily.length > 2 ? short(daily[Math.floor(daily.length / 2)].date) : ""}</span>
            <span>{daily.length ? short(daily[daily.length - 1].date) : ""}</span>
          </div>
          <div className="dash-legend" style={{ marginTop: 6 }}>
            <span><span className="dash-dot" style={{ background: "var(--accent)" }} /> Part obtenue</span>
            <span><span className="dash-dot" style={{ background: "#5b8fd6" }} /> Perdue faute de budget</span>
            <span><span className="dash-dot" style={{ background: "#e0912a" }} /> Perdue au classement</span>
          </div>
          {children}
        </>
      )}
    </div>
  );
}

// ---------- 5. position dans les résultats ----------
export function Position({ top, absTop, daily, ia }: { top: number | null; absTop: number | null; daily: ShareDay[]; ia?: string }) {
  const dates = useMemo(() => daily.map((d) => d.date), [daily]);
  if (top === null) return null;
  const series: Series[] = [
    { name: "1re position", values: daily.map((d) => d.absTop), dates, color: "#8b5cf6", fmt: F.pct0 },
    { name: "Au-dessus des résultats naturels", values: daily.map((d) => d.top), dates, color: "#2f9e77", fmt: F.pct0 },
  ];
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="dash-chart-head">
        <strong>Position dans les résultats</strong>
        <IaLink href={ia} />
      </div>
      <div className="dash-pos">
        <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <div><div className="dash-big" style={{ color: "#8b5cf6" }}>{F.pct0(absTop ?? 0)}</div><div className="dash-cap"><span className="dash-dot" style={{ background: "#8b5cf6" }} /> En 1re position</div></div>
          <div><div className="dash-big" style={{ color: "#2f9e77" }}>{F.pct0(top)}</div><div className="dash-cap"><span className="dash-dot" style={{ background: "#2f9e77" }} /> Au-dessus des résultats naturels (1re position comprise)</div></div>
          <div><div className="dash-big" style={{ color: "#5b8fd6" }}>{F.pct0(Math.max(0, 1 - top))}</div><div className="dash-cap"><span className="dash-dot" style={{ background: "#5b8fd6" }} /> En dessous des résultats naturels</div></div>
        </div>
        <div className="dash-serp" aria-hidden>
          <div className="dash-serp-top">
            <div className="dash-serp-ad first"><b>Annonce</b><i /><i /></div>
            <div className="dash-serp-ad"><b>Annonce</b><i /><i /></div>
          </div>
          <div className="dash-serp-org"><i /><span>Résultats naturels</span><i /></div>
          <div className="dash-serp-ad bottom"><b>Annonce</b><i /><i /></div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <LineChart series={series} yMax={1} yFmt={F.pct0} height={200} />
      </div>
      <div className="dash-legend" style={{ marginTop: 4 }}>
        <span><span className="dash-dot" style={{ background: "#8b5cf6" }} /> 1re position (tout en haut)</span>
        <span><span className="dash-dot" style={{ background: "#2f9e77" }} /> Au-dessus des résultats naturels</span>
      </div>
    </div>
  );
}
