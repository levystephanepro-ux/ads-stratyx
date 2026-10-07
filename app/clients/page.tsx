// Clients : pipeline commercial, une fiche par client, client actif.
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import SubmitButton from "@/components/SubmitButton";
import { getDashboardContext } from "@/lib/workspace";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { listClients } from "@/lib/clients/store";
import { getActiveClient } from "@/lib/clients/active";
import { getProposal } from "@/lib/clients/proposal";
import { STAGES, stageOf, nextAction } from "@/lib/clients/stages";
import { createClientAction, deleteClientAction, setActiveClientAction } from "./actions";

export const dynamic = "force-dynamic";

const input = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%" } as const;
type SP = Promise<{ saved?: string; name?: string; voir?: string }>;

export default async function ClientsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  let clients: Awaited<ReturnType<typeof listClients>> = [];
  let dbError: string | null = null;
  try { clients = await listClients(); } catch (e) { dbError = e instanceof Error ? e.message : String(e); }
  const [{ accounts }, active, proposals] = await Promise.all([
    getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true }),
    getActiveClient(),
    Promise.all(clients.map((c) => getProposal(c.id).then((p) => !!p).catch(() => false))),
  ]);
  const hasProp = new Map(clients.map((c, i) => [c.id, proposals[i]]));
  const nameOf = (id: string | null) => accounts.find((a) => a.customerId === id)?.name ?? id ?? "Aucun compte lié";
  const showClosed = sp.voir === "tout";
  const columns = STAGES.filter((s) => showClosed || (s.key !== "perdu" && s.key !== "pause"));
  const closedCount = clients.filter((c) => ["perdu", "pause"].includes(stageOf(c))).length;

  return (
    <Shell active="clients" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}
      headerRight={<Link className="btn-ghost" href="/audit/prospect">Audit prospect</Link>}>
      <h1 style={{ margin: "0 0 6px" }}>Clients</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Ton pipeline, du prospect aux campagnes actives. « Activer » fait suivre ce client à toutes les pages (diagnostic, prévisions, copilote, persona).
      </p>
      {sp.saved === "draft" && <div className="card" style={{ borderColor: "var(--green)", margin: "12px 0" }}>Brouillon enregistré{sp.name ? ` pour ${sp.name}` : ""}. Tu peux le reprendre à tout moment.</div>}
      {dbError && <div className="card" style={{ borderColor: "var(--red)", margin: "12px 0" }}>Base non prête : lance la migration 0021_clients.sql dans Supabase. ({dbError})</div>}
      {active && <div className="card" style={{ margin: "12px 0", borderColor: "var(--accent)" }}>Client actif : <strong>{active.name}</strong>{active.customer_id ? "" : " (aucun compte Google Ads lié : les pages restent sur le compte par défaut)"}</div>}

      <form action={createClientAction} className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0 16px" }}>
        <input name="name" placeholder="Nouveau client ou prospect" required style={{ ...input, flex: "2 1 220px", width: "auto" }} />
        <select name="customer_id" style={{ ...input, flex: "1 1 200px", width: "auto" }} defaultValue="">
          <option value="">Compte Google Ads : pas encore</option>
          {accounts.map((a) => <option key={a.customerId} value={a.customerId}>{a.name}</option>)}
        </select>
        <SubmitButton pending="Création...">Créer la fiche</SubmitButton>
      </form>

      <div style={{ display: "grid", gap: 16 }}>
        {columns.map((col) => {
          const list = clients.filter((c) => stageOf(c) === col.key);
          if (list.length === 0) return null;
          return (
            <section key={col.key}>
              <div className="subtitle" style={{ margin: "0 0 6px", fontSize: 12, textTransform: "uppercase", fontWeight: 700 }}>{col.label} · {list.length}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {list.map((c) => {
                  const next = nextAction(c, hasProp.get(c.id) ?? false);
                  const isActive = active?.id === c.id;
                  return (
                    <div key={c.id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", ...(isActive ? { borderColor: "var(--accent)" } : {}) }}>
                      <Link href={`/clients/${c.id}`} style={{ color: "inherit", flex: "1 1 220px" }}>
                        <strong>{c.name}</strong>{isActive && <span className="pill" style={{ marginLeft: 8, fontSize: 11 }}>actif</span>}<br />
                        <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>{nameOf(c.customer_id)}</span>
                      </Link>
                      {next && <Link href={next.href} style={{ flex: "2 1 260px", fontSize: 13 }}>→ {next.text}</Link>}
                      <div style={{ display: "flex", gap: 6 }}>
                        {!isActive && (
                          <form action={setActiveClientAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="back" value="/clients" />
                            <button className="btn-ghost" type="submit" style={{ padding: "6px 10px", fontSize: 12 }}>Activer</button></form>
                        )}
                        <form action={deleteClientAction}><input type="hidden" name="id" value={c.id} />
                          <button className="btn-ghost" type="submit" style={{ color: "var(--red)", padding: "6px 10px", fontSize: 12 }}>Supprimer</button></form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {clients.length === 0 && !dbError && <div className="card subtitle">Aucun client pour l&apos;instant.</div>}
        {!showClosed && closedCount > 0 && <Link href="/clients?voir=tout" className="subtitle">Voir aussi les {closedCount} client(s) en pause ou perdus</Link>}
      </div>
    </Shell>
  );
}
