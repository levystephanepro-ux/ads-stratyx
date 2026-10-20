// Branchement serveur de la confirmation au prospect (Resend, base, logs). La logique est dans lib/zone-confirmation.ts.
import { sendProspectEmail } from "@/lib/agent/email";
import { confirmationsRecentesZone, noterConfirmationEnvoyee } from "@/lib/clients/store";
import {
  AntiDoublon, DELAI_ANTI_DOUBLON_MS, cleDoublon, envoyerConfirmation, resoudreContactProspect, type DemandeConfirmation,
} from "@/lib/zone-confirmation";

// Mémoire de l'instance serveur : protège contre un double envoi du formulaire (clic répété, rechargement).
const antiDoublon = new AntiDoublon();

/**
 * Envoie la confirmation à l'adresse saisie par le prospect. Ne lève jamais : un échec est écrit dans les logs
 * (sans l'adresse e-mail) et la demande, déjà enregistrée, n'est pas affectée.
 * Variables facultatives : PROSPECT_EMAIL_FROM (sinon AGENT_EMAIL_FROM), PROSPECT_CONTACT_EMAIL (adresse affichée, sinon
 * contact@stratyxmedia.fr), PROSPECT_REPLY_TO (sinon PROSPECT_CONTACT_EMAIL, puis contact@stratyxmedia.fr, puis AGENT_EMAIL_TO).
 */
export async function confirmerDemande(demandeId: string, d: DemandeConfirmation): Promise<"envoye" | "doublon" | "echec"> {
  const { contactEmail, replyTo } = resoudreContactProspect(process.env);
  try {
    return await envoyerConfirmation({
      envoyer: sendProspectEmail,
      dejaConfirmee: async () => {
        const cle = cleDoublon(d.email, d.adresse, d.activiteId);
        const depuis = new Date(Date.now() - DELAI_ANTI_DOUBLON_MS).toISOString();
        const recentes = await confirmationsRecentesZone(depuis, demandeId);
        return recentes.some((r) => cleDoublon(r.contact_email ?? "", r.answers.adresse_etablissement ?? "", r.answers.activite_exclusive ?? "") === cle);
      },
      noterEnvoi: () => noterConfirmationEnvoyee(demandeId),
      journal: (message, detail) => console.error(message, detail),
      antiDoublon,
      contact: { email: contactEmail },
      replyTo,
    }, d, demandeId);
  } catch {
    // envoyerConfirmation ne lève pas ; garde-fou ultime pour ne jamais bloquer la réponse.
    return "echec";
  }
}
