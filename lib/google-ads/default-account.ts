import { adsConfig, isLive, hasEnvAccount } from "./config";
import { listManagedAccounts } from "./client";
import { getSetting } from "@/lib/agent/store";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AccountInfo {
  customerId: string;
  name: string;
}

/** Portée d'affichage : owner (tout le MCC) ou client (comptes de SON espace). */
export interface AccountScope {
  workspaceId: string | null;
  isOwner: boolean;
}

/** Comptes reliés à un workspace (table google_ads_connections). */
export async function listWorkspaceAccounts(
  workspaceId: string,
): Promise<AccountInfo[]> {
  try {
    const { data } = await createAdminClient()
      .from("google_ads_connections")
      .select("customer_id, descriptive_name")
      .eq("workspace_id", workspaceId);
    return (data ?? []).map((c) => ({
      customerId: c.customer_id,
      name: c.descriptive_name ?? c.customer_id,
    }));
  } catch {
    return [];
  }
}

/** Compte par défaut du scope : réglage workspace, puis global (owner), puis env. */
async function resolveDefaultId(scope?: AccountScope): Promise<string | null> {
  if (scope?.workspaceId) {
    const ws = await getSetting("default_customer_id", scope.workspaceId);
    if (ws) return ws;
    if (!scope.isOwner) return null; // client sans défaut choisi : rien
  }
  return (await getSetting("default_customer_id")) || adsConfig.customerId || null;
}

/** Renvoie le compte par défaut (ID + nom lisible) ou null. */
export async function getDefaultAccountInfo(
  scope?: AccountScope,
): Promise<AccountInfo | null> {
  if (scope && !scope.isOwner) {
    if (!scope.workspaceId) return null;
    const customerId = await resolveDefaultId(scope);
    if (!customerId) return null;
    const accounts = await listWorkspaceAccounts(scope.workspaceId);
    const match = accounts.find((a) => a.customerId === customerId);
    return { customerId, name: match?.name ?? customerId };
  }

  if (!isLive() || !hasEnvAccount()) return null;
  const customerId = await resolveDefaultId(scope);
  if (!customerId) return null;
  try {
    const accounts = await listManagedAccounts(adsConfig.refreshToken);
    const match = accounts.find((a) => a.customerId === customerId);
    return { customerId, name: match?.name ?? customerId };
  } catch {
    return { customerId, name: customerId };
  }
}

/** Renvoie les comptes visibles dans le scope + l'ID du compte actif. */
export async function getAccountsInfo(scope?: AccountScope): Promise<{
  accounts: AccountInfo[];
  defaultCustomerId: string | null;
}> {
  if (scope && !scope.isOwner) {
    if (!scope.workspaceId) return { accounts: [], defaultCustomerId: null };
    const accounts = await listWorkspaceAccounts(scope.workspaceId);
    const defaultCustomerId =
      (await resolveDefaultId(scope)) ??
      (accounts.length === 1 ? accounts[0].customerId : null);
    return { accounts, defaultCustomerId };
  }

  if (!isLive() || !hasEnvAccount()) {
    return { accounts: [], defaultCustomerId: null };
  }
  const defaultCustomerId = await resolveDefaultId(scope);
  try {
    const list = await listManagedAccounts(adsConfig.refreshToken);
    return {
      accounts: list.map((a) => ({ customerId: a.customerId, name: a.name })),
      defaultCustomerId,
    };
  } catch {
    return { accounts: [], defaultCustomerId };
  }
}
