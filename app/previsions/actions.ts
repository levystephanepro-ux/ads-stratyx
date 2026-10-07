"use server";
import { getDashboardContext } from "@/lib/workspace";
import { isLive } from "@/lib/google-ads/config";
import { getGlobalBilling } from "@/lib/billing";
import { getAccountContext } from "@/lib/account-context";
import { createPausedSearchCampaign, validateSpec, type CampaignSpec } from "@/lib/planner/create";
import { proposeStructure, type BuilderTier, type Structure, type StructureInput } from "@/lib/planner/ai";
import { logAction } from "@/lib/fixes/store";

export interface ActionResult { ok: boolean; messages: string[]; created?: string }

/** Proposition de structure par l'IA (groupes, annonces, négatifs). */
export async function proposeStructureAction(input: Omit<StructureInput, "accountContext"> & { customerId: string; tier?: BuilderTier }):
  Promise<{ ok: boolean; message: string; structure?: Structure }> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) return { ok: false, message: "Accès réservé." };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, message: "ANTHROPIC_API_KEY manquante sur Vercel." };
  const billing = await getGlobalBilling();
  if (!billing.allowed) return { ok: false, message: billing.reason ?? "Plafond IA atteint." };
  try {
    const accountContext = await getAccountContext(input.customerId, null);
    const { customerId: _c, tier, ...rest } = input; void _c;
    const { structure, costUsd, model } = await proposeStructure({ ...rest, ideas: rest.ideas.slice(0, 120), accountContext }, tier === "opus" ? "opus" : "sonnet");
    const rate = Number((process.env.EUR_TO_USD ?? "1.15").replace(",", ".")) || 1.15;
    return { ok: true, structure, message: `${structure.groups.length} groupe(s) proposé(s) par ${model} · coût IA estimé ${(costUsd / rate).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} €. Relis tout avant de créer.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Vérifie (validateOnly) ou crée la campagne en pause. */
export async function createCampaignAction(customerId: string, accountName: string, spec: CampaignSpec, mode: "check" | "create"): Promise<ActionResult> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) return { ok: false, messages: ["Accès réservé."] };
  if (!isLive()) return { ok: false, messages: ["Mode démo : la création passe par un vrai compte Google Ads."] };
  if (!/^\d{6,12}$/.test(customerId)) return { ok: false, messages: ["Compte invalide."] };

  const clean: CampaignSpec = {
    ...spec,
    name: spec.name.trim(),
    geoIds: spec.geoIds.filter((g) => /^\d+$/.test(g)),
    finalUrl: spec.finalUrl.trim(),
    negatives: [...new Set(spec.negatives.map((n) => n.trim().toLowerCase()).filter(Boolean))],
    groups: spec.groups.map((g) => ({
      ...g,
      keywords: [...new Set(g.keywords.map((k) => k.trim().toLowerCase().replace(/^[\["]+|[\]"]+$/g, "")).filter(Boolean))],
      headlines: g.headlines.map((h) => h.trim()).filter(Boolean),
      descriptions: g.descriptions.map((d) => d.trim()).filter(Boolean),
      path1: g.path1?.trim() || undefined, path2: g.path2?.trim() || undefined,
    })),
  };
  const ex = spec.extensions;
  if (ex) {
    clean.extensions = {
      phone: ex.phone?.trim() || undefined,
      sitelinks: (ex.sitelinks ?? []).map((l) => ({ text: l.text.trim(), desc1: l.desc1.trim(), desc2: l.desc2.trim(), url: l.url.trim() })).filter((l) => l.text),
      callouts: [...new Set((ex.callouts ?? []).map((t) => t.trim()).filter(Boolean))],
      schedule: ex.schedule ?? null,
    };
  }
  const problems = validateSpec(clean);
  if (problems.length) return { ok: false, messages: problems };

  try {
    const r = await createPausedSearchCampaign(customerId, clean, mode === "check");
    if (mode === "check") return { ok: true, messages: ["Google Ads a validé la campagne : rien n'a été créé. Clique sur « Créer en pause » pour la créer."] };
    const nKw = clean.groups.reduce((n, g) => n + g.keywords.length, 0);
    await logAction({
      workspace_id: ctx.workspaceId, customer_id: customerId, account_name: accountName || null, constat_id: null,
      title: "Nouvelle campagne (Prévisions)",
      summary: `Campagne Search « ${clean.name} » créée en pause : ${clean.groups.length} groupe(s), ${nKw} mot(s)-clé(s), ${clean.negatives.length} négatif(s), ${clean.dailyBudget} €/jour.`,
      fix: { type: "create_campaign", name: clean.name, dailyBudget: clean.dailyBudget, keywords: nKw },
      undo: r.campaign ? { type: "remove_campaign", resourceName: r.campaign } : null,
      status: "done", error: null, author: ctx.email,
    }).catch(() => undefined);
    return { ok: true, created: r.campaign ?? "ok", messages: [`Campagne « ${clean.name} » créée EN PAUSE. Relis-la dans Google Ads (vérifie les extensions et horaires), puis active-la. Annulable depuis le Journal des corrections.`] };
  } catch (e) {
    return { ok: false, messages: [e instanceof Error ? e.message : String(e)] };
  }
}
