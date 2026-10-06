// Bibliothèque de scripts : des rapports chiffrés sur un compte Google Ads.
// Chaque script = une ou quelques requêtes GAQL + un calcul simple, sans IA
// (0 crédit). Lecture seule : rien n'est modifié dans le compte.
import type { AdsContext } from "@/lib/google-ads/client";

export type ScriptCategory =
  | "cpc_cpa"
  | "recherches"
  | "rapports"
  | "calendrier"
  | "diagnostic"
  | "annonces"
  | "mots_cles"
  | "encheres_budget"
  | "audiences"
  | "conversions"
  | "pmax"
  | "display_shopping";

export const SCRIPT_CATEGORIES: Record<ScriptCategory, string> = {
  diagnostic: "Diagnostic",
  mots_cles: "Mots-clés",
  recherches: "Recherches",
  cpc_cpa: "CPC et CPA",
  encheres_budget: "Enchères et budget",
  annonces: "Annonces",
  conversions: "Conversions",
  calendrier: "Calendrier",
  rapports: "Rapports",
  audiences: "Audiences",
  pmax: "Performance Max",
  display_shopping: "Display et Shopping",
};

export type Level = "Débutant" | "Intermédiaire" | "Avancé";
export type Frequency = "Quotidien" | "Hebdomadaire" | "Mensuel";
export type ColType = "text" | "eur" | "int" | "num" | "pct" | "date";

export interface Column {
  key: string;
  label: string;
  type: ColType;
}

export type Row = Record<string, string | number | null>;

export interface ScriptRange {
  since: string; // YYYY-MM-DD
  until: string;
  days: number;
}

export interface ScriptOutput {
  rows: Row[];
  /** Phrase de synthèse affichée au-dessus du tableau (facultative). */
  summary?: string;
}

export interface ScriptDef {
  id: string;
  title: string;
  description: string;
  category: ScriptCategory;
  level: Level;
  frequency: Frequency;
  channels: string;
  columns: Column[];
  /** Exécution sur clic seulement (lent, ou consomme des crédits IA). Texte du bouton. */
  confirm?: string;
  run: (ctx: AdsContext, range: ScriptRange) => Promise<ScriptOutput>;
}
