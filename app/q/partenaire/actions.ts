"use server";
import { redirect } from "next/navigation";
import { createPartnerLead } from "@/lib/clients/store";
import { sendAgentEmail } from "@/lib/agent/email";

const NOTIFY_EMAIL = "contact@stratyxmedia.fr";
const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Première étape du lien partenaire : crée la fiche, puis envoie le client sur son propre questionnaire (version courte). */
export async function startPartnerAction(form: FormData) {
  const rawSource = clean(form.get("source"), 30).toLowerCase();
  const source = /^[a-z0-9-]{1,30}$/.test(rawSource) ? rawSource : "partenaire";
  const back = `/q/partenaire?source=${encodeURIComponent(source)}`;
  if (clean(form.get("website_hp"), 50)) redirect(back); // champ piège anti-robot
  const name = clean(form.get("name"), 120);
  const activite = clean(form.get("activite"), 200);
  const zone = clean(form.get("zone"), 200);
  if (!name || !activite || !zone || form.get("accord") !== "on") redirect(`${back}&err=1`);
  let token: string;
  try {
    token = await createPartnerLead({ name, activite, zone, source });
  } catch (e) {
    console.error("[q/partenaire] création de la fiche impossible :", e instanceof Error ? e.message : e);
    redirect(`${back}&err=2`);
  }
  try {
    await sendAgentEmail(
      `🤝 Nouveau prospect partenaire · ${name}`,
      [`**${name}** vient d'ouvrir le lien partenaire (source : ${source}).`, `- Activité : ${activite}`, `- Zone : ${zone}`, "- Vérifier si le métier est encore disponible dans la zone (une seule place par métier et par zone)."].join("\n"),
      NOTIFY_EMAIL,
    );
  } catch { /* la fiche reste la source de vérité si l'email échoue */ }
  redirect(`/q/${token}?v=court`);
}
