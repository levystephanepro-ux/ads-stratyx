// Compte rendu du mois : tout ce qui a été fait sur le compte, jour par jour,
// d'après le journal Google Ads (change_event), avec les résultats du mois.
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import PrintButton from "@/components/PrintButton";
import CopyTextButton from "@/components/CopyTextButton";
import { getDashboardContext } from "@/lib/workspace";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { isLive } from "@/lib/google-ads/config";
import { searchRaw } from "@/lib/google-ads/client";
import { readChanges, CHANGE_KINDS, type ChangeLine } from "@/lib/reports/changes";
import { frDate } from "@/lib/reports/periods";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SP = Promise<{ account?: string; month?: string; kind?: string }>;
const eur = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function CompteRendu({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;
  const { accounts, defaultCustomerId } = await getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true });
  const account = sp.account ?? defaultCustomerId ?? accounts[0]?.customerId ?? "";
  const accName = accounts.find((a) => a.customerId === account)?.name ?? account;

  const now = new Date();
  const months = [0, 1].map((i) => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)); return iso(d).slice(0, 7); });
  const month = months.includes(sp.month ?? "") ? sp.month! : months[0];
  const [yy, mm] = month.split("-").map(Number);
  const start = new Date(Date.UTC(yy, mm - 1, 1));
  const monthEnd = new Date(Date.UTC(yy, mm, 0));
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const end = monthEnd < yesterday ? monthEnd : yesterday;
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 864e5) + 1);
  const pStart = new Date(Date.UTC(yy, mm - 2, 1));
  const pEnd = new Date(pStart); pEnd.setUTCDate(pStart.getUTCDate() + days - 1);

  let lines: ChangeLine[] = []; let since = iso(start); let error: string | null = null;
  let res = { cost: 0, conv: 0, clicks: 0 }, prev = { cost: 0, conv: 0, clicks: 0 };
  if (!isLive()) error = "Mode démo : le compte rendu lit un vrai compte Google Ads.";
  else if (end < start) error = "Le mois vient de commencer : rien à afficher avant demain.";
  else {
    try {
      const sel = "SELECT metrics.cost_micros, metrics.conversions, metrics.clicks FROM customer WHERE ";
      const tot = (rows: { metrics?: Record<string, unknown> }[]) => rows.reduce((a, r) => ({ cost: a.cost + Number(r.metrics?.costMicros ?? 0) / 1e6, conv: a.conv + Number(r.metrics?.conversions ?? 0), clicks: a.clicks + Number(r.metrics?.clicks ?? 0) }), { cost: 0, conv: 0, clicks: 0 });
      const [ch, a, b] = await Promise.all([
        readChanges({ customerId: account }, iso(start), iso(end)),
        searchRaw({ customerId: account }, `${sel} segments.date BETWEEN '${iso(start)}' AND '${iso(end)}'`),
        searchRaw({ customerId: account }, `${sel} segments.date BETWEEN '${iso(pStart)}' AND '${iso(pEnd)}'`),
      ]);
      lines = ch.lines; since = ch.clampedSince; res = tot(a); prev = tot(b);
    } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }

  const kinds = [...new Set(lines.map((l) => l.kind))];
  const shown = sp.kind ? lines.filter((l) => l.kind === sp.kind) : lines;
  const byDay = new Map<string, ChangeLine[]>();
  shown.forEach((l) => byDay.set(l.date, [...(byDay.get(l.date) ?? []), l]));
  const d = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)} % vs période précédente` : "pas de base de comparaison");
  const monthLabel = start.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  const href = (o: { account?: string; month?: string; kind?: string | null }) => {
    const q = new URLSearchParams({ account: o.account ?? account, month: o.month ?? month });
    const k = o.kind === undefined ? sp.kind : o.kind; if (k) q.set("kind", k);
    return `/rapports/compte-rendu?${q}`;
  };
  const text = [
    `Compte rendu · ${accName} · ${monthLabel}`,
    `Résultats du ${frDate(iso(start))} au ${frDate(iso(end))} : dépense ${eur(res.cost)}, ${Math.round(res.conv * 10) / 10} conversion(s), ${res.clicks} clics.`,
    "", "Actions menées :",
    ...[...byDay.entries()].flatMap(([day, ls]) => [`${frDate(day)}`, ...ls.map((l) => `- ${l.text}${l.detail.length ? ` : ${l.detail.join(", ")}` : ""}`)]),
  ].join("\n");

  return (
    <Shell active="rapports" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <div className="subtitle no-print" style={{ fontSize: 13 }}><Link href="/rapports">Rapports</Link> › Compte rendu</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "6px 0" }}>
        <h1 style={{ margin: 0, textTransform: "capitalize" }}>Compte rendu · {monthLabel}</h1>
        <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {months.map((m) => <Link key={m} href={href({ month: m })} className={`pill ${m === month ? "ok" : ""}`}>{new Date(m + "-01T00:00:00Z").toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })}</Link>)}
        </div>
      </div>
      <p className="subtitle" style={{ marginTop: 0 }}>Tout ce qui a été fait dans le mois, jour par jour, prêt pour le client. Chaque ligne vient du journal Google Ads : datée, avec son auteur.</p>
      {accounts.length > 1 && (
        <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {accounts.map((a) => <Link key={a.customerId} href={href({ account: a.customerId, kind: null })} className={`pill ${a.customerId === account ? "ok" : ""}`}>{a.name}</Link>)}
        </div>
      )}

      {error ? <div className="card" style={{ borderColor: "var(--red)" }}>{error}</div> : (
        <>
          <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 12 }}>
            <div className="subtitle" style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12, textTransform: "uppercase" }}>Résultats du {frDate(iso(start))} au {frDate(iso(end))} · comparés au {frDate(iso(pStart))} → {frDate(iso(pEnd))}</div>
            <div><div className="subtitle" style={{ margin: 0, fontSize: 12 }}>DÉPENSE</div><div style={{ fontSize: 22, fontWeight: 700 }}>{eur(res.cost)}</div><div className="subtitle" style={{ margin: 0, fontSize: 12 }}>{d(res.cost, prev.cost)}</div></div>
            <div><div className="subtitle" style={{ margin: 0, fontSize: 12 }}>CONVERSIONS</div><div style={{ fontSize: 22, fontWeight: 700 }}>{Math.round(res.conv * 10) / 10}</div><div className="subtitle" style={{ margin: 0, fontSize: 12 }}>{d(res.conv, prev.conv)}</div></div>
            <div><div className="subtitle" style={{ margin: 0, fontSize: 12 }}>COÛT PAR CONVERSION</div><div style={{ fontSize: 22, fontWeight: 700 }}>{res.conv ? eur(res.cost / res.conv) : "aucune conversion"}</div></div>
            <div><div className="subtitle" style={{ margin: 0, fontSize: 12 }}>CLICS</div><div style={{ fontSize: 22, fontWeight: 700 }}>{res.clicks}</div><div className="subtitle" style={{ margin: 0, fontSize: 12 }}>{d(res.clicks, prev.clicks)}</div></div>
          </div>

          <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Link href={href({ kind: null })} className={`pill ${!sp.kind ? "ok" : ""}`}>Tout</Link>
              {kinds.map((k) => <Link key={k} href={href({ kind: k })} className={`pill ${sp.kind === k ? "ok" : ""}`}>{CHANGE_KINDS[k] ?? k} {lines.filter((l) => l.kind === k).length}</Link>)}
            </div>
            <div style={{ display: "flex", gap: 8 }}><CopyTextButton text={text} /><PrintButton /></div>
          </div>
          <p className="subtitle" style={{ fontSize: 13 }}>{shown.length} modification(s) sur {byDay.size} jour(s){since > iso(start) ? ` · Google conserve 30 jours d'historique : journal lu à partir du ${frDate(since)}` : ""}</p>

          {byDay.size === 0 ? <div className="card"><p className="subtitle" style={{ margin: 0 }}>Aucune modification sur la période.</p></div> : (
            [...byDay.entries()].map(([day, ls]) => (
              <div key={day} className="card" style={{ marginBottom: 10, padding: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <strong style={{ textTransform: "capitalize" }}>{new Date(day + "T00:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</strong>
                  <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>{ls.length} modification(s)</span>
                </div>
                {ls.map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, padding: "10px 16px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                    <span className="subtitle" style={{ margin: 0, fontSize: 12, width: 40, flexShrink: 0 }}>{l.time}</span>
                    <div style={{ flex: 1 }}>
                      <div>{l.text}</div>
                      {l.detail.length > 0 && <div className="subtitle" style={{ margin: "2px 0 0", fontSize: 12 }}>{l.detail.slice(0, 6).join(" · ")}{l.detail.length > 6 ? ` (+${l.detail.length - 6})` : ""}</div>}
                    </div>
                    <span className="subtitle" style={{ margin: 0, fontSize: 12, textAlign: "right" }}>{l.author || "–"}<br />{l.tool}</span>
                  </div>
                ))}
              </div>
            ))
          )}
          <p className="subtitle" style={{ fontSize: 11 }}>Source : journal Google Ads (change_event) lu par l&apos;API ; modifications d&apos;un même type, d&apos;une même campagne et d&apos;un même jour regroupées.</p>
        </>
      )}
    </Shell>
  );
}
