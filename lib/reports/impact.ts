// Change Impact : pourquoi les chiffres ont bougé (décomposition volume / prix /
// taux) et effet de chaque modification (N jours avant vs N jours après).
// Tout est calculé à partir de Google Ads, sans IA.
import { searchRaw, type AdsContext } from "@/lib/google-ads/client";
import { readChanges, type ChangeLine } from "./changes";

export interface Agg { cost: number; clicks: number; conv: number }
const Z = (): Agg => ({ cost: 0, clicks: 0, conv: 0 });
const plus = (a: Agg, b: Agg): Agg => ({ cost: a.cost + b.cost, clicks: a.clicks + b.clicks, conv: a.conv + b.conv });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

export interface CampaignDelta { name: string; cur: Agg; prev: Agg; dCost: number; dConv: number }
export interface Decomposition {
  cur: Agg; prev: Agg;
  curRange: { since: string; until: string }; prevRange: { since: string; until: string };
  /** Δ dépense = effet volume de clics + effet coût par clic (somme exacte). */
  costVolume: number; costPrice: number;
  /** Δ conversions = effet volume de clics + effet taux de conversion (somme exacte). */
  convVolume: number; convRate: number;
  campaigns: CampaignDelta[];
}

export type Verdict = "mieux" | "moins bien" | "stable" | "trop tôt" | "peu de volume";
export interface ChangeImpact {
  date: string; campaign: string; items: ChangeLine[];
  before: Agg; after: Agg; beforeDays: number; afterDays: number;
  verdict: Verdict; note: string;
}

export interface ImpactResult {
  decomposition: Decomposition;
  impacts: ChangeImpact[];
  window: number;
  clampedSince: string;
}

const perDay = (a: Agg, d: number): Agg => (d ? { cost: a.cost / d, clicks: a.clicks / d, conv: a.conv / d } : Z());
const n1 = (x: number) => (Math.round(x * 10) / 10).toLocaleString("fr-FR");
const eur = (x: number) => `${Math.round(x).toLocaleString("fr-FR")} €`;

function judge(b: Agg, a: Agg, bd: number, ad: number): { verdict: Verdict; note: string } {
  const pb = perDay(b, bd), pa = perDay(a, ad);
  const base = `dépense/jour ${eur(pb.cost)} → ${eur(pa.cost)} · clics/jour ${n1(pb.clicks)} → ${n1(pa.clicks)}`;
  if (ad < 3) return { verdict: "trop tôt", note: `${ad} jour(s) de recul seulement. ${base}` };
  if (b.conv + a.conv < 4) {
    return { verdict: "peu de volume", note: `${n1(b.conv)} conv. avant, ${n1(a.conv)} après : trop peu pour conclure. ${base}` };
  }
  const cpaB = b.conv ? b.cost / b.conv : Infinity, cpaA = a.conv ? a.cost / a.conv : Infinity;
  const txt = `conv./jour ${n1(pb.conv)} → ${n1(pa.conv)} · CPA ${Number.isFinite(cpaB) ? eur(cpaB) : "–"} → ${Number.isFinite(cpaA) ? eur(cpaA) : "–"} · ${base}`;
  if (cpaA < cpaB * 0.85 && pa.conv >= pb.conv * 0.8) return { verdict: "mieux", note: txt };
  if (cpaA > cpaB * 1.15 || pa.conv < pb.conv * 0.7) return { verdict: "moins bien", note: txt };
  return { verdict: "stable", note: txt };
}

