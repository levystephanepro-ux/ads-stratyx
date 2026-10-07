"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/workspace";
import { generateProposal } from "@/lib/clients/proposal";
import { setActiveClientCookie } from "@/lib/clients/active";
import { STAGES, stageOf, stageRank } from "@/lib/clients/stages";
import { getGlobalBilling } from "@/lib/billing";
import { createClientRow, updateClient, deleteClient, getClient, formAnswers, syncContext } from "@/lib/clients/store";

async function owner() {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
}

export async function createClientAction(form: FormData) {
  await owner();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return;
  const cid = String(form.get("customer_id") ?? "").replace(/\D/g, "") || null;
  const id = await createClientRow(name, cid);
  redirect(`/clients/${id}`);
}

export async function saveClientAction(form: FormData) {
  await owner();
  const id = String(form.get("id") ?? "");
  const c = await getClient(id);
  if (!c) return;
  const answers = formAnswers(form);
  const intent = String(form.get("intent") ?? "draft");
  const cid = String(form.get("customer_id") ?? "").replace(/\D/g, "") || null;
  const filled = Object.keys(answers).length > 0;
  await updateClient(id, {
    name: String(form.get("name") ?? c.name).trim() || c.name,
    customer_id: cid,
    website: String(form.get("website") ?? "").trim() || null,
    contact_email: String(form.get("contact_email") ?? "").trim() || null,
    notes: String(form.get("notes") ?? "").trim() || null,
    answers,
    status: intent === "done" ? "rempli" : c.status === "rempli" ? "rempli" : filled ? "brouillon" : c.status,
    submitted_at: intent === "done" ? new Date().toISOString() : c.submitted_at,
  });
  if (intent === "done" && stageRank(stageOf(c)) < stageRank("decouverte")) await updateClient(id, { stage: "decouverte" }).catch(() => undefined);
  const fresh = await getClient(id);
  const synced = fresh && form.get("sync") === "1" ? await syncContext(fresh) : false;
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  // Brouillon : retour à la liste des clients. Marqué comme rempli : on reste sur la fiche.
  if (intent !== "done") redirect(`/clients?saved=draft&name=${encodeURIComponent(fresh?.name ?? "")}`);
  redirect(`/clients/${id}?saved=${synced ? "sync" : "1"}`);
}

export async function markSentAction(form: FormData) {
  await owner();
  const id = String(form.get("id") ?? "");
  const c = await getClient(id);
  if (c && c.status === "a_envoyer") await updateClient(id, { status: "envoye" });
  revalidatePath(`/clients/${id}`);
}

export async function deleteClientAction(form: FormData) {
  await owner();
  await deleteClient(String(form.get("id") ?? ""));
  redirect("/clients");
}

export async function generateProposalAction(form: FormData) {
  await owner();
  const id = String(form.get("id") ?? "");
  const c = await getClient(id);
  if (!c) return;
  let err = "";
  if (!process.env.ANTHROPIC_API_KEY) err = "ANTHROPIC_API_KEY manquante.";
  else {
    const billing = await getGlobalBilling();
    if (!billing.allowed) err = billing.reason ?? "Plafond IA atteint.";
    else {
      try {
        await generateProposal(c);
        if (stageRank(stageOf(c)) < stageRank("decouverte")) await updateClient(id, { stage: "decouverte" }).catch(() => undefined);
      } catch (e) { err = e instanceof Error ? e.message : String(e); }
    }
  }
  redirect(`/clients/${id}/proposition${err ? `?err=${encodeURIComponent(err.slice(0, 200))}` : ""}`);
}

export async function setActiveClientAction(form: FormData) {
  await owner();
  const id = String(form.get("id") ?? "");
  await setActiveClientCookie(id || null);
  const back = String(form.get("back") ?? "");
  redirect(back.startsWith("/") ? back : "/clients");
}

export async function setStageAction(form: FormData) {
  await owner();
  const id = String(form.get("id") ?? "");
  const stage = String(form.get("stage") ?? "");
  if (!STAGES.some((s) => s.key === stage)) return;
  try { await updateClient(id, { stage }); }
  catch (e) { redirect(`/clients/${id}?err=${encodeURIComponent("Étape non enregistrée : lance la migration 0022_client_stage.sql dans Supabase. " + (e instanceof Error ? e.message : ""))}`); }
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}
