// Types du moteur de diagnostic. Tout est calculé sans IA (0 crédit) à partir
// des données lues via l'API Google Ads. Rien n'est jamais modifié dans le compte.

export type AuditCategory =
  | "recherches"
  | "mots_cles"
  | "conflits"
  | "budgets"
  | "annonces"
  | "reglages";

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  recherches: "Recherches",
  mots_cles: "Mots-clés",
  conflits: "Négatifs",
  budgets: "Budgets",
  annonces: "Annonces et extensions",
  reglages: "Réglages et suivi",
};

/** critique = bloque des résultats aujourd'hui · important = coûte de l'argent · mineur = à surveiller */
export type Severity = "critique" | "important" | "mineur";

export interface Constat {
  /** Identifiant stable (même constat d'un jour à l'autre). */
  id: string;
  category: AuditCategory;
  severity: Severity;
  title: string;
  detail: string;
  campaign: string | null;
  /** Montant en jeu sur 30 jours (€), ou null si non chiffrable. */
  amount: number | null;
  /** Ce qu'il faut faire, en une phrase. */
  action: string;
  /** Texte prêt à coller dans Google Ads (négatifs, etc.), facultatif. */
  paste?: string;
}

export interface AuditResult {
  healthScore: number;
  constats: Constat[];
  /** Montant en jeu prouvé (gaspillage prouvé, €). */
  wasteProven: number;
  /** Montant en jeu à confirmer (€). */
  wasteWatch: number;
  totalCost: number;
  conversions: number;
  /** Vérifications qui n'ont pas pu tourner (erreur API, champ indisponible…). */
  skipped: { check: string; reason: string }[];
}

/** Données normalisées dont les règles ont besoin (mock ou live). */
export interface AuditData {
  searchTerms: { campaignId: string; campaignName: string; term: string; clicks: number; cost: number; conversions: number }[];
  keywords: {
    campaign: string;
    campaignId: string;
    adGroup: string;
    adGroupId: string;
    text: string;
    matchType: "EXACT" | "PHRASE" | "BROAD" | string;
    qualityScore: number | null;
    cost: number;
    clicks: number;
    impressions: number;
    conversions: number;
  }[];
  negatives: {
    /** campagne | groupe d'annonces | liste partagée */
    level: "campaign" | "ad_group" | "shared";
    campaignId: string;
    campaign: string;
    adGroupId?: string;
    sharedSet?: string;
    text: string;
    matchType: "EXACT" | "PHRASE" | "BROAD" | string;
  }[];
  campaigns: {
    id: string;
    name: string;
    channel: string;
    dailyBudget: number;
    cost: number;
    clicks: number;
    conversions: number;
    /** Parts d'impressions (0-1), null si non disponible (hors Search). */
    impressionShare: number | null;
    lostBudget: number | null;
    lostRank: number | null;
  }[];
  policy: {
    kind: "annonce" | "extension";
    campaign: string | null;
    label: string;
    status: "DISAPPROVED" | "APPROVED_LIMITED" | string;
    reasons: string[];
  }[];
  daily: { date: string; clicks: number; conversions: number; cost: number }[];
  /** Nombre d'actions de conversion actives, null si inconnu. */
  conversionActions: number | null;
}
