// Change Impact : ce qui explique l'écart vs la période précédente, et l'effet
// mesuré de chaque modification du compte (N jours avant / N jours après).
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import PrintButton from "@/components/PrintButton";
import { getDashboardContext } from "@/lib/workspace";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { isLive } from "@/lib/google-ads/config";
import { buildImpact, type ImpactResult, type Verdict } from "@/lib/reports/impact";
import { CHANGE_KINDS } from "@/lib/reports/changes";
import { frDate } from "@/lib/reports/periods";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SP = Promise<{ account?: string; w?: string; v?: string }>;
const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const eur2 = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const n1 = (x: number) => (Math.round(x * 10) / 10).toLocaleString("fr-FR");
const signed = (x: number, f: (n: number) => string) => `${x >= 0 ? "+" : "−"}${f(Math.abs(x))}`;
const pct = (a: number, b: number) => (b ? signed(((a - b) / b) * 100, (n) => `${Math.round(n)} %`) : "–");

const VERDICT: Record<Verdict, { label: string; color: string }> = {
  "mieux": { label: "Effet positif", color: "var(--green)" },
  "moins bien": { label: "Effet négatif", color: "var(--red)" },
  "stable": { label: "Sans effet net", color: "var(--muted)" },
  "trop tôt": { label: "Trop tôt", color: "var(--muted)" },
  "peu de volume": { label: "Peu de volume", color: "var(--muted)" },
};

