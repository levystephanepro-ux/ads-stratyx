"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/workspace";
import { setMonitored } from "@/lib/audit/run";
import { setSetting } from "@/lib/agent/store";
import { clearManagedCache, inviteClientAccount } from "@/lib/google-ads/client";

async function owner() {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  return ctx;
}

export async function toggleMonitoringAction(form: FormData) {
  await owner();
  const id = String(form.get("customer_id") ?? "");
  if (!/^\d{6,12}$/.test(id)) return;
  await setMonitored(id, form.get("on") === "1");
  revalidatePath("/comptes");
}

/** Compte par défaut : utilisé quand aucun client n'est sélectionné. */
export async function setDefaultAccountAction(form: FormData) {
  const ctx = await owner();
  const id = String(form.get("customer_id") ?? "").replace(/\D/g, "");
  if (!/^\d{6,12}$/.test(id)) return;
  await setSetting("default_customer_id", id, null);
  if (ctx.workspaceId) await setSetting("default_customer_id", id, ctx.workspaceId).catch(() => undefined);
  revalidatePath("/", "layout");
  redirect("/comptes?msg=" + encodeURIComponent("Compte par défaut mis à jour."));
}

export async function syncAccountsAction() {
  await owner();
  clearManagedCache();
  revalidatePath("/comptes");
  redirect("/comptes?msg=" + encodeURIComponent("Liste des comptes relue dans Google Ads."));
}

export async function inviteAccountAction(form: FormData) {
  await owner();
  const id = String(form.get("customer_id") ?? "").replace(/\D/g, "");
  if (id.length !== 10) redirect("/comptes?err=" + encodeURIComponent("L'identifiant Google Ads compte 10 chiffres (ex. 123-456-7890)."));
  let msg: string;
  try {
    await inviteClientAccount(id);
    msg = "?msg=" + encodeURIComponent(`Invitation envoyée au compte ${id.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3")}. Le client doit l'accepter dans Google Ads : Admin, Accès et sécurité, Gestionnaires.`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    const why = /ALREADY|DUPLICATE|already/i.test(m) ? "Ce compte est déjà associé à ton MCC ou une invitation est déjà en attente."
      : /PERMISSION|DEVELOPER_TOKEN|not approved|access/i.test(m) ? `Google refuse l'invitation par l'API (${m.slice(0, 160)}). Envoie-la depuis ton MCC : Comptes, bouton +, Associer un compte existant.`
      : m.slice(0, 220);
    msg = "?err=" + encodeURIComponent(why);
  }
  revalidatePath("/comptes");
  redirect("/comptes" + msg);
}
