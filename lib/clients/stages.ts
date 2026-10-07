// Étapes commerciales d'une fiche client et prochaine action conseillée.
import type { Client } from "./store";

export const STAGES = [
  { key: "prospect", label: "Prospect" },
  { key: "decouverte", label: "Découverte faite" },
  { key: "proposition", label: "Proposition envoyée" },
  { key: "signe", label: "Signé" },
  { key: "lancement", label: "En lancement" },
  { key: "actif", label: "Campagnes actives" },
  { key: "pause", label: "En pause" },
  { key: "perdu", label: "Perdu" },
] as const;
export type Stage = (typeof STAGES)[number]["key"];
export const stageOf = (c: Pick<Client, "stage">): Stage => (STAGES.some((s) => s.key === c.stage) ? (c.stage as Stage) : "prospect");
export const stageLabel = (s: Stage) => STAGES.find((x) => x.key === s)!.label;
export const stageRank = (s: Stage) => STAGES.findIndex((x) => x.key === s);

export function nextAction(c: Client, hasProposal: boolean): { text: string; href: string } | null {
  const s = stageOf(c);
  const fiche = `/clients/${c.id}`;
  switch (s) {
    case "prospect":
      return c.status === "rempli" ? { text: "Passer en « Découverte faite » et générer la proposition", href: `${fiche}/proposition` }
        : c.status === "brouillon" ? { text: "Terminer le questionnaire", href: fiche }
        : { text: "Remplir le questionnaire pendant l'appel ou envoyer le lien", href: fiche };
    case "decouverte":
      return { text: hasProposal ? "Relire et envoyer la proposition" : "Générer la synthèse et la proposition", href: `${fiche}/proposition` };
    case "proposition":
      return { text: "Relancer le prospect et valider le budget", href: `${fiche}/proposition` };
    case "signe":
      return c.customer_id ? { text: "Préparer la campagne dans Prévisions", href: `/previsions?account=${c.customer_id}` }
        : { text: "Lier le compte Google Ads (Comptes liés) puis la fiche", href: fiche };
    case "lancement":
      return c.customer_id ? { text: "Créer les campagnes en pause, vérifier le suivi, activer", href: `/previsions?account=${c.customer_id}` } : { text: "Lier le compte Google Ads", href: fiche };
    case "actif":
      return c.customer_id ? { text: "Suivre le Diagnostic et envoyer le rapport du mois", href: `/waste?account=${c.customer_id}` } : null;
    default:
      return null;
  }
}
