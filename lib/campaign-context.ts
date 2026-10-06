// Contexte campagne injecté dans le system prompt du copilote et des agents.
export interface CampaignFilter {
  mode: "all" | "selected";
  campaigns?: { id: string; name: string }[];
}

export function parseCampaignFilter(raw: string | null): CampaignFilter | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CampaignFilter;
  } catch {
    return null;
  }
}

export function buildCampaignContext(
  accountName: string | null,
  customerId: string | null | undefined,
  filter: CampaignFilter | null,
): string {
  const accountStr = accountName
    ? `${accountName}${customerId ? ` (ID: ${customerId})` : ""}`
    : customerId ?? "le compte Google Ads";

  if (!filter || filter.mode === "all" || !filter.campaigns?.length) {
    return `Compte Google Ads actif : ${accountStr}. Tu analyses toutes les campagnes du compte.`;
  }

  const names = filter.campaigns.map((c) => `"${c.name}"`).join(", ");
  return `Compte Google Ads actif : ${accountStr}. L'utilisateur travaille UNIQUEMENT sur ces campagnes : ${names}. Concentre ton analyse sur ces campagnes sauf instruction contraire explicite.`;
}
