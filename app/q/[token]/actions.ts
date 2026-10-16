"use server";
import { redirect } from "next/navigation";
import { getClientByToken, updateClient, formAnswers, syncContext, getClient } from "@/lib/clients/store";
import { publicKeys, parcoursOf } from "@/lib/clients/questions";
import { sendAgentEmail } from "@/lib/agent/email";
import { verdictOf } from "@/lib/clients/verdict";

const NOTIFY_EMAIL = "contact@stratyxmedia.fr";
const SITE_URL = "https://app.stratyxmedia.fr";

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
  const keys = publicKeys(short, parcoursOf(c.answers));
  const mine = formAnswers(form, keys);
  if (Object.keys(mine).length === 0) redirect(back);
  const kept = Object.fromEntries(Object.entries(c.answers ?? {}).filter(([k]) => !keys.has(k)));
  const wasRempli = c.status === "rempli";
  await updateClient(c.id, draft
    ? { answers: { ...kept, ...mine }, status: c.status === "rempli" ? "rempli" : "brouillon" }
    : { answers: { ...kept, ...mine }, status: "rempli", submitted_at: new Date().toISOString() });
  const fresh = await getClient(c.id);
  if (fresh) { try { await syncContext(fresh); } catch { /* le contexte se resynchronise depuis la fiche */ } }
  // Notifie par email la toute première fois que le questionnaire passe à "rempli"
  // (pas à chaque réouverture/modification ultérieure du lien par le client).
  if (!draft && !wasRempli && fresh) {
    try {
      const v = verdictOf(fresh.answers);
      await sendAgentEmail(
        `📋 Questionnaire rempli · ${fresh.name || "Nouveau prospect"}`,
        [
          `**${fresh.name || "Un prospect"}** vient de remplir son questionnaire de découverte.`,
          fresh.contact_email ? `- Email : ${fresh.contact_email}` : "",
          fresh.contact_phone ? `- Téléphone : ${fresh.contact_phone}` : "",
          fresh.website ? `- Site : ${fresh.website}` : "",
          `\n**Avis : ${v.titre}**`,
          ...v.lignes.map((l) => `- ${l}`),
          `- [Voir la fiche client](${SITE_URL}/clients/${fresh.id})`,
        ].filter(Boolean).join("\n"),
        NOTIFY_EMAIL,
      );
    } catch { /* la fiche reste la source de vérité si l'email échoue */ }
  }
  redirect(done);
}