export default async function ChangeImpactPage({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;
  const { accounts, defaultCustomerId } = await getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true });
  const account = sp.account ?? defaultCustomerId ?? accounts[0]?.customerId ?? "";
  const accName = accounts.find((a) => a.customerId === account)?.name ?? account;
  const w = sp.w === "14" ? 14 : 7;

  let data: ImpactResult | null = null; let error: string | null = null;
  if (!isLive()) error = "Mode démo : Change Impact lit un vrai compte Google Ads.";
  else {
    try { data = await buildImpact({ customerId: account }, w); }
    catch (e) { error = e instanceof Error ? e.message : String(e); }
  }

  const href = (o: { account?: string; w?: number; v?: string | null }) => {
    const q = new URLSearchParams({ account: o.account ?? account, w: String(o.w ?? w) });
    const v = o.v === undefined ? sp.v : o.v; if (v) q.set("v", v);
    return `/rapports/impact?${q}`;
  };

  const d = data?.decomposition;
  const dCost = d ? d.cur.cost - d.prev.cost : 0, dConv = d ? d.cur.conv - d.prev.conv : 0;
  const cpc = (a: { cost: number; clicks: number }) => (a.clicks ? a.cost / a.clicks : 0);
  const cvr = (a: { conv: number; clicks: number }) => (a.clicks ? (a.conv / a.clicks) * 100 : 0);
  const impacts = (data?.impacts ?? []).filter((i) => !sp.v || i.verdict === sp.v);
  const counts = (data?.impacts ?? []).reduce<Record<string, number>>((a, i) => { a[i.verdict] = (a[i.verdict] ?? 0) + 1; return a; }, {});

  return (
    <Shell active="rapports" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <div className="subtitle no-print" style={{ fontSize: 13 }}><Link href="/rapports">Rapports</Link> › Change Impact</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "6px 0" }}>
        <h1 style={{ margin: 0 }}>Change Impact · {accName}</h1>
        <div className="no-print" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>Fenêtre</span>
          {[7, 14].map((x) => <Link key={x} href={href({ w: x })} className={`pill ${x === w ? "ok" : ""}`}>{x} jours</Link>)}
          <PrintButton />
        </div>
      </div>
      <p className="subtitle" style={{ marginTop: 0 }}>Ce qui explique l&apos;écart avec le mois précédent, puis l&apos;effet mesuré de chaque modification : {w} jours avant comparés à {w} jours après.</p>
      {accounts.length > 1 && (
        <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {accounts.map((a) => <Link key={a.customerId} href={href({ account: a.customerId, v: null })} className={`pill ${a.customerId === account ? "ok" : ""}`}>{a.name}</Link>)}
        </div>
      )}

      {error || !d || !data ? <div className="card" style={{ borderColor: "var(--red)" }}>{error ?? "Aucune donnée."}</div> : (
        <>
          <h2 style={{ fontSize: 18, margin: "18px 0 8px" }}>Pourquoi les chiffres ont bougé</h2>
          <p className="subtitle" style={{ marginTop: 0, fontSize: 13 }}>Du {frDate(d.curRange.since)} au {frDate(d.curRange.until)}, comparé au {frDate(d.prevRange.since)} → {frDate(d.prevRange.until)}.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            <div className="card">
              <div className="subtitle" style={{ margin: 0, fontSize: 12 }}>DÉPENSE</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{eur(d.cur.cost)} <span style={{ fontSize: 14, fontWeight: 500 }}>({signed(dCost, eur)}, {pct(d.cur.cost, d.prev.cost)})</span></div>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
                <li><strong>{signed(d.costVolume, eur)}</strong> viennent du nombre de clics ({d.prev.clicks} → {d.cur.clicks})</li>
                <li><strong>{signed(d.costPrice, eur)}</strong> viennent du coût par clic ({eur2(cpc(d.prev))} → {eur2(cpc(d.cur))})</li>
              </ul>
            </div>
            <div className="card">
              <div className="subtitle" style={{ margin: 0, fontSize: 12 }}>CONVERSIONS</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{n1(d.cur.conv)} <span style={{ fontSize: 14, fontWeight: 500 }}>({signed(dConv, n1)}, {pct(d.cur.conv, d.prev.conv)})</span></div>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
                <li><strong>{signed(d.convVolume, n1)}</strong> viennent du nombre de clics</li>
                <li><strong>{signed(d.convRate, n1)}</strong> viennent du taux de conversion ({n1(cvr(d.prev))} % → {n1(cvr(d.cur))} %)</li>
              </ul>
              {d.cur.conv + d.prev.conv < 10 && <p className="subtitle" style={{ margin: "8px 0 0", fontSize: 12 }}>Moins de 10 conversions au total : l&apos;écart peut venir du hasard.</p>}
            </div>
          </div>

          {d.campaigns.length > 0 && (
            <div className="card" style={{ marginTop: 12, padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ textAlign: "left" }}>
                  {["Campagne", "Dépense", "Écart", "Conv.", "Écart", "CPA"].map((h, i) => <th key={i} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontWeight: 600, textAlign: i ? "right" : "left" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {d.campaigns.map((c) => (
                    <tr key={c.name}>
                      <td style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)" }}>{c.name}</td>
                      <td style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>{eur(c.cur.cost)}</td>
                      <td style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>{signed(c.dCost, eur)}</td>
                      <td style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>{n1(c.cur.conv)}</td>
                      <td style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", textAlign: "right", color: c.dConv > 0 ? "var(--green)" : c.dConv < 0 ? "var(--red)" : undefined }}>{signed(c.dConv, n1)}</td>
                      <td style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>{c.cur.conv ? eur(c.cur.cost / c.cur.conv) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 style={{ fontSize: 18, margin: "26px 0 8px" }}>Effet de chaque modification</h2>
          <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <Link href={href({ v: null })} className={`pill ${!sp.v ? "ok" : ""}`}>Toutes {data.impacts.length}</Link>
            {(Object.keys(VERDICT) as Verdict[]).filter((v) => counts[v]).map((v) => (
              <Link key={v} href={href({ v })} className={`pill ${sp.v === v ? "ok" : ""}`}>{VERDICT[v].label} {counts[v]}</Link>
            ))}
          </div>
          {impacts.length === 0 ? <div className="card"><p className="subtitle" style={{ margin: 0 }}>Aucune modification sur les 30 derniers jours.</p></div> : (
            <div style={{ display: "grid", gap: 10 }}>
              {impacts.map((i, k) => (
                <div key={k} className="card" style={{ borderLeft: `3px solid ${VERDICT[i.verdict].color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <strong>{frDate(i.date)} · {i.campaign || "Compte entier"}</strong>
                    <span className="pill" style={{ color: VERDICT[i.verdict].color, borderColor: VERDICT[i.verdict].color }}>{VERDICT[i.verdict].label}</span>
                  </div>
                  <ul style={{ margin: "8px 0", paddingLeft: 18, fontSize: 14 }}>
                    {i.items.map((l, j) => (
                      <li key={j}><span className="subtitle" style={{ fontSize: 12 }}>{CHANGE_KINDS[l.kind] ?? l.kind}</span> {l.text}{l.detail.length ? ` : ${l.detail.slice(0, 4).join(", ")}${l.detail.length > 4 ? ` (+${l.detail.length - 4})` : ""}` : ""}</li>
                    ))}
                  </ul>
                  <div className="subtitle" style={{ margin: 0, fontSize: 13 }}>{i.note}</div>
                </div>
              ))}
            </div>
          )}
          <p className="subtitle" style={{ fontSize: 11, marginTop: 12 }}>
            Méthode : moyenne par jour sur {w} jours avant la modification et jusqu&apos;à {w} jours après (le jour même est exclu), sur la campagne concernée.
            Plusieurs modifications proches se mélangent, la saisonnalité aussi : c&apos;est une indication, pas une preuve.
            {data.clampedSince > d.curRange.since ? ` Journal lu à partir du ${frDate(data.clampedSince)}.` : ""}
          </p>
        </>
      )}
    </Shell>
  );
}
