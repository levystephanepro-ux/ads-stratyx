// Synchronisation de la zone lors d'un changement d'étape, avec journal des échecs.
// Module pur (dépendances injectées) : testé avec node --test. La fiche affiche l'échec, les logs serveur le portent.
// Le changement d'étape n'est jamais bloqué par un échec de zone.

export interface EchecSynchro {
  /** Étape à laquelle la zone devait s'aligner. */
  stage: string;
  /** Texte affiché sur la fiche. */
  message: string;
  /** true : pas une panne, mais une reprise refusée parce qu'une autre zone chevauche. */
  conflit: boolean;
  /** Date ISO de l'échec. */
  at: string;
}

export interface DepsSynchro {
  synchroniser(clientId: string, stage: string): Promise<{ statut: string | null; conflit: boolean }>;
  noter(clientId: string, echec: EchecSynchro): Promise<void>;
  effacer(clientId: string): Promise<void>;
  /** Écrit dans les logs serveur (console.error en production). */
  journal(message: string, detail: Record<string, unknown>): void;
  maintenant?: () => Date;
}

export const MESSAGE_CONFLIT =
  "La zone n'a pas pu être reprise : une zone du même métier la chevauche maintenant. Contrôle la zone, puis réserve-la de nouveau si elle est libre.";

/**
 * Aligne la zone sur l'étape. Ne lève jamais.
 * - échec technique : journal serveur + échec noté pour la fiche ;
 * - conflit : journal serveur + échec noté ;
 * - succès : échec précédent effacé.
 * Renvoie true si la zone est alignée.
 */
export async function synchroniserAvecJournal(deps: DepsSynchro, clientId: string, stage: string): Promise<boolean> {
  const at = (deps.maintenant?.() ?? new Date()).toISOString();
  const noter = async (echec: EchecSynchro) => {
    try {
      await deps.noter(clientId, echec);
    } catch (e) {
      // Même le message d'échec peut ne pas s'enregistrer : on le dit dans les logs, jamais à l'utilisateur en silence.
      deps.journal("[zones] échec noté impossible", { clientId, stage, erreur: e instanceof Error ? e.message : String(e) });
    }
  };

  let r: { statut: string | null; conflit: boolean };
  try {
    r = await deps.synchroniser(clientId, stage);
  } catch (e) {
    const erreur = e instanceof Error ? e.message : String(e);
    deps.journal("[zones] échec de la synchronisation de la zone", { clientId, stage, erreur });
    await noter({ stage, conflit: false, at, message: `Erreur technique : ${erreur}` });
    return false;
  }

  if (r.conflit) {
    deps.journal("[zones] synchronisation refusée : chevauchement", { clientId, stage });
    await noter({ stage, conflit: true, at, message: MESSAGE_CONFLIT });
    return false;
  }

  try {
    await deps.effacer(clientId);
  } catch (e) {
    deps.journal("[zones] échec précédent non effacé", { clientId, stage, erreur: e instanceof Error ? e.message : String(e) });
  }
  return true;
}

/** Lecture tolérante d'un échec enregistré (texte JSON) : null si vide ou illisible. */
export function lireEchec(brut: string | null | undefined): EchecSynchro | null {
  if (!brut) return null;
  try {
    const j = JSON.parse(brut) as Partial<EchecSynchro>;
    if (typeof j.stage !== "string" || typeof j.message !== "string" || typeof j.at !== "string") return null;
    return { stage: j.stage, message: j.message.slice(0, 400), conflit: j.conflit === true, at: j.at };
  } catch {
    return null;
  }
}