export async function buildImpact(ctx: AdsContext, window = 7, now = new Date()): Promise<ImpactResult> {
  const today = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
  const y = addDays(today, -1);
  const curRange = { since: addDays(y, -29), until: y };
  const prevRange = { since: addDays(y, -59), until: addDays(y, -30) };

  const [rows, ch] = await Promise.all([
    searchRaw(ctx, `SELECT segments.date, campaign.name, metrics.cost_micros, metrics.clicks, metrics.conversions
      FROM campaign WHERE segments.date BETWEEN '${prevRange.since}' AND '${y}' AND metrics.impressions > 0`),
    readChanges(ctx, curRange.since, y),
  ]);

  // date → campagne → chiffres, et date → total compte
  const byDayCamp = new Map<string, Map<string, Agg>>();
  const byDay = new Map<string, Agg>();
  const curC = new Map<string, Agg>(), prevC = new Map<string, Agg>();
  for (const r of rows) {
    const d = String(r.segments?.date ?? ""); const name = String(r.campaign?.name ?? "");
    const v: Agg = { cost: Number(r.metrics?.costMicros ?? 0) / 1e6, clicks: Number(r.metrics?.clicks ?? 0), conv: Number(r.metrics?.conversions ?? 0) };
    const m = byDayCamp.get(d) ?? new Map<string, Agg>();
    m.set(name, plus(m.get(name) ?? Z(), v)); byDayCamp.set(d, m);
    byDay.set(d, plus(byDay.get(d) ?? Z(), v));
    const bucket = d >= curRange.since ? curC : prevC;
    bucket.set(name, plus(bucket.get(name) ?? Z(), v));
  }

  // 1) Décomposition période vs période précédente
  const cur = [...curC.values()].reduce(plus, Z()), prev = [...prevC.values()].reduce(plus, Z());
  const cpc0 = prev.clicks ? prev.cost / prev.clicks : 0, cpc1 = cur.clicks ? cur.cost / cur.clicks : 0;
  const cvr0 = prev.clicks ? prev.conv / prev.clicks : 0, cvr1 = cur.clicks ? cur.conv / cur.clicks : 0;
  const names = new Set([...curC.keys(), ...prevC.keys()]);
  const campaigns: CampaignDelta[] = [...names].map((name) => {
    const c = curC.get(name) ?? Z(), p = prevC.get(name) ?? Z();
    return { name, cur: c, prev: p, dCost: c.cost - p.cost, dConv: c.conv - p.conv };
  }).filter((c) => c.cur.cost + c.prev.cost > 0)
    .sort((a, b) => Math.abs(b.dCost) - Math.abs(a.dCost)).slice(0, 15);

  const decomposition: Decomposition = {
    cur, prev, curRange, prevRange,
    costVolume: (cur.clicks - prev.clicks) * cpc0, costPrice: cur.clicks * (cpc1 - cpc0),
    convVolume: (cur.clicks - prev.clicks) * cvr0, convRate: cur.clicks * (cvr1 - cvr0),
    campaigns,
  };

  // 2) Effet de chaque modification, regroupée par jour et par campagne
  const groups = new Map<string, ChangeLine[]>();
  for (const l of ch.lines) {
    const k = `${l.date}|${l.campaign}`;
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  const sum = (from: string, to: string, campaign: string) => {
    let a = Z(); let d = from;
    while (d <= to) {
      const v = campaign ? byDayCamp.get(d)?.get(campaign) : byDay.get(d);
      if (v) a = plus(a, v);
      d = addDays(d, 1);
    }
    return a;
  };
  const days = (from: string, to: string) => (to < from ? 0 : Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1);

  const impacts: ChangeImpact[] = [...groups.entries()].slice(0, 40).map(([k, items]) => {
    const [date, campaign] = k.split("|");
    const bFrom = addDays(date, -window), bTo = addDays(date, -1);
    const aFrom = addDays(date, 1), aTo = addDays(date, window) < y ? addDays(date, window) : y;
    const before = sum(bFrom, bTo, campaign), after = sum(aFrom, aTo, campaign);
    const bd = days(bFrom, bTo), ad = days(aFrom, aTo);
    return { date, campaign, items, before, after, beforeDays: bd, afterDays: ad, ...judge(before, after, bd, ad) };
  });

  return { decomposition, impacts, window, clampedSince: ch.clampedSince };
}
