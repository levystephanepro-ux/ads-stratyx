// Journal des corrections en un clic : tout ce que Stratyx a modifié dans
// Google Ads, par qui, quand, avec annulation possible pendant 30 jours.
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { listActions, canUndo, UNDO_DAYS, type ActionLog } from "@/lib/fixes/store";
import { undoFixAction } from "../actions";

export const dynamic = "force-dynamic";

type SP = Promise<{ msg?: string }>;
const STATUS: Record<ActionLog["status"], { label: string; color: string }> = {
  done: { label: "Appliqué", color: "var(--green)" },
  undone: { label: "Annulé", color: "var(--muted)" },
  failed: { label: "Refusé par Google", color: "var(--red)" },
};

export default async function JournalPage({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;
  let rows: ActionLog[] = []; let error: string | null = null;
  try { rows = await listActions(undefined, 300); } catch (e) { error = e instanceof Error ? e.message : String(e); }
  const msg = sp.msg ? { ok: sp.msg.startsWith("ok:"), text: sp.msg.replace(/^(ok|err):/, "") } : null;
  const dt = (s: string) => new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

  return (
    <Shell active="waste" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <div className="subtitle" style={{ fontSize: 13 }}><Link href="/waste">Diagnostic</Link> › Journal des corrections</div>
      <h1 style={{ margin: "6px 0" }}>Journal des corrections</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>Chaque modification faite en un clic depuis le Diagnostic. Annulation possible pendant {UNDO_DAYS} jours.</p>
      {msg && <div className="card" style={{ borderColor: msg.ok ? "var(--green)" : "var(--red)", margin: "10px 0" }}>{msg.ok ? "✓ " : ""}{msg.text}</div>}
      {error ? (
        <div className="card" style={{ borderColor: "var(--red)" }}>Journal indisponible : lance la migration 0020_action_log.sql dans Supabase. ({error.slice(0, 140)})</div>
      ) : rows.length === 0 ? (
        <div className="card"><p className="subtitle" style={{ margin: 0 }}>Aucune correction pour l&apos;instant.</p></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {rows.map((a, i) => (
            <div key={a.id} style={{ display: "flex", gap: 14, padding: "12px 16px", borderTop: i ? "1px solid var(--border)" : "none", alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ width: 110, flexShrink: 0 }}>
                <div style={{ fontSize: 13 }}>{dt(a.created_at)}</div>
                <div style={{ fontSize: 12, color: STATUS[a.status].color, fontWeight: 600 }}>{STATUS[a.status].label}</div>
              </div>
              <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{a.summary}</div>
                <div className="subtitle" style={{ margin: "2px 0 0", fontSize: 12 }}>
                  {a.account_name ?? a.customer_id} · constat : {a.title}{a.author ? ` · par ${a.author}` : ""}
                  {a.undone_at ? ` · annulé le ${dt(a.undone_at)}` : ""}
                </div>
                {a.error && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>{a.error.slice(0, 300)}</div>}
              </div>
              {canUndo(a) && (
                <form action={undoFixAction}>
                  <input type="hidden" name="action_id" value={a.id} />
                  <input type="hidden" name="back" value="journal" />
                  <button type="submit" className="btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }}>Annuler</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
