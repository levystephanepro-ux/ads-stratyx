// Évaluation des alertes pour chaque compte surveillé. Sans IA.
import { searchRaw, type RawRow } from "@/lib/google-ads/client";
import { isLive } from "@/lib/google-ads/config";
import { monitoredAccounts } from "@/lib/audit/run";
import { getMonthlyBudget } from "@/lib/dashboard";
import { setSetting, getSetting } from "@/lib/agent/store";
import { getAlertsConfig, templateOn, METRICS, type AlertsConfig, type CustomRule } from "./config";

export interface Alert { key: string; severity: "critique" | "important"; title: string; detail: string }
export interface AccountAlerts { customerId: string; name: string; alerts: Alert[]; errors: string[]; /** URL sans réponse à ce passage (comparé au passage suivant) */ unreachable?: string[] }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (base: Date, n: number) => { const d = new Date(base); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const n1 = (x: number) => (Math.round(x * 10) / 10).toLocaleString("fr-FR");

interface Agg { cost: number; clicks: number; impr: number; conv: number }
const Z = (): Agg => ({ cost: 0, clicks: 0, impr: 0, conv: 0 });
const K = (r: RawRow): Agg => ({ cost: Number(r.metrics?.costMicros ?? 0) / 1e6, clicks: Number(r.metrics?.clicks ?? 0), impr: Number(r.metrics?.impressions ?? 0), conv: Number(r.metrics?.conversions ?? 0) });
const plus = (a: Agg, b: Agg): Agg => ({ cost: a.cost + b.cost, clicks: a.clicks + b.clicks, impr: a.impr + b.impr, conv: a.conv + b.conv });

function metricValue(a: Agg, m: CustomRule["metric"]): number | null {
  switch (m) {
    case "cost": return a.cost;
    case "conv": return a.conv;
    case "clicks": return a.clicks;
    case "cpa": return a.conv ? a.cost / a.conv : null;
    case "ctr": return a.impr ? (a.clicks / a.impr) * 100 : null;
    case "cpc": return a.clicks ? a.cost / a.clicks : null;
  }
}
const fmtMetric = (m: CustomRule["metric"], v: number) =>
  METRICS[m].unit === "€" ? (m === "cpc" ? `${v.toFixed(2).replace(".", ",")} €` : eur(v)) : METRICS[m].unit === "%" ? `${n1(v)} %` : n1(v);

/**
 * Teste une URL comme un navigateur. Seules les vraies erreurs de page comptent
 * (404, 410, 5xx). 401/403/429 = pare-feu du site qui filtre les serveurs : ignoré.
 * Pas de réponse = « injoignable », signalé seulement si ça se répète au passage suivant
 * (certains hébergeurs bloquent les serveurs cloud alors que le site marche).
 */
type UrlCheck = { kind: "ok" } | { kind: "error"; status: number } | { kind: "unreachable" };
async function fetchOnce(url: string, ms: number): Promise<UrlCheck> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, {
      method: "GET", redirect: "follow", signal: ctl.signal, cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "fr-FR,fr;q=0.9",
      },
    });
    res.body?.cancel().catch(() => undefined);
    if (res.status === 404 || res.status === 410 || res.status >= 500) return { kind: "error", status: res.status };
    return { kind: "ok" };
  } catch {
    return { kind: "unreachable" };
  } finally { clearTimeout(t); }
}
async function checkUrl(url: string): Promise<UrlCheck> {
  const first = await fetchOnce(url, 12000);
  return first.kind === "ok" ? first : fetchOnce(url, 12000); // deuxième essai
}

