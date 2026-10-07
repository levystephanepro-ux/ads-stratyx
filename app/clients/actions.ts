"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/workspace";
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
  const cid = String(form.get("customer_id") ?? "").replace(/\D/g, "") || null;
  const filled = Object.keys(answers).length > 0;
  await updateClient(id, {
    name: String(form.get("name") ?? c.name).trim() || c.name,
    customer_id: cid,
    website: String(form.get("website") ?? "").trim() || null,
    contact_email: String(form.get("contact_email") ?? "").trim() || null,
    notes: String(form.get("notes") ?? "").trim() || null,
    answers,
    status: filled && c.status === "a_envoyer" ? "rempli" : c.status,
    submitted_at: filled ? (c.submitted_at ?? new Date().toISOString()) : c.submitted_at,
  });
  const fresh = await getClient(id);
  const synced = fresh && form.get("sync") === "1" ? await syncContext(fresh) : false;
  revalidatePath(`/clients/${id}`);
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
