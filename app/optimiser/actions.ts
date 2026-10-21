"use server";
// Actions des pages Optimiser : ajout de négatifs depuis les termes de recherche.
// Chaque ajout passe par le journal des corrections (annulable 30 jours).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/workspace";
import { applyFix, describeFix } from "@/lib/fixes/apply";
import { logAction } from "@/lib/fixes/store";
import type { Fix, MatchType } from "@/lib/audit/types";

/** Retour sur une page de l'app uniquement (jamais « //autre-site »), message ajouté. */
function backTo(raw: FormDataEntryValue | null, fallback: string, msg: string): string {
  const b = String(raw ?? "");
  const base = b.startsWith("/") && !b.startsWith("//") && !b.includes("\\") ? b : fallback;
  return `${base}${base.includes("?") ? "&" : "?"}msg=${encodeURIComponent(msg.slice(0, 400))}`;
}

/** Coche des recherches → négatifs exacts (ou expression) dans leur campagne. */
export async function addNegativesAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const customerId = String(form.get("customer_id") ?? "");
  const match = (String(form.get("match") ?? "EXACT") === "PHRASE" ? "PHRASE" : "EXACT") as MatchType;
  const picked = form.getAll("t").map(String).filter(Boolean);
  let msg: string;
  try {
    if (!/^\d+$/.test(customerId)) throw new Error("Compte manquant.");
    if (!picked.length) throw new Error("Coche au moins une recherche.");
    // valeur : campaignId|nom de campagne (encodé)|recherche (encodée)
    const byCamp = new Map<string, { name: string; terms: Set<string> }>();
    const skipped: string[] = [];
    for (const v of picked.slice(0, 300)) {
      const [id, n, t] = v.split("|");
      let name = "", term = "";
      try { name = decodeURIComponent(n ?? ""); term = decodeURIComponent(t ?? "").trim().toLowerCase().replace(/\s+/g, " "); } catch { continue; }
      if (!/^\d+$/.test(id) || !term) continue;
      // Limites Google Ads d'un mot-clé : 80 caractères, 10 mots.
      if (term.length > 80 || term.split(" ").length > 10) { skipped.push(term); continue; }
      const e = byCamp.get(id) ?? { name, terms: new Set<string>() };
      e.terms.add(term);
      byCamp.set(id, e);
    }
    const done: string[] = [];
    const failed: string[] = [];
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
        failed.push(`« ${name} » : ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (!done.length && !failed.length) throw new Error("Aucune recherche valide cochée.");
    const extra = skipped.length ? ` ${skipped.length} recherche(s) trop longue(s) ignorée(s).` : "";
    msg = failed.length
      ? `err:${done.length ? `Ajoutés : ${done.join(", ")}. ` : ""}Refusé par Google Ads : ${failed.join(" · ")}.${extra}`
      : `ok:Négatifs ajoutés : ${done.join(", ")}. Annulable 30 jours depuis le journal.${extra}`;
  } catch (e) {
    msg = `err:${e instanceof Error ? e.message : String(e)}`;
  }
  revalidatePath("/optimiser/termes");
  redirect(backTo(form.get("back"), "/optimiser/termes", msg));
}

/** Budget Optimizer : cible du mois (compte) et budgets du mois par campagne. */
export async function saveBudgetTargetsAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const { setSetting } = await import("@/lib/agent/store");
  const { budgetKey } = await import("@/lib/optimize/budget");
  const customerId = String(form.get("customer_id") ?? "");
  const month = String(form.get("month") ?? "");
  const part = String(form.get("part") ?? "");
  const parse = (v: FormDataEntryValue | null) => {
    const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  };
  let msg: string;
  try {
    if (!/^\d+$/.test(customerId) || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Compte ou mois manquant.");
    // On ne remplace que la partie envoyée (cible du compte OU budgets par campagne).
    const { readTargets } = await import("@/lib/optimize/budget");
    const targets: Record<string, number> = await readTargets(customerId, month);
    if (part === "total") {
      const raw = String(form.get("total") ?? "").trim();
      const total = parse(raw);
      if (raw === "") delete targets.total;
      else if (total === null) throw new Error("Cible illisible : tape un montant, par exemple 930.");
      else targets.total = total;
    } else {
      for (const [k, v] of form.entries()) {
        if (!k.startsWith("c_") || !/^\d+$/.test(k.slice(2))) continue;
        const raw = String(v).trim();
        if (raw === "") { delete targets[k.slice(2)]; continue; }
        const n = parse(raw);
        if (n !== null) targets[k.slice(2)] = n;
      }
    }
    await setSetting(budgetKey(customerId, month), JSON.stringify(targets));
    msg = "ok:Budgets du mois enregistrés : la prévision est recalculée.";
  } catch (e) {
    msg = `err:${e instanceof Error ? e.message : String(e)}`;
  }
  revalidatePath("/optimiser/budget");
  redirect(backTo(form.get("back"), "/optimiser/budget", msg));
}

/** Audit noté sur 100 : lance le scan et l'enregistre dans l'historique. */
export async function scanAuditAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const { fetchScanData, evaluate, readOff, saveScan, MODELS } = await import("@/lib/audit/scan");
  const customerId = String(form.get("customer_id") ?? "");
  const model = String(form.get("modele") ?? "complet") as keyof typeof MODELS;
  let to: string;
  try {
    if (!/^\d+$/.test(customerId)) throw new Error("Compte manquant.");
    const { data, skipped } = await fetchScanData({ customerId });
    const r = evaluate(data, model in MODELS ? model : "complet", await readOff(), skipped);
    const { readIa, } = await import("@/lib/audit/ia");
    const { patchScan } = await import("@/lib/audit/scan");
    const ia = await readIa(customerId);
    await saveScan(customerId, ia ? patchScan(r, ia, await readOff()) : r);
    to = `/analyser/audit?account=${customerId}&scan=0`;
  } catch (e) {
    to = backTo(form.get("back"), "/analyser/audit", `err:${e instanceof Error ? e.message : String(e)}`);
  }
  revalidatePath("/analyser/audit");
  redirect(to);
}

/** Relecture par l'IA des critères de jugement (titres, fautes, cohérence annonce et page), sur demande. */
export async function reviewAuditIaAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const customerId = String(form.get("customer_id") ?? "");
  const name = String(form.get("account_name") ?? "");
  let msg: string;
  try {
    if (!/^\d+$/.test(customerId)) throw new Error("Compte manquant.");
    const { runIaReview } = await import("@/lib/audit/ia");
    const { readScans, replaceLatestScan, patchScan, readOff } = await import("@/lib/audit/scan");
    const review = await runIaReview(customerId, name);
    const scans = await readScans(customerId);
    if (scans[0]) await replaceLatestScan(customerId, patchScan(scans[0], review, await readOff()));
    msg = "ok:Relecture faite : titres, fautes et cohérence annonce-page mis à jour (environ 1 crédit).";
  } catch (e) {
    msg = `err:${e instanceof Error ? e.message : String(e)}`;
  }
  revalidatePath("/analyser/audit");
  redirect(backTo(form.get("back"), "/analyser/audit", msg));
}

/** Mes critères : coche / décoche les critères de l'audit. */
export async function saveCriteriaAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const { saveOff } = await import("@/lib/audit/scan");
  const { AUDIT_GRID } = await import("@/lib/audit/criteria");
  const on = new Set(form.getAll("on").map(String));
  const all = AUDIT_GRID.flatMap((c) => c.items.map((_, i) => `${c.key}.${i}`));
  let msg: string;
  try {
    await saveOff(all.filter((id) => !on.has(id)));
    msg = `ok:${on.size} critères actifs enregistrés.`;
  } catch (e) {
    msg = `err:${e instanceof Error ? e.message : String(e)}`;
  }
  revalidatePath("/analyser/audit");
  redirect(backTo(form.get("back"), "/analyser/audit?onglet=criteres", msg));
}

/** Compte rendu mensuel : l'IA rédige le texte client (≈ 1 crédit). */
export async function draftMonthlyReportAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const { writeDraft } = await import("@/lib/reports/monthly");
  const customerId = String(form.get("customer_id") ?? "");
  const month = String(form.get("month") ?? "");
  const name = String(form.get("account_name") ?? customerId);
  let msg: string;
  try {
    if (!/^\d+$/.test(customerId) || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Compte ou mois manquant.");
    await writeDraft(customerId, name, month);
    msg = "ok:Compte rendu rédigé : relis-le, puis copie-le ou télécharge le PDF.";
  } catch (e) {
    msg = `err:${e instanceof Error ? e.message : String(e)}`;
  }
  revalidatePath("/rapports/compte-rendu");
  redirect(backTo(form.get("back"), "/rapports/compte-rendu", msg));
}

/** Rentabilité : enregistre les marges et le taux de conversion du compte. */
export async function saveRentabiliteAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const customerId = String(form.get("customer_id") ?? "");
  const num = (k: string, max: number) => {
    const n = Number(String(form.get(k) ?? "").replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`Valeur illisible ou hors limites : ${k}.`);
    return n;
  };
  let msg: string;
  try {
    if (!/^\d+$/.test(customerId)) throw new Error("Compte manquant.");
    const { saveRenta } = await import("@/lib/optimize/rentabilite");
    await saveRenta(customerId, {
      mode: String(form.get("mode")) === "lead" ? "lead" : "ecom",
      panier: num("panier", 1e7), cogs: num("cogs", 100), livraison: num("livraison", 100), transaction: num("transaction", 100),
      agence: num("agence", 100), opex: num("opex", 100), benefice: num("benefice", 100), conv: num("conv", 100), ca: num("ca", 1e9),
    });
    msg = "ok:Chiffres enregistrés.";
  } catch (e) {
    msg = `err:${e instanceof Error ? e.message : String(e)}`;
  }
  revalidatePath("/analyser/rentabilite");
  redirect(backTo(form.get("back"), "/analyser/rentabilite", msg));
}