export async function evaluateAccount(customerId: string, name: string, cfg: AlertsConfig, now = new Date(), prevUnreachable: string[] = []): Promise<AccountAlerts> {
  const ctx = { customerId };
  const errors: string[] = [];
  const alerts: Alert[] = [];
  let unreachable: string[] = [];
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const y = day(today, -1);
  const from = day(today, -38); // 30 j de référence + 7 j récents + hier

  const safe = async <T,>(label: string, fn: () => Promise<T>, fb: T): Promise<T> => {
    try { return await fn(); } catch (e) { errors.push(`${label} : ${e instanceof Error ? e.message : String(e)}`); return fb; }
  };
  const needRules = cfg.rules.length > 0;
  const [daily, campDaily, urlsRows, target] = await Promise.all([
    safe("Chiffres", () => searchRaw(ctx, `SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM customer WHERE segments.date BETWEEN '${from}' AND '${y}'`), [] as RawRow[]),
    needRules && cfg.rules.some((r) => r.campaign)
      ? safe("Campagnes", () => searchRaw(ctx, `SELECT segments.date, campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${day(today, -7)}' AND '${y}'`), [] as RawRow[])
      : Promise.resolve([] as RawRow[]),
    templateOn(cfg, "pages_erreur").on
      ? safe("URL des annonces", () => searchRaw(ctx, `SELECT ad_group_ad.ad.final_urls FROM ad_group_ad WHERE ad_group_ad.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'`), [] as RawRow[])
      : Promise.resolve([] as RawRow[]),
    getMonthlyBudget(customerId).catch(() => null),
  ]);

  const byDay = new Map<string, Agg>();
  daily.forEach((r) => { const d = String(r.segments?.date ?? ""); byDay.set(d, plus(byDay.get(d) ?? Z(), K(r))); });
  const sum = (a: string, b: string) => { let t = Z(); for (const [d, v] of byDay) if (d >= a && d <= b) t = plus(t, v); return t; };
  const yest = sum(y, y);
  const prev7 = sum(day(today, -8), day(today, -2));
  const last7 = sum(day(today, -7), y);
  const ref30 = sum(from, day(today, -8));

  // 1. Compte à l'arrêt
  if (templateOn(cfg, "compte_arret").on && daily.length && yest.cost === 0 && prev7.cost / 7 >= 3) {
    alerts.push({ key: "compte_arret", severity: "critique", title: "Le compte n'a rien dépensé hier",
      detail: `Moyenne des 7 jours d'avant : ${eur(prev7.cost / 7)} par jour. Vérifie le paiement, l'état des campagnes et les annonces refusées.` });
  }
  // 2. Dépense qui s'emballe
  const emb = templateOn(cfg, "depense_emballe");
  if (emb.on && prev7.cost > 0 && yest.cost > (prev7.cost / 7) * emb.param && yest.cost - prev7.cost / 7 >= 15) {
    alerts.push({ key: "depense_emballe", severity: "important", title: `Dépense d'hier : ${eur(yest.cost)}`,
      detail: `${n1(yest.cost / (prev7.cost / 7))} fois la moyenne des 7 jours d'avant (${eur(prev7.cost / 7)}/jour), pour ${n1(yest.conv)} conversion(s).` });
  }
  // 3. Plus de conversions
  const sc = templateOn(cfg, "sans_conversion");
  if (sc.on) {
    const n = Math.max(1, Math.round(sc.param));
    const win = sum(day(today, -n), y);
    if (win.cost >= 20 && win.conv === 0 && ref30.conv > 0) {
      alerts.push({ key: "sans_conversion", severity: "critique", title: `Aucune conversion depuis ${n} jours`,
        detail: `${eur(win.cost)} dépensés, ${win.clicks} clics, 0 conversion, alors que le compte en faisait ${n1(ref30.conv)} sur les 30 jours d'avant. Teste le formulaire et l'appel, vérifie la balise.` });
    }
  }
  // 4. CPA en hausse
  const ch = templateOn(cfg, "cpa_hausse");
  if (ch.on && last7.conv >= 3 && ref30.conv >= 3) {
    const a = last7.cost / last7.conv, b = ref30.cost / ref30.conv;
    if (a > b * ch.param) alerts.push({ key: "cpa_hausse", severity: "important", title: `Coût par conversion : ${eur(a)} sur 7 jours`,
      detail: `Contre ${eur(b)} sur les 30 jours d'avant (${n1(a / b)} fois plus). Regarde Change Impact pour la cause.` });
  }
  // 5. Budget du mois
  const bm = templateOn(cfg, "budget_mois");
  if (bm.on && target) {
    const monthStart = iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
    const daysInMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
    const spent = sum(monthStart, y).cost;
    const proj = spent + (last7.cost / 7) * (daysInMonth - today.getUTCDate() + 1);
    if (proj > target * (1 + bm.param / 100)) alerts.push({ key: "budget_mois", severity: "important", title: `Fin de mois projetée : ${eur(proj)} pour ${eur(target)}`,
      detail: `Déjà ${eur(spent)} dépensés. Pour finir à ${eur(target)} : ${eur(Math.max(0, target - spent) / (daysInMonth - today.getUTCDate() + 1))} par jour.` });
  }
  // 6. Pages en erreur
  if (templateOn(cfg, "pages_erreur").on && urlsRows.length) {
    const urls = [...new Set(urlsRows.flatMap((r) => (r.adGroupAd?.ad?.finalUrls ?? []) as string[]))].filter((u) => /^https?:\/\//.test(u)).slice(0, 15);
    const res = await Promise.all(urls.map(async (u) => ({ u, r: await checkUrl(u) })));
    const bad = res.filter((x) => x.r.kind === "error");
    unreachable = res.filter((x) => x.r.kind === "unreachable").map((x) => x.u);
    if (bad.length) alerts.push({ key: "pages_erreur", severity: "critique", title: `${bad.length} page(s) de destination en erreur`,
      detail: bad.map((b) => `${b.u} répond ${(b.r as { status: number }).status}`).join(" · ") });
    const twice = unreachable.filter((u) => prevUnreachable.includes(u));
    if (twice.length) alerts.push({ key: "pages_injoignables", severity: "important", title: `${twice.length} page(s) injoignable(s) depuis nos serveurs, deux fois de suite`,
      detail: `${twice.join(" · ")}. Ouvre-la toi-même : si elle s'affiche, c'est le pare-feu de l'hébergeur qui filtre les robots (sans gravité pour Google Ads).` });
  }
  // 7. Règles personnalisées
  for (const rule of cfg.rules) {
    if (rule.account && rule.account !== customerId) continue; // règle réservée à un autre compte
    let agg: Agg;
    const since = rule.period === "hier" ? y : day(today, -7);
    if (rule.campaign) {
      agg = Z();
      const needle = rule.campaign.toLowerCase();
      for (const r of campDaily) {
        const d = String(r.segments?.date ?? "");
        if (d >= since && d <= y && String(r.campaign?.name ?? "").toLowerCase().includes(needle)) agg = plus(agg, K(r));
      }
    } else agg = sum(since, y);
    const v = metricValue(agg, rule.metric);
    if (v === null) continue;
    if (rule.op === ">" ? v > rule.value : v < rule.value) {
      alerts.push({ key: `regle:${rule.id}`, severity: "important", title: rule.name || `${METRICS[rule.metric].label} ${rule.op} ${fmtMetric(rule.metric, rule.value)}`,
        detail: `${METRICS[rule.metric].label} ${rule.period === "hier" ? "d'hier" : "des 7 derniers jours"}${rule.campaign ? ` (campagnes « ${rule.campaign} »)` : ""} : ${fmtMetric(rule.metric, v)}, seuil ${rule.op} ${fmtMetric(rule.metric, rule.value)}.` });
    }
  }
  return { customerId, name, alerts, errors, unreachable };
}

export interface AlertsRun { ranAt: string; accounts: AccountAlerts[] }

export async function runAlertsForOwner(): Promise<AlertsRun> {
  if (!isLive()) return { ranAt: new Date().toISOString(), accounts: [] };
  const [accounts, cfg, prev] = await Promise.all([monitoredAccounts(), getAlertsConfig(), lastAlertsRun().catch(() => null)]);
  const prevOf = (id: string) => prev?.accounts.find((a) => a.customerId === id)?.unreachable ?? [];
  const out = await Promise.all(accounts.map((a) => evaluateAccount(a.customerId, a.name, cfg, new Date(), prevOf(a.customerId)).catch((e) => ({
    customerId: a.customerId, name: a.name, alerts: [], errors: [e instanceof Error ? e.message : String(e)],
  }))));
  const run = { ranAt: new Date().toISOString(), accounts: out };
  await setSetting("alerts_last", JSON.stringify(run)).catch(() => undefined);
  return run;
}

export async function lastAlertsRun(): Promise<AlertsRun | null> {
  const raw = await getSetting("alerts_last");
  try { return raw ? (JSON.parse(raw) as AlertsRun) : null; } catch { return null; }
}

export function alertsMarkdown(run: AlertsRun): string {
  const hits = run.accounts.filter((a) => a.alerts.length);
  if (!hits.length) return "";
  const lines = ["# 🚨 Alertes", ""];
  for (const a of hits) {
    lines.push(`## ${a.name}`);
    a.alerts.forEach((x) => lines.push(`- **${x.title}**${x.severity === "critique" ? " (critique)" : ""} : ${x.detail}`));
    lines.push("");
  }
  return lines.join("\n");
}
