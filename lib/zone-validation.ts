// Validation et nettoyage des champs de « Autre activité » (page /zone, route /api/zone/check).
// Module pur, sans accès base : utilisé côté serveur, testé avec node --test.
// Aucun HTML accepté : toute balise (< ou >) est refusée, jamais « réparée ».
import {
  AUTRE_ACTIVITE_MAX, AUTRE_ACTIVITE_MIN, DESCRIPTION_MAX, PANIER_MAX_EUR, PANIER_MIN_EUR,
} from "./zones.ts";

/** Au-delà, on refuse sans lire : évite de traiter une charge démesurée. */
const LONGUEUR_BRUTE_MAX = 1000;

/** Texte nettoyé : caractères de contrôle retirés, espaces multiples réduits, bords rognés. Chaîne vide si ce n'est pas du texte. */
export function nettoyerTexte(valeur: unknown): string {
  if (typeof valeur !== "string") return "";
  return valeur
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Vrai si le texte contient une balise ou un début de balise HTML. */
export function contientHtml(texte: string): boolean {
  return /[<>]/.test(texte);
}

export interface AutreActiviteValide {
  autreActivite: string;
  panierMoyen: number;
  description: string;
}

export type ResultatAutreActivite =
  | { ok: true; valeurs: AutreActiviteValide }
  | { ok: false; erreurs: Record<string, string> };

function lireTexte(brut: unknown, min: number, max: number, vide: string | null): { texte: string; erreur: string | null } {
  if (brut === undefined || brut === null || brut === "") {
    return { texte: "", erreur: vide };
  }
  if (typeof brut !== "string") return { texte: "", erreur: "Texte non valide." };
  if (brut.length > LONGUEUR_BRUTE_MAX) return { texte: "", erreur: `${max} caractères au maximum.` };
  const texte = nettoyerTexte(brut);
  if (contientHtml(texte)) return { texte: "", erreur: "Les balises HTML ne sont pas acceptées." };
  if (texte.length === 0) return { texte, erreur: vide };
  if (texte.length < min) return { texte, erreur: `${min} caractères au minimum.` };
  if (texte.length > max) return { texte, erreur: `${max} caractères au maximum.` };
  return { texte, erreur: null };
}

/** Panier moyen : nombre ou texte numérique (virgule acceptée), entre 1 et 100 000 €, arrondi au centime. */
export function lirePanier(brut: unknown): { valeur: number; erreur: string | null } {
  const manquant = "Indiquez le panier moyen estimé.";
  let n: number;
  if (typeof brut === "number") {
    n = brut;
  } else if (typeof brut === "string") {
    const t = brut.trim().replace(/\s/g, "").replace(",", ".");
    if (!t) return { valeur: 0, erreur: manquant };
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return { valeur: 0, erreur: "Indiquez un nombre, par exemple 450." };
    n = Number(t);
  } else {
    return { valeur: 0, erreur: manquant };
  }
  if (!Number.isFinite(n)) return { valeur: 0, erreur: "Indiquez un nombre, par exemple 450." };
  if (n < PANIER_MIN_EUR || n > PANIER_MAX_EUR) {
    return { valeur: 0, erreur: `Le panier moyen doit être compris entre ${PANIER_MIN_EUR} et ${PANIER_MAX_EUR.toLocaleString("fr-FR")} euros.` };
  }
  return { valeur: Math.round(n * 100) / 100, erreur: null };
}

export function validerAutreActivite(b: { autreActivite?: unknown; panierMoyen?: unknown; description?: unknown }): ResultatAutreActivite {
  const erreurs: Record<string, string> = {};

  const act = lireTexte(b.autreActivite, AUTRE_ACTIVITE_MIN, AUTRE_ACTIVITE_MAX, "Indiquez votre activité.");
  if (act.erreur) erreurs.autreActivite = act.erreur;

  const panier = lirePanier(b.panierMoyen);
  if (panier.erreur) erreurs.panierMoyen = panier.erreur;

  const desc = lireTexte(b.description, 0, DESCRIPTION_MAX, null);
  if (desc.erreur) erreurs.description = desc.erreur;

  if (Object.keys(erreurs).length) return { ok: false, erreurs };
  return { ok: true, valeurs: { autreActivite: act.texte, panierMoyen: panier.valeur, description: desc.texte } };
}
