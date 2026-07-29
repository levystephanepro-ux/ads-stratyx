/* ------------------------------------------------------------------
   lib/zones.ts
   Source unique de vérité pour l'exclusivité territoriale.
   Importé par /artisans (affichage) ET par le formulaire (contrôle).

   RÈGLE ABSOLUE : ne jamais laisser une entrée "libre" qui ne l'est
   plus. C'est la promesse centrale de l'offre ; une seule erreur ici
   coûte plus cher que dix leads manqués.

   À terme : brancher sur Notion (base "Exclusivités") et remplacer
   ce tableau par un fetch avec revalidation. En attendant, édition
   manuelle après chaque signature.
   ------------------------------------------------------------------ */

export type Metier =
  | "Plomberie"
  | "Chauffage / climatisation"
  | "Électricité"
  | "Serrurerie"
  | "Couverture"
  | "Maçonnerie"
  | "Menuiserie / cuisine"
  | "Peinture"
  | "Carrelage"
  | "Paysagisme"
  | "Piscine"
  | "Vitrerie"
  | "Autre";

export const METIERS: Metier[] = [
  "Plomberie",
  "Chauffage / climatisation",
  "Électricité",
  "Serrurerie",
  "Couverture",
  "Maçonnerie",
  "Menuiserie / cuisine",
  "Peinture",
  "Carrelage",
  "Paysagisme",
  "Piscine",
  "Vitrerie",
  "Autre",
];

/** Communes proposées en autocomplétion. Liste indicative, non limitative. */
export const COMMUNES: string[] = [
  // Alpes-Maritimes (06)
  "Nice",
  "Cagnes-sur-Mer",
  "Saint-Laurent-du-Var",
  "Antibes",
  "Villeneuve-Loubet",
  "Cannes",
  "Le Cannet",
  "Mandelieu-la-Napoule",
  "Grasse",
  "Mougins",
  "Vallauris",
  "Menton",
  "Roquebrune-Cap-Martin",
  "Beausoleil",
  "Carros",
  "Vence",
  "Saint-Laurent-du-Var",
  "La Trinité",
  "Mouans-Sartoux",
  "Valbonne",
  // Var (83)
  "Fréjus",
  "Saint-Raphaël",
  "Draguignan",
  "Toulon",
  "Hyères",
  "La Seyne-sur-Mer",
  "Six-Fours-les-Plages",
  "Sainte-Maxime",
  "Saint-Tropez",
  "Brignoles",
];

export type Exclusivite = {
  commune: string;
  metier: Metier;
  libre: boolean;
};

/** État réel des places. À mettre à jour à chaque signature. */
export const ZONES: Exclusivite[] = [
  { commune: "Nice", metier: "Plomberie", libre: true },
  { commune: "Nice", metier: "Électricité", libre: false },
  { commune: "Cagnes-sur-Mer", metier: "Plomberie", libre: true },
  { commune: "Antibes", metier: "Menuiserie / cuisine", libre: true },
  { commune: "Saint-Laurent-du-Var", metier: "Couverture", libre: true },
  { commune: "Cannes", metier: "Paysagisme", libre: false },
];

/** Normalise pour comparer "Saint-Laurent du Var" et "saint laurent-du-var". */
export function normalise(valeur: string): string {
  return valeur
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type EtatZone = "libre" | "prise" | "inconnue";

/**
 * Renvoie l'état connu d'un couple métier/commune.
 * "inconnue" = pas encore attribuée dans notre suivi : c'est le cas
 * le plus fréquent, et il se traite par une vérification manuelle.
 */
export function etatZone(metier: string, commune: string): EtatZone {
  const m = normalise(metier);
  const c = normalise(commune);
  const trouve = ZONES.find(
    (z) => normalise(z.metier) === m && normalise(z.commune) === c
  );
  if (!trouve) return "inconnue";
  return trouve.libre ? "libre" : "prise";
}

/** Communes voisines à proposer quand une place est prise. */
export function communesVoisines(commune: string, metier: string): string[] {
  const groupes: string[][] = [
    ["Nice", "Saint-Laurent-du-Var", "Cagnes-sur-Mer", "La Trinité", "Carros"],
    ["Antibes", "Villeneuve-Loubet", "Vallauris", "Valbonne", "Mougins"],
    ["Cannes", "Le Cannet", "Mandelieu-la-Napoule", "Mouans-Sartoux", "Grasse"],
    ["Menton", "Roquebrune-Cap-Martin", "Beausoleil"],
    ["Fréjus", "Saint-Raphaël", "Sainte-Maxime", "Draguignan"],
    ["Toulon", "La Seyne-sur-Mer", "Six-Fours-les-Plages", "Hyères"],
  ];
  const c = normalise(commune);
  const groupe = groupes.find((g) => g.some((x) => normalise(x) === c));
  if (!groupe) return [];
  return groupe
    .filter((x) => normalise(x) !== c)
    .filter((x) => etatZone(metier, x) !== "prise")
    .slice(0, 3);
}
