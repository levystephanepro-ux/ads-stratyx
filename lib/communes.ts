// Communes des Alpes-Maritimes et du Var (données publiques geo.api.gouv.fr, voir scripts/build-communes.mjs).
// Servent à l'autocomplétion et aux suggestions, jamais de centre de zone.
import data from "@/lib/data/communes-06-83.json";

export interface Commune {
  nom: string;
  insee: string;
  departement: "06" | "83";
  codesPostaux: string[];
  lat: number;
  lng: number;
  population: number;
}

export const COMMUNES_06_83 = data as Commune[];

export const NOMS_COMMUNES: string[] = COMMUNES_06_83.map((c) => c.nom);
