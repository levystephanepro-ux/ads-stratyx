"use server";
import { redirect } from "next/navigation";
import { getClientByToken, updateClient, cleanAnswers, syncContext, getClient } from "@/lib/clients/store";

export async function submitQuestionnaireAction(form: FormData) {
  const token = String(form.get("token") ?? "");
  const c = await getClientByToken(token);
  if (!c) return;
  if (String(form.get("website_hp") ?? "")) redirect(`/q/${token}?ok=1`); // champ piège anti-robot
  const raw: Record<string, FormDataEntryValue | null> = {};
  form.forEach((v, k) => { raw[k] = v; });
  const answers = cleanAnswers(raw);
  if (Object.keys(answers).length === 0) redirect(`/q/${token}`);
  await updateClient(c.id, { answers, status: "rempli", submitted_at: new Date().toISOString() });
  const fresh = await getClient(c.id);
  if (fresh) { try { await syncContext(fresh); } catch { /* le contexte se resynchronise depuis la fiche */ } }
  redirect(`/q/${token}?ok=1`);
}
