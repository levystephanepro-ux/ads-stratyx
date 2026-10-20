// Vérification publique d'une zone : géocodage de l'adresse, lecture des zones, contrôle de chevauchement.
// Serveur seulement. Toute erreur (géocodage, lecture, activité hors liste) donne « inconnue », jamais « libre ».
import { COMMUNES_06_83 } from "@/lib/communes";
import { geocoder, type Geocodage } from "@/lib/geocode";
import { zonesOccupees } from "@/lib/zones-store";
import { activiteReconnue, controleZone, estAutreActivite, suggestions, type EtatZone } from "@/lib/zones";

export interface VerificationZone {
  etat: EtatZone;
  /** Rayon maximal possible (km entiers), seulement pour une zone partielle. */
  rayonMaxKm?: number;
  /** Noms de communes voisines libres pour le rayon voulu. */
  suggestions: string[];
  /** Adresse non précise (rue ou commune seulement) : résultat à confirmer. */
  indicatif: boolean;
  /** « Autre activité » : jamais contrôlée, toujours à vérifier à la main. */
  autre?: boolean;
  /** Usage serveur uniquement : jamais renvoyé au navigateur. */
  geo: Geocodage | null;
}

export async function verifierZone(activite: string, adresse: string, rayonKm: number): Promise<VerificationZone> {
  const geo = await geocoder(adresse);
  // « Autre activité » : aucune lecture des zones, jamais « libre » ni « prise ».
  if (estAutreActivite(activite)) return { etat: "inconnue", suggestions: [], indicatif: false, autre: true, geo };
  const act = activiteReconnue(activite);
  if (!act || !geo) return { etat: "inconnue", suggestions: [], indicatif: false, geo };

  let occupees;
  try {
    occupees = await zonesOccupees(act);
  } catch {
    return { etat: "inconnue", suggestions: [], indicatif: false, geo };
  }

  const r = controleZone(act, geo, rayonKm, occupees);
  const indicatif = geo.precision !== "adresse";
  if (r.etat === "libre") return { etat: "libre", suggestions: [], indicatif, geo };
  if (r.etat === "inconnue") return { etat: "inconnue", suggestions: [], indicatif: false, geo };

  const voisines = suggestions(act, geo, rayonKm, COMMUNES_06_83, occupees).map((c) => c.nom);
  return {
    etat: r.etat,
    // Entier vers le bas : le public n'a pas besoin de la valeur exacte.
    rayonMaxKm: r.etat === "partielle" && r.rayonMaxKm !== undefined ? Math.floor(r.rayonMaxKm) : undefined,
    suggestions: voisines,
    indicatif,
    geo,
  };
}
