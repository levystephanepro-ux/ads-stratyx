// Clients : une fiche par client, questionnaire de découverte, accès à tous les outils.
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { listClients } from "@/lib/clients/store";
import { createClientAction } from "./actions";

export const dynamic = "force-dynamic";

const input = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%" } as const;
const STATUS_LABEL = { a_envoyer: "Questionnaire à envoyer", envoye: "Envoyé, en attente", rempli: "Questionnaire rempli" } as const;

export default async function ClientsPage() {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  let clients: Awaited<ReturnType<typeof listClients>> = [];
  let dbError: string | null = null;
  try { clients = await listClients(); } catch (e) { dbError = e instanceof Error ? e.message : String(e); }
  const { accounts } = await getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true });
  const nameOf = (id: string | null) => accounts.find((a) => a.customerId === id)?.name ?? id ?? "Aucun compte lié";

  return (
    <Shell active="clients" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <h1 style={{ margin: "0 0 6px" }}>Clients</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>Une fiche par client : questionnaire de découverte, puis audit, persona, structure de campagne, rapports et alertes au même endroit.</p>
      {dbError && <div className="card" style={{ borderColor: "var(--red)", margin: "12px 0" }}>Base non prête : lance la migration 0021_clients.sql dans Supabase. ({dbError})</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 320px) minmax(0, 1fr)", gap: 16, marginTop: 16, alignItems: "start" }} className="copilote-layout">
        <form action={createClientAction} className="card" style={{ display: "grid", gap: 10 }}>
          <div className="subtitle" style={{ margin: 0, fontSize: 12, textTransform: "uppercase" }}>Nouveau client</div>
          <input name="name" placeholder="Nom du client ou de l'entreprise" required style={input} />
          <select name="customer_id" style={input} defaultValue="">
            <option value="">Compte Google Ads : pas encore</option>
            {accounts.map((a) => <option key={a.customerId} value={a.customerId}>{a.name}</option>)}
          </select>
          <button type="submit">Créer la fiche</button>
        </form>

        <div style={{ display: "grid", gap: 10 }}>
          {clients.length === 0 && !dbError && <div className="card subtitle">Aucun client pour l'instant.</div>}
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", color: "inherit", flexWrap: "wrap" }}>
              <span><strong>{c.name}</strong><br /><span className="subtitle" style={{ margin: 0, fontSize: 12 }}>{nameOf(c.customer_id)}</span></span>
              <span className="pill">{STATUS_LABEL[c.status]}</span>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}
