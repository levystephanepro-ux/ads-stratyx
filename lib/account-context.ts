// Contexte du compte (« Enrichir l'agent ») : texte libre par compte Google Ads.
import { getSetting } from "@/lib/agent/store";

export const contextKey = (customerId?: string | null) => `account_context:${customerId || "defaut"}`;

export async function getAccountContext(customerId?: string | null, workspaceId?: string | null): Promise<string> {
  try {
    return (await getSetting(contextKey(customerId), workspaceId)) ?? "";
  } catch {
    return "";
  }
}
