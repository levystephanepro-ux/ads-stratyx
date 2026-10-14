// Contexte commun des pages Optimiser / Analyser : compte, campagne, période,
// comparaison. Lu depuis l'adresse (?account=&campagne=&periode=), avec repli sur
// le client actif puis le premier compte suivi.
import { redirect } from "next/navigation";
import { getDashboardContext, type DashboardContext } from "@/lib/workspace";
import { getActiveClient } from "@/lib/clients/active";
import { ownerAccounts, latestAuditReports } from "@/lib/audit/run";
import { getDefaultAccountInfo } from "@/lib/google-ads/default-account";
import type { AdsContext } from "@/lib/google-ads/client";
import { listCampaignsLite, period, PERIODS, type CampaignLite, type Days, type Period } from "./data";

export type ScopeParams = { account?: string; campagne?: string; periode?: string; cmp?: string; [k: string]: string | undefined };

export interface Scope {
  dash: DashboardContext;
  accounts: { customerId: string; name: string }[];
  account: { customerId: string; name: string } | null;
  ads: AdsContext | null;
  campaigns: CampaignLite[];
  campaignId: string | null;
  campaign: CampaignLite | null;
  p: Period;
  compare: boolean;
  error: string | null;
  /** Chemin de la page (ex. /optimiser/mots-cles). */
  path: string;
  /** Adresse de la page (ou d'une autre) avec des paramètres remplacés. */
  href: (patch?: Record<string, string | null | undefined>, path?: string) => string;
  params: ScopeParams;
}

export async function getScope(path: string, sp: ScopeParams): Promise<Scope> {
  const dash = await getDashboardContext();
  if (!dash.isOwner) redirect("/dashboard");
  let error: string | null = null;
  let accounts: { customerId: string; name: string }[] = [];
  try { accounts = await ownerAccounts(); } catch (e) { error = e instanceof Error ? e.message : String(e); }
  // Compte : adresse > client actif > compte par défaut (Comptes et réglages) > compte suivi qui dépense le plus.
  const clean = (v?: string | null) => v?.replace(/-/g, "") || undefined;
  let want = clean(sp.account);
  if (!want) want = clean((await getActiveClient())?.customer_id);
  if (!want) { try { want = clean((await getDefaultAccountInfo({ workspaceId: dash.workspaceId, isOwner: true }))?.customerId); } catch { /* réglage absent */ } }
  if (!want || !accounts.some((a) => a.customerId === want)) {
    try {
      const top = (await latestAuditReports()).sort((a, b) => Number(b.total_cost) - Number(a.total_cost))[0];
      if (top && accounts.some((a) => a.customerId === top.customer_id)) want = top.customer_id;
    } catch { /* pas de diagnostic */ }
  }
  const account = accounts.find((a) => a.customerId === want) ?? accounts[0] ?? null;
  const ads = account ? { customerId: account.customerId } : null;
  let campaigns: CampaignLite[] = [];
  if (ads) {
    try { campaigns = await listCampaignsLite(ads); } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }
  const campaign = campaigns.find((c) => c.id === sp.campagne) ?? null;
  const days = (PERIODS as readonly number[]).includes(Number(sp.periode)) ? (Number(sp.periode) as Days) : 7;
  const compare = sp.cmp !== "0";
  const params: ScopeParams = { ...sp };
  const href = (patch: Record<string, string | null | undefined> = {}, to: string = path) => {
    const q = new URLSearchParams();
    const all = { ...params, ...patch };
    for (const [k, v] of Object.entries(all)) if (v !== undefined && v !== null && v !== "" && k !== "msg") q.set(k, v);
    const s = q.toString();
    return s ? `${to}?${s}` : to;
  };
  return { dash, accounts, account, ads, campaigns, campaignId: campaign?.id ?? null, campaign, p: period(days), compare, error, path, href, params };
}
