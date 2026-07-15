import { adsConfig, isLive, hasEnvAccount } from "./config";
import { listManagedAccounts } from "./client";
import { getSetting } from "@/lib/agent/store";

export interface AccountInfo {
  customerId: string;
  name: string;
}

/** Renvoie le compte par défaut (ID + nom lisible) ou null en mode démo. */
export async function getDefaultAccountInfo(): Promise<AccountInfo | null> {
  if (!isLive() || !hasEnvAccount()) return null;
  const customerId =
    (await getSetting("default_customer_id")) || adsConfig.customerId;
  if (!customerId) return null;
  try {
    const accounts = await listManagedAccounts(adsConfig.refreshToken);
    const match = accounts.find((a) => a.customerId === customerId);
    return { customerId, name: match?.name ?? customerId };
  } catch {
    return { customerId, name: customerId };
  }
}

/** Renvoie tous les comptes disponibles + l'ID du compte actif. */
export async function getAccountsInfo(): Promise<{
  accounts: AccountInfo[];
  defaultCustomerId: string | null;
}> {
  if (!isLive() || !hasEnvAccount()) {
    return { accounts: [], defaultCustomerId: null };
  }
  const defaultCustomerId =
    (await getSetting("default_customer_id")) || adsConfig.customerId || null;
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
