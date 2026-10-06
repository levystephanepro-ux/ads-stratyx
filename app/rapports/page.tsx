// Rapports : dossiers par client, rapports enregistrés, compte rendu mensuel.
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { listFolders, listReports } from "@/lib/reports/store";
import { periodLabel } from "@/lib/reports/periods";
import { createFolderAction } from "./actions";

export const dynamic = "force-dynamic";

const input = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%" } as const;

export default async function RapportsPage() {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  let folders: Awaited<ReturnType<typeof listFolders>> = [];
  let reports: Awaited<ReturnType<typeof listReports>> = [];
  let dbError: string | null = null;
  try { [folders, reports] = await Promise.all([listFolders(), listReports()]); }
  catch (e) { dbError = e instanceof Error ? e.message : String(e); }
  const { accounts } = await getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true });
  const groups = [...folders.map((f) => ({ id: f.id, name: f.name })), { id: "", name: "Sans dossier" }];

  return (
    <Shell active="rapports" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}
      headerRight={<Link className="btn-ghost" href="/rapports/compte-rendu">Compte rendu du mois</Link>}>
      <h1 style={{ margin: "0 0 6px" }}>Rapports</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>Un dossier par client. Chaque rapport se partage par lien (toujours à jour) ou en PDF.</p>
      {dbError && <div className="card" style={{ borderColor: "var(--red)", margin: "12px 0" }}>Base non prête : lance la migration 0019_client_reports.sql dans Supabase. ({dbError})</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 320px) minmax(0, 1fr)", gap: 16, marginTop: 16, alignItems: "start" }} className="copilote-layout">
        <form action={createFolderAction} className="card" style={{ display: "grid", gap: 10 }}>
          <div className="subtitle" style={{ margin: 0, fontSize: 12, textTransform: "uppercase" }}>Nouveau dossier</div>
          <input name="name" placeholder="Nom du client" required style={input} />
          <select name="customer_id" style={input} defaultValue="">
            <option value="">Compte : à choisir à chaque rapport</option>
            {accounts.map((a) => <option key={a.customerId} value={a.customerId}>{a.name}</option>)}
          </select>
          <button type="submit">Créer le dossier</button>
        </form>

        <div style={{ display: "grid", gap: 14 }}>
          {groups.map((g) => {
            const list = reports.filter((r) => (r.folder_id ?? "") === g.id);
            if (!g.id && list.length === 0) return null;
            return (
              <div key={g.id || "none"} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong>{g.name}</strong>
                  <Link className="btn" href={`/rapports/nouveau${g.id ? `?folder=${g.id}` : ""}`}>Nouveau rapport</Link>
                </div>
                {list.length === 0 ? <p className="subtitle" style={{ margin: "8px 0 0" }}>Aucun rapport.</p> : (
                  <div style={{ display: "grid", gap: 4, marginTop: 10 }}>
                    {list.map((r) => (
                      <Link key={r.id} href={`/rapports/${r.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 8, background: "var(--surface-2)", color: "inherit" }}>
                        <span>{r.title || r.account_name}</span>
                        <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>{r.template} · {periodLabel(r.period)} · modifié le {new Date(r.updated_at).toLocaleDateString("fr-FR")}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {folders.length === 0 && reports.length === 0 && !dbError && (
            <div className="card"><p className="subtitle" style={{ margin: 0 }}>Crée un premier dossier (un par client), puis un rapport.</p>
              <Link className="btn" href="/rapports/nouveau" style={{ marginTop: 10, display: "inline-block" }}>Créer un rapport sans dossier</Link></div>
          )}
        </div>
      </div>
    </Shell>
  );
}
