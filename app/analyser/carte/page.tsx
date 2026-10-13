// Carte des causes (modèle Ades « carte ») : de la demande aux conversions, chaque
// indicateur avec sa variation vs période précédente, et chaque lien chiffré : quelle
// part de la variation vient de quoi (volume, part d'impressions, CTR, CPC…).
import OptPage from "@/components/opt/OptPage";
import { Notice, Panel } from "@/components/ui";
import { getScope, type ScopeParams } from "@/lib/optimize/scope";
import { campaignPerf, eur, int, pct, type CampaignPerf } from "@/lib/optimize/data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Side { elig: number; imp: number; clicks: number; cost: number; conv: number; lostB: number; lostR: number; top: number }

function sum(perf: CampaignPerf[], k: "cur" | "prev"): Side {
  const s: Side = { elig: 0, imp: 0, clicks: 0, cost: 0, conv: 0, lostB: 0, lostR: 0, top: 0 };
  for (const c of perf) {
    const m = c[k];
    s.imp += m.impressions; s.clicks += m.clicks; s.cost += m.cost; s.conv += m.conversions;
    s.elig += m.eligible;
    s.lostB += (m.lostBudget ?? 0) * m.eligible;
    s.lostR += (m.lostRank ?? 0) * m.eligible;
    s.top += (m.top ?? 0) * m.impressions;
  }
  return s;
}

const div = (a: number, b: number) => (b > 0 ? a / b : 0);

export default async function MapPage({ searchParams }: { searchParams: Promise<ScopeParams> }) {
  const sp = await searchParams;
  const scope = await getScope("/analyser/carte", sp);
  let perf: CampaignPerf[] = [];
  let err: string | null = null;
  if (scope.ads) {
    try { perf = await campaignPerf(scope.ads, scope.p, scope.campaignId); } catch (e) { err = e instanceof Error ? e.message : String(e); }
  }
  const a = sum(perf, "prev"), b = sum(perf, "cur");
  const v = (s: Side) => ({
    is: div(s.imp, s.elig), lb: div(s.lostB, s.elig), lr: div(s.lostR, s.elig), top: div(s.top, s.imp),
    ctr: div(s.clicks, s.imp), cpc: div(s.cost, s.clicks), cr: div(s.conv, s.clicks), cpa: div(s.cost, s.conv),
  });
  const A = v(a), B = v(b);

  // décomposition (effet de chaque facteur, l'autre étant figé)
  const eVol = (b.elig - a.elig) * A.is;
  const eShare = b.elig * (B.is - A.is);
  const eImp = (b.imp - a.imp) * A.ctr;
  const eCtr = b.imp * (B.ctr - A.ctr);
  const eClicksCost = (b.clicks - a.clicks) * A.cpc;
  const eCpc = b.clicks * (B.cpc - A.cpc);
  const eClicksConv = (b.clicks - a.clicks) * A.cr;
  const eCr = b.clicks * (B.cr - A.cr);

  // ce qui pèse le plus sur la dépense / les conversions
  const story: string[] = [];
  if (a.imp > 0) {
    if (Math.abs(eShare) > Math.abs(eVol)) story.push(`Les impressions bougent surtout par la part d'impressions (${signed(eShare)} impr.) plus que par la demande (${signed(eVol)} impr.).`);
    else story.push(`Les impressions bougent surtout avec la demande (${signed(eVol)} impr.), la part d'impressions pèse ${signed(eShare)} impr.`);
    story.push(`Clics : ${signed(eImp)} via les impressions, ${signed(eCtr)} via le CTR (${pct(B.ctr, 1)} contre ${pct(A.ctr, 1)}).`);
    story.push(`Dépense : ${signedEur(eClicksCost)} via le nombre de clics, ${signedEur(eCpc)} via le CPC (${eur(B.cpc)} contre ${eur(A.cpc)}).`);
    if (b.conv + a.conv > 0) story.push(`Conversions : ${signed(eClicksConv, 1)} via les clics, ${signed(eCr, 1)} via le taux de conversion (${pct(B.cr, 1)} contre ${pct(A.cr, 1)}).`);
    else story.push("Aucune conversion sur les deux périodes : vérifie d'abord le suivi des conversions (appels, formulaires).");
  }

  return (
    <OptPage
      scope={scope}
      title="Carte des causes"
      tour={[{ title: "Carte des causes · Pourquoi ça bouge", text: "De la demande aux conversions : chaque flèche dit combien la cause a fait bouger l'indicateur suivant. Vert : dans le bon sens, rouge : ce qui coûte." }]}
      sub={<>Ce qui fait bouger dépense et conversions · {scope.p.days} derniers jours vs les {scope.p.days} jours d&apos;avant</>}
      ia="Lis la carte des causes de mon compte : explique en clair pourquoi la dépense et les conversions ont bougé et quoi faire"
      filters="no-compare"
      help={<>
        <p>Chaque case est un indicateur, avec sa variation face à la période précédente. Chaque flèche dit <strong>combien</strong> la cause a fait bouger l&apos;indicateur suivant, en figeant les autres : en vert ce qui va dans le bon sens, en rouge ce qui coûte.</p>
        <p>Exemple : « −35 € via les clics, +31 € via le CPC » = moins de clics, mais chaque clic coûte plus cher.</p>
      </>}
    >
      {err && <Notice tone="err">Lecture impossible : {err.slice(0, 220)}</Notice>}
      <section className="ui-panel op-map-wrap">
        <CauseMap a={a} b={b} A={A} B={B} e={{ eVol, eShare, eImp, eCtr, eClicksCost, eCpc, eClicksConv, eCr }} />
      </section>
      {story.length > 0 && (
        <Panel title="En clair">
          <ul className="op-story">{story.map((s) => <li key={s}>{s}</li>)}</ul>
        </Panel>
      )}
    </OptPage>
  );
}

