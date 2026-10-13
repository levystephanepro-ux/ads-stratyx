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

/** Budget Optimizer : cible du mois (compte) et budgets du mois par campagne. */
export async function saveBudgetTargetsAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const { setSetting } = await import("@/lib/agent/store");
  const { budgetKey } = await import("@/lib/optimize/budget");
  const customerId = String(form.get("customer_id") ?? "");
  const month = String(form.get("month") ?? "");
  const back = String(form.get("back") ?? "/optimiser/budget");
  const parse = (v: FormDataEntryValue | null) => {
    const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  };
  let msg: string;
  try {
    if (!/^\d+$/.test(customerId) || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Compte ou mois manquant.");
    const targets: Record<string, number> = {};
    const total = parse(form.get("total"));
    if (total !== null && String(form.get("total") ?? "").trim() !== "") targets.total = total;
    for (const [k, v] of form.entries()) {
      if (!k.startsWith("c_") || String(v).trim() === "") continue;
      const n = parse(v);
      if (n !== null && /^\d+$/.test(k.slice(2))) targets[k.slice(2)] = n;
    }
    await setSetting(budgetKey(customerId, month), JSON.stringify(targets));
    msg = "ok:Budgets du mois enregistrés : la prévision est recalculée.";
  } catch (e) {
    msg = `err:${e instanceof Error ? e.message : String(e)}`;
  }
  revalidatePath("/optimiser/budget");
  const sep = back.includes("?") ? "&" : "?";
  redirect(`${back.startsWith("/") ? back : "/optimiser/budget"}${sep}msg=${encodeURIComponent(msg)}`);
}

/** Audit noté sur 100 : lance le scan et l'enregistre dans l'historique. */
export async function scanAuditAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const { fetchScanData, evaluate, readOff, saveScan, MODELS } = await import("@/lib/audit/scan");
  const customerId = String(form.get("customer_id") ?? "");
  const model = String(form.get("modele") ?? "complet") as keyof typeof MODELS;
  const back = String(form.get("back") ?? "/analyser/audit");
  let to: string;
  try {
    if (!/^\d+$/.test(customerId)) throw new Error("Compte manquant.");
    const { data, skipped } = await fetchScanData({ customerId });
    const r = evaluate(data, model in MODELS ? model : "complet", await readOff(), skipped);
    await saveScan(customerId, r);
    to = `/analyser/audit?account=${customerId}&scan=0`;
  } catch (e) {
    to = `${back}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent(`err:${e instanceof Error ? e.message : String(e)}`.slice(0, 300))}`;
  }
  revalidatePath("/analyser/audit");
  redirect(to);
}

/** Mes critères : coche / décoche les critères de l'audit. */
export async function saveCriteriaAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const { saveOff } = await import("@/lib/audit/scan");
  const { AUDIT_GRID } = await import("@/lib/audit/criteria");
  const on = new Set(form.getAll("on").map(String));
  const all = AUDIT_GRID.flatMap((c) => c.items.map((_, i) => `${c.key}.${i}`));
  const back = String(form.get("back") ?? "/analyser/audit?onglet=criteres");
  let msg: string;
  try {
    await saveOff(all.filter((id) => !on.has(id)));
    msg = `ok:${on.size} critères actifs enregistrés.`;
  } catch (e) {
    msg = `err:${e instanceof Error ? e.message : String(e)}`;
  }
  revalidatePath("/analyser/audit");
  redirect(`${back}${back.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg)}`);
}
