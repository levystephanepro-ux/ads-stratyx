// Corrections en un clic : application dans Google Ads et annulation.
// En mode démo, rien n'est envoyé : l'action est simulée et journalisée.
import { isLive } from "@/lib/google-ads/config";
import { mutateRaw } from "@/lib/google-ads/client";
import type { Fix } from "@/lib/audit/types";

export type Undo =
  | { type: "remove_criteria"; resource: "campaignCriteria" | "adGroupCriteria"; resourceNames: string[] }
  | { type: "enable_keyword"; resourceName: string }
  | { type: "recreate_negative"; level: "campaign" | "ad_group"; parentId: string; text: string; matchType: string };

const fmt = (t: string, m: string) => (m === "EXACT" ? `[${t}]` : m === "PHRASE" ? `"${t}"` : t);

/** Phrase lisible de ce que fera (ou a fait) la correction. */
export function describeFix(fix: Fix): string {
  switch (fix.type) {
    case "add_negatives": {
      const negs = fix.negatives.map((n) => fmt(n.text, n.matchType)).join(", ");
      const where = fix.campaigns.map((c) => `« ${c.name} »`).join(", ");
      return `Ajouter ${fix.negatives.length > 1 ? "les négatifs" : "le négatif"} ${negs} dans ${fix.campaigns.length > 1 ? "les campagnes" : "la campagne"} ${where}.`;
    }
    case "pause_keyword":
      return `Mettre en pause le mot-clé ${fix.label} (« ${fix.campaign} » › « ${fix.adGroup} »).`;
    case "remove_negative":
      return `Retirer le négatif ${fmt(fix.text, fix.matchType)} ${fix.where}.`;
  }
}

const neg = (text: string, matchType: string) => ({ text, matchType });

export async function applyFix(customerId: string, fix: Fix): Promise<Undo> {
  const ctx = { customerId };
  const live = isLive();
  switch (fix.type) {
    case "add_negatives": {
      const ops = fix.campaigns.flatMap((c) =>
        fix.negatives.map((n) => ({
          create: { campaign: `customers/${customerId}/campaigns/${c.id}`, negative: true, keyword: neg(n.text, n.matchType) },
        })));
      const names = live ? await mutateRaw(ctx, "campaignCriteria", ops) : ops.map((_, i) => `demo/${i}`);
      return { type: "remove_criteria", resource: "campaignCriteria", resourceNames: names.filter(Boolean) };
    }
    case "pause_keyword": {
      const resourceName = `customers/${customerId}/adGroupCriteria/${fix.adGroupId}~${fix.criterionId}`;
      if (live) await mutateRaw(ctx, "adGroupCriteria", [{ update: { resourceName, status: "PAUSED" }, updateMask: "status" }]);
      return { type: "enable_keyword", resourceName };
    }
    case "remove_negative": {
      if (!fix.resourceName.startsWith(`customers/${customerId}/`) && live) throw new Error("Négatif d'un autre compte.");
      const resource = fix.level === "ad_group" ? "adGroupCriteria" : "campaignCriteria";
      if (live) await mutateRaw(ctx, resource, [{ remove: fix.resourceName }]);
      return { type: "recreate_negative", level: fix.level, parentId: fix.parentId, text: fix.text, matchType: fix.matchType };
    }
  }
}

export async function applyUndo(customerId: string, undo: Undo): Promise<void> {
  if (!isLive()) return;
  const ctx = { customerId };
  switch (undo.type) {
    case "remove_criteria":
      if (undo.resourceNames.length) await mutateRaw(ctx, undo.resource, undo.resourceNames.map((r) => ({ remove: r })));
      return;
    case "enable_keyword":
      await mutateRaw(ctx, "adGroupCriteria", [{ update: { resourceName: undo.resourceName, status: "ENABLED" }, updateMask: "status" }]);
      return;
    case "recreate_negative":
      if (undo.level === "ad_group") {
        await mutateRaw(ctx, "adGroupCriteria", [{ create: { adGroup: `customers/${customerId}/adGroups/${undo.parentId}`, negative: true, keyword: neg(undo.text, undo.matchType) } }]);
      } else {
        await mutateRaw(ctx, "campaignCriteria", [{ create: { campaign: `customers/${customerId}/campaigns/${undo.parentId}`, negative: true, keyword: neg(undo.text, undo.matchType) } }]);
      }
      return;
  }
}
