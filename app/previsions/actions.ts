"use server";
import { getDashboardContext } from "@/lib/workspace";
import { isLive } from "@/lib/google-ads/config";
import { createPausedSearchCampaign, validateSpec, type CampaignSpec } from "@/lib/planner/create";
import { logAction } from "@/lib/fixes/store";

export interface CreateState { ok: boolean | null; messages: string[]; values: Record<string, string>; created?: string }

const lines = (v: string) => v.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const num = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));

export async function createCampaignAction(_prev: CreateState, form: FormData): Promise<CreateState> {
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && k !== "g") values[k] = v;
  values.g = form.getAll("g").map(String).join(",");
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) return { ok: false, messages: ["Accès réservé."], values };
  if (!isLive()) return { ok: false, messages: ["Mode démo : la création passe par un vrai compte Google Ads."], values };

  const customerId = values.customer_id ?? "";
  if (!/^\d{6,12}$/.test(customerId)) return { ok: false, messages: ["Compte invalide."], values };
  const spec: CampaignSpec = {
    name: (values.name ?? "").trim(),
    dailyBudget: num(values.budget ?? ""),
    bidding: (["MAXIMIZE_CLICKS", "MAXIMIZE_CONVERSIONS", "MANUAL_CPC"].includes(values.bidding) ? values.bidding : "MAXIMIZE_CLICKS") as CampaignSpec["bidding"],
    maxCpc: values.maxcpc ? num(values.maxcpc) : null,
    geoIds: form.getAll("g").map(String).filter((g) => /^\d+$/.test(g)),
    keywords: [...new Set(lines(values.keywords ?? "").map((k) => k.replace(/^[\["]+|[\]"]+$/g, "").toLowerCase()))],
    matchType: (["PHRASE", "EXACT", "BROAD"].includes(values.match) ? values.match : "PHRASE") as CampaignSpec["matchType"],
    finalUrl: (values.url ?? "").trim(),
    headlines: lines(values.headlines ?? ""),
    descriptions: lines(values.descriptions ?? ""),
    path1: (values.path1 ?? "").trim() || undefined,
    path2: (values.path2 ?? "").trim() || undefined,
    languageId: values.lang || undefined,
  };
  const problems = validateSpec(spec);
  if (problems.length) return { ok: false, messages: problems, values };

  const check = values.mode === "check";
  try {
    const r = await createPausedSearchCampaign(customerId, spec, check);
    if (check) return { ok: true, messages: ["Google Ads a validé la campagne : rien n'a été créé. Clique sur « Créer en pause » pour la créer."], values };
    await logAction({
      workspace_id: ctx.workspaceId, customer_id: customerId, account_name: values.account_name || null, constat_id: null,
      title: "Nouvelle campagne (Prévisions)",
      summary: `Campagne Search « ${spec.name} » créée en pause (${spec.dailyBudget} €/jour, ${spec.keywords.length} mot(s)-clé(s)).`,
      fix: { type: "create_campaign", name: spec.name, dailyBudget: spec.dailyBudget, keywords: spec.keywords.length },
      undo: r.campaign ? { type: "remove_campaign", resourceName: r.campaign } : null,
      status: "done", error: null, author: ctx.email,
    }).catch(() => undefined);
    return { ok: true, created: r.campaign ?? undefined, messages: [`Campagne « ${spec.name} » créée EN PAUSE. Relis-la dans Google Ads (extensions, horaires, exclusions), puis active-la. Annulable depuis le Journal des corrections.`], values };
  } catch (e) {
    return { ok: false, messages: [e instanceof Error ? e.message : String(e)], values };
  }
}
