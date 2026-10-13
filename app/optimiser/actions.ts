"use server";
// Actions des pages Optimiser : ajout de négatifs depuis les termes de recherche.
// Chaque ajout passe par le journal des corrections (annulable 30 jours).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/workspace";
import { applyFix, describeFix } from "@/lib/fixes/apply";
import { logAction } from "@/lib/fixes/store";
import type { Fix, MatchType } from "@/lib/audit/types";

/** Coche des recherches → négatifs exacts (ou expression) dans leur campagne. */
export async function addNegativesAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const customerId = String(form.get("customer_id") ?? "");
  const back = String(form.get("back") ?? "/optimiser/termes");
  const match = (String(form.get("match") ?? "EXACT") === "PHRASE" ? "PHRASE" : "EXACT") as MatchType;
  const picked = form.getAll("t").map(String).filter(Boolean);
  let msg: string;
  try {
    if (!/^\d+$/.test(customerId)) throw new Error("Compte manquant.");
    if (!picked.length) throw new Error("Coche au moins une recherche.");
    // valeur : campaignId|nom de campagne|recherche
    const byCamp = new Map<string, { name: string; terms: Set<string> }>();
    for (const v of picked.slice(0, 300)) {
      const [id, name, ...rest] = v.split("|");
      const term = rest.join("|").trim().toLowerCase();
      if (!/^\d+$/.test(id) || !term) continue;
      const e = byCamp.get(id) ?? { name, terms: new Set<string>() };
      e.terms.add(term);
      byCamp.set(id, e);
    }
    const done: string[] = [];
    for (const [id, { name, terms }] of byCamp) {
      const fix: Fix = { type: "add_negatives", campaigns: [{ id, name }], negatives: [...terms].map((text) => ({ text, matchType: match })) };
      const summary = describeFix(fix);
      try {
        const undo = await applyFix(customerId, fix);
        await logAction({
          workspace_id: ctx.workspaceId, customer_id: customerId, account_name: null,
          constat_id: `termes:${id}:${new Date().toISOString().slice(0, 10)}`,
          title: `${terms.size} recherche${terms.size > 1 ? "s" : ""} exclue${terms.size > 1 ? "s" : ""} dans « ${name} »`,
          summary, fix, undo, status: "done", error: null, author: ctx.email,
        }).catch(() => undefined);
        done.push(`${terms.size} dans « ${name} »`);
      } catch (e) {
        throw new Error(`Google Ads a refusé (${name}) : ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    msg = `ok:Négatifs ajoutés : ${done.join(", ")}. Annulable 30 jours depuis le journal.`;
  } catch (e) {
    msg = `err:${e instanceof Error ? e.message : String(e)}`;
  }
  revalidatePath("/optimiser/termes");
  const sep = back.includes("?") ? "&" : "?";
  redirect(`${back.startsWith("/") ? back : "/optimiser/termes"}${sep}msg=${encodeURIComponent(msg.slice(0, 400))}`);
}
