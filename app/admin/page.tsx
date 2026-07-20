// Page Admin — réservée à l'owner. Vue d'ensemble des clients : plan, statut,
// consommation IA, comptes Google Ads reliés, avec actions en un clic.
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import AdminManager from "@/components/AdminManager";
import { getDashboardContext } from "@/lib/workspace";
import { listClients } from "@/lib/admin";
import { getAccountsInfo } from "@/lib/google-ads/default-account";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const ctx = await getDashboardContext();
  if (!ctx.authed || !ctx.isOwner) redirect("/dashboard");

  const [{ rows, summary }, { accounts }] = await Promise.all([
    listClients(),
    getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true }),
  ]);

  return (
    <Shell active="admin" token={ctx.mcpToken} showAdmin trialDaysLeft={ctx.trialDaysLeft}>
      <h1 className="page-title">🛠️ Admin</h1>
      <p className="page-lede">
        Tes clients, leurs plans et leur consommation. Relie les comptes Google
        Ads et active les abonnements en un clic — plus besoin de SQL.
      </p>
      <AdminManager rows={rows} summary={summary} mccAccounts={accounts} />
    </Shell>
  );
}
