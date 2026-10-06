// Exécution d'un script sur le compte choisi, à la période choisie.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { isLive } from "@/lib/google-ads/config";
import { getScript } from "@/lib/scripts/registry";
import { makeRange } from "@/lib/scripts/helpers";
import { formatCell, toCsv } from "@/lib/scripts/format";
import { SCRIPT_CATEGORIES, type ScriptOutput } from "@/lib/scripts/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type P = Promise<{ id: string }>;
type SP = Promise<{ account?: string; days?: string; run?: string }>;

export default async function ScriptRunPage({ params, searchParams }: { params: P; searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const { id } = await params;
  const sp = await searchParams;
  const script = getScript(id);
  if (!script) notFound();

  const { accounts, defaultCustomerId } = await getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true });
  const account = sp.account ?? defaultCustomerId ?? accounts[0]?.customerId ?? null;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const range = makeRange(days);

  let out: ScriptOutput | null = null;
  let error: string | null = null;
  if (!isLive()) error = "Mode démo : les scripts lisent un vrai compte Google Ads (ADS_DATA_MODE=live).";
  else if (!account) error = "Aucun compte Google Ads disponible.";
  else if (script.confirm && sp.run !== "1") {
    // exécution sur clic seulement (lent ou payant)
  } else {
    try {
      out = await script.run({ customerId: account }, range);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  const href = (a: string | null, d: number) => `/scripts/${id}?${a ? `account=${a}&` : ""}days=${d}`;
  const csv = out ? `data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(script.columns, out.rows))}` : null;
  const accName = accounts.find((a) => a.customerId === account)?.name ?? account;

  return (
    <Shell active="scripts" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <Link href={`/scripts?cat=${script.category}`} className="subtitle" style={{ fontSize: 13 }}>← {SCRIPT_CATEGORIES[script.category]}</Link>
      <h1 style={{ margin: "6px 0" }}>{script.title}</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>{script.description}</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
        {accounts.length > 1 && accounts.map((a) => (
          <Link key={a.customerId} href={href(a.customerId, days)} className={`pill ${a.customerId === account ? "ok" : ""}`}>{a.name}</Link>
        ))}
        <span style={{ flex: 1 }} />
        {[7, 30, 90].map((d) => (
          <Link key={d} href={href(account, d)} className={`pill ${d === days ? "ok" : ""}`}>{d} j</Link>
        ))}
        {csv && out && out.rows.length > 0 && (
          <a className="btn-ghost" href={csv} download={`${script.id}-${range.until}.csv`} style={{ padding: "6px 12px", borderRadius: 8 }}>Exporter CSV</a>
        )}
      </div>

      {script.confirm && sp.run !== "1" && !error && (
        <div className="card">
          <Link className="btn" href={`${href(account, days)}&run=1`}>{script.confirm}</Link>
        </div>
      )}

      {error ? (
        <div className="card" style={{ borderColor: "var(--red)" }}>{error}</div>
      ) : out && (
        <>
          <p className="subtitle" style={{ fontSize: 13 }}>
            {accName} · du {range.since} au {range.until} · {out.rows.length} ligne(s){out.summary ? ` · ${out.summary}` : ""}
          </p>
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            {out.rows.length === 0 ? (
              <p className="subtitle" style={{ margin: 0, padding: 16 }}>Rien à signaler sur cette période.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {script.columns.map((c) => (
                      <th key={c.key} style={{ textAlign: c.type === "text" ? "left" : "right", padding: "10px 12px", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap" }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {out.rows.slice(0, 500).map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      {script.columns.map((c) => (
                        <td key={c.key} style={{ textAlign: c.type === "text" ? "left" : "right", padding: "8px 12px", whiteSpace: c.type === "text" ? "normal" : "nowrap" }}>
                          {formatCell(r[c.key], c.type)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {out.rows.length > 500 && <p className="subtitle" style={{ fontSize: 12 }}>500 premières lignes affichées ; l&apos;export CSV contient tout.</p>}
        </>
      )}
    </Shell>
  );
}
