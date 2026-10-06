"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/workspace";
import { runAuditForOwner, latestAuditReports } from "@/lib/audit/run";
import { applyFix, applyUndo, describeFix } from "@/lib/fixes/apply";
import { listActions, logAction, getAction, markUndone, canUndo } from "@/lib/fixes/store";

/** Relance le diagnostic à la demande (owner uniquement, 0 crédit IA). */
export async function runAuditNow(): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) return;
  await runAuditForOwner();
  revalidatePath("/waste");
}

const back = (form: FormData, msg: string) => {
  const q = new URLSearchParams();
  const account = String(form.get("customer_id") ?? ""); if (account) q.set("account", account);
  const cat = String(form.get("cat") ?? ""); if (cat && cat !== "tout") q.set("cat", cat);
  q.set("msg", msg);
  const to = String(form.get("back") ?? "") === "journal" ? "/waste/journal" : "/waste";
  return `${to}?${q}`;
};

/**
 * Applique la correction d'un constat. La correction est relue dans le dernier
 * diagnostic enregistré (jamais prise telle quelle dans le formulaire).
 */
export async function applyFixAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const customerId = String(form.get("customer_id") ?? "");
  const constatId = String(form.get("constat_id") ?? "");
  let msg: string;
  try {
    const report = (await latestAuditReports()).find((r) => r.customer_id === customerId);
    const constat = report?.constats.find((c) => c.id === constatId);
    if (!report || !constat?.fix) throw new Error("Correction introuvable : relance le diagnostic.");
    const already = (await listActions(customerId, 300)).find((a) => a.constat_id === constatId && canUndo(a));
    if (already) throw new Error("Déjà corrigé (voir le journal).");
    const summary = describeFix(constat.fix);
    try {
      const undo = await applyFix(customerId, constat.fix);
      await logAction({
        workspace_id: ctx.workspaceId, customer_id: customerId, account_name: report.account_name, constat_id: constatId,
        title: constat.title, summary, fix: constat.fix, undo, status: "done", error: null, author: ctx.email,
      });
      msg = `ok:${summary}`;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await logAction({
        workspace_id: ctx.workspaceId, customer_id: customerId, account_name: report.account_name, constat_id: constatId,
        title: constat.title, summary, fix: constat.fix, undo: null, status: "failed", error: err, author: ctx.email,
      }).catch(() => undefined);
      throw new Error(`Google Ads a refusé : ${err}`);
    }
  } catch (e) {
    msg = `err:${e instanceof Error ? e.message : String(e)}`;
  }
  revalidatePath("/waste");
  redirect(back(form, msg.slice(0, 400)));
}

/** Annule une correction (30 jours max). */
export async function undoFixAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  let msg: string;
  try {
    const a = await getAction(String(form.get("action_id") ?? ""));
    if (!a) throw new Error("Action introuvable.");
    if (!canUndo(a) || !a.undo) throw new Error("Cette action ne peut plus être annulée.");
    await applyUndo(a.customer_id, a.undo);
    await markUndone(a.id);
    msg = `ok:Annulé : ${a.summary}`;
  } catch (e) {
    msg = `err:${e instanceof Error ? e.message : String(e)}`;
  }
  revalidatePath("/waste");
  revalidatePath("/waste/journal");
  redirect(back(form, msg.slice(0, 400)));
}
