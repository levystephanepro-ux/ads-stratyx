"use server";
import { redirect } from "next/navigation";
import { getClientByToken, updateClient, formAnswers, syncContext, getClient } from "@/lib/clients/store";
import { publicKeys } from "@/lib/clients/questions";

export async function submitQuestionnaireAction(form: FormData) {
  const token = String(form.get("token") ?? "");
  const short = form.get("v") === "court";
  const c = await getClientByToken(token);
  if (!c) return;
  const back = `/q/${token}${short ? "?v=court" : ""}`;
  if (String(form.get("website_hp") ?? "")) redirect(`${back}${short ? "&" : "?"}ok=1`); // champ piège anti-robot
  // Le client ne modifie que les questions qu'il voit : le reste (dont les notes internes) est conservé.
  const keys = publicKeys(short);
  const mine = formAnswers(form, keys);
  if (Object.keys(mine).length === 0) redirect(back);
  const kept = Object.fromEntries(Object.entries(c.answers ?? {}).filter(([k]) => !keys.has(k)));
  await updateClient(c.id, { answers: { ...kept, ...mine }, status: "rempli", submitted_at: new Date().toISOString() });
  const fresh = await getClient(c.id);
  if (fresh) { try { await syncContext(fresh); } catch { /* le contexte se resynchronise depuis la fiche */ } }
  redirect(`${back}${short ? "&" : "?"}ok=1`);
}
