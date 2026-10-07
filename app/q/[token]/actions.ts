"use server";
import { redirect } from "next/navigation";
import { getClientByToken, updateClient, formAnswers, syncContext, getClient } from "@/lib/clients/store";
import { publicKeys } from "@/lib/clients/questions";

export async function submitDraftAction(form: FormData) { return submit(form, true); }
export async function submitDoneAction(form: FormData) { return submit(form, false); }
export async function submitQuestionnaireAction(form: FormData) { return submit(form, form.get("intent") === "draft"); }

async function submit(form: FormData, draft: boolean) {
  const token = String(form.get("token") ?? "");
  const short = form.get("v") === "court";
  const c = await getClientByToken(token);
  if (!c) return;
  const back = `/q/${token}${short ? "?v=court" : ""}`;
  const done = `${back}${short ? "&" : "?"}${draft ? "ok=draft" : "ok=1"}`;
  if (String(form.get("website_hp") ?? "")) redirect(done); // champ piège anti-robot
  // Le client ne modifie que les questions qu'il voit : le reste (dont les notes internes) est conservé.
  const keys = publicKeys(short);
  const mine = formAnswers(form, keys);
  if (Object.keys(mine).length === 0) redirect(back);
  const kept = Object.fromEntries(Object.entries(c.answers ?? {}).filter(([k]) => !keys.has(k)));
  await updateClient(c.id, draft
    ? { answers: { ...kept, ...mine }, status: c.status === "rempli" ? "rempli" : "brouillon" }
    : { answers: { ...kept, ...mine }, status: "rempli", submitted_at: new Date().toISOString() });
  const fresh = await getClient(c.id);
  if (fresh) { try { await syncContext(fresh); } catch { /* le contexte se resynchronise depuis la fiche */ } }
  redirect(done);
}