const signed = (n: number, d = 0) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString("fr-FR", { maximumFractionDigits: d })}`;
const signedEur = (n: number) => `${n >= 0 ? "+" : "−"}${eur(Math.abs(n))}`;

type Effects = Record<"eVol" | "eShare" | "eImp" | "eCtr" | "eClicksCost" | "eCpc" | "eClicksConv" | "eCr", number>;

function CauseMap({ a, b, A, B, e }: { a: Side; b: Side; A: Record<string, number>; B: Record<string, number>; e: Effects }) {
  const W = 1120, H = 560, NW = 168, NH = 84;
  type N = { id: string; x: number; y: number; label: string; value: string; d: number | null; up: "good" | "bad" | "neutral" };
  const rel = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : null);
  const pts = (cur: number, prev: number) => (prev > 0 || cur > 0 ? (cur - prev) : null);
  const nodes: N[] = [
    { id: "vol", x: 10, y: 30, label: "Demande (impr.)", value: int(b.elig), d: rel(b.elig, a.elig), up: "good" },
    { id: "lb", x: 10, y: 200, label: "Perdue (budget)", value: pct(B.lb, 1), d: pts(B.lb, A.lb), up: "bad" },
    { id: "lr", x: 10, y: 330, label: "Perdue (classement)", value: pct(B.lr, 1), d: pts(B.lr, A.lr), up: "bad" },
    { id: "is", x: 245, y: 250, label: "Part d'impressions", value: pct(B.is, 1), d: pts(B.is, A.is), up: "good" },
    { id: "top", x: 245, y: 440, label: "Haut de page", value: pct(B.top, 1), d: pts(B.top, A.top), up: "good" },
    { id: "imp", x: 480, y: 110, label: "Impressions", value: int(b.imp), d: rel(b.imp, a.imp), up: "good" },
    { id: "ctr", x: 480, y: 330, label: "CTR", value: pct(B.ctr, 2), d: rel(B.ctr, A.ctr), up: "good" },
    { id: "cpc", x: 710, y: 20, label: "CPC moyen", value: eur(B.cpc), d: rel(B.cpc, A.cpc), up: "bad" },
    { id: "clk", x: 710, y: 220, label: "Clics", value: int(b.clicks), d: rel(b.clicks, a.clicks), up: "good" },
    { id: "cr", x: 710, y: 420, label: "Taux de conversion", value: pct(B.cr, 1), d: rel(B.cr, A.cr), up: "good" },
    { id: "cost", x: 940, y: 20, label: "Dépense", value: eur(b.cost), d: rel(b.cost, a.cost), up: "neutral" },
    { id: "conv", x: 940, y: 240, label: "Conversions", value: int(b.conv), d: rel(b.conv, a.conv), up: "good" },
    { id: "cpa", x: 940, y: 440, label: "Coût par conversion", value: b.conv ? eur(B.cpa) : "–", d: b.conv && a.conv ? rel(B.cpa, A.cpa) : null, up: "bad" },
  ];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  type Ed = { from: string; to: string; label?: string; tone: "good" | "bad" | "flat" | "link"; dashed?: boolean };
  const tone = (n: number, goodIfUp: boolean): Ed["tone"] => (Math.abs(n) < 0.05 ? "flat" : n > 0 === goodIfUp ? "good" : "bad");
  const edges: Ed[] = [
    { from: "vol", to: "imp", label: `${signed(e.eVol)} impr.`, tone: tone(e.eVol, true) },
    { from: "is", to: "imp", label: `${signed(e.eShare)} impr.`, tone: tone(e.eShare, true) },
    { from: "lb", to: "is", tone: "link", dashed: true },
    { from: "lr", to: "is", tone: "link", dashed: true },
    { from: "top", to: "ctr", label: "position", tone: "link", dashed: true },
    { from: "imp", to: "clk", label: `${signed(e.eImp)} clics`, tone: tone(e.eImp, true) },
    { from: "ctr", to: "clk", label: `${signed(e.eCtr)} clics`, tone: tone(e.eCtr, true) },
    { from: "clk", to: "cost", label: signedEur(e.eClicksCost), tone: tone(e.eClicksCost, false) },
    { from: "cpc", to: "cost", label: signedEur(e.eCpc), tone: tone(e.eCpc, false) },
    { from: "clk", to: "conv", label: `${signed(e.eClicksConv, 1)} conv.`, tone: tone(e.eClicksConv, true) },
    { from: "cr", to: "conv", label: `${signed(e.eCr, 1)} conv.`, tone: tone(e.eCr, true) },
    { from: "cost", to: "cpa", tone: "link" },
    { from: "conv", to: "cpa", tone: "link" },
  ];
  const color = { good: "var(--green)", bad: "var(--red)", flat: "var(--muted)", link: "var(--muted)" };
  const anchor = (n: N, side: "r" | "l" | "t" | "b") =>
    side === "r" ? [n.x + NW, n.y + NH / 2] : side === "l" ? [n.x, n.y + NH / 2] : side === "t" ? [n.x + NW / 2, n.y] : [n.x + NW / 2, n.y + NH];
  return (
    <div className="op-map-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} className="op-map" role="img" aria-label="Carte des causes">
        {edges.map((ed) => {
          const f = byId[ed.from], t = byId[ed.to];
          const vertical = Math.abs(f.x - t.x) < 10;
          const [x1, y1] = vertical ? anchor(f, f.y < t.y ? "b" : "t") : anchor(f, "r");
          const [x2, y2] = vertical ? anchor(t, f.y < t.y ? "t" : "b") : anchor(t, "l");
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          const d = vertical ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
          const w = ed.tone === "good" || ed.tone === "bad" ? 4 : 2;
          return (
            <g key={ed.from + ed.to}>
              <path d={d} fill="none" stroke={color[ed.tone]} strokeWidth={w} strokeDasharray={ed.dashed ? "5 6" : undefined} opacity={ed.tone === "link" || ed.tone === "flat" ? 0.55 : 0.85} strokeLinecap="round" />
              {ed.label && (
                <g transform={`translate(${mx},${my})`}>
                  <rect x={-ed.label.length * 3.6 - 8} y={-11} width={ed.label.length * 7.2 + 16} height={22} rx={6} fill="var(--surface)" stroke="var(--border)" />
                  <text textAnchor="middle" y={4} fontSize="12" fontWeight="600" fill={color[ed.tone]}>{ed.label}</text>
                </g>
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const good = n.d === null || Math.abs(n.d) < 0.005 || n.up === "neutral" ? null : (n.d > 0) === (n.up === "good");
          const dTxt = n.d === null ? "–" : ["lb", "lr", "is", "top"].includes(n.id) ? `${n.d >= 0 ? "+" : "−"}${Math.abs(n.d * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pt` : `${n.d >= 0 ? "+" : "−"}${Math.abs(Math.round(n.d * 100))} %`;
          return (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}>
              <rect width={NW} height={NH} rx={12} fill="var(--surface)" stroke="var(--border)" />
              <text x={14} y={24} fontSize="11" fontWeight="600" letterSpacing="0.06em" fill="var(--muted)">{n.label.toUpperCase()}</text>
              <text x={14} y={52} fontSize="20" fontWeight="700" fill="var(--text)">{n.value}</text>
              <text x={14} y={72} fontSize="12.5" fontWeight="600" fill={good === null ? "var(--muted)" : good ? "var(--green)" : "var(--red)"}>{dTxt}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
