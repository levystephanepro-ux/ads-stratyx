// Données factices réalistes pour développer sans accès Google Ads API.
// Deux scénarios : DEMO (compte plombier pour les visios prospects)
// et le compte D2B Rénovation (dev interne).
import type { AdsAccount, Campaign, CampaignMetrics } from "./types";

// ---------------------------------------------------------------------------
// Scénario DEMO — Dupont Plomberie Nice (visio prospects)
// ---------------------------------------------------------------------------

export const DEMO_ACCOUNT: AdsAccount = {
  customerId: "9901234567",
  descriptiveName: "Dupont Plomberie — Nice Centre",
  currencyCode: "EUR",
  timeZone: "Europe/Paris",
};

// Situation AVANT gestion Stratyx — campagnes mal structurées
export const DEMO_CAMPAIGNS_AVANT: Campaign[] = [
  { id: "301", name: "Plombier Nice", status: "ENABLED", channel: "SEARCH", dailyBudget: 15 },
  { id: "302", name: "Urgence plomberie", status: "ENABLED", channel: "SEARCH", dailyBudget: 8 },
];

export const DEMO_METRICS_AVANT: CampaignMetrics[] = [
  {
    campaignId: "301",
    campaignName: "Plombier Nice",
    impressions: 3240,
    clicks: 98,
    cost: 387.44,
    conversions: 3,      // 3 appels seulement
    conversionsValue: 1200,
  },
  {
    campaignId: "302",
    campaignName: "Urgence plomberie",
    impressions: 1820,
    clicks: 44,
    cost: 99.88,
    conversions: 1,
    conversionsValue: 350,
  },
];

// Situation APRÈS 30 jours de gestion Stratyx
export const DEMO_CAMPAIGNS_APRES: Campaign[] = [
  { id: "311", name: "Search · Plombier urgence Nice", status: "ENABLED", channel: "SEARCH", dailyBudget: 12 },
  { id: "312", name: "Search · Dépannage fuite chauffe-eau", status: "ENABLED", channel: "SEARCH", dailyBudget: 8 },
  { id: "313", name: "Search · Marque (Dupont Plomberie)", status: "ENABLED", channel: "SEARCH", dailyBudget: 5 },
];

export const DEMO_METRICS_APRES: CampaignMetrics[] = [
  {
    campaignId: "311",
    campaignName: "Search · Plombier urgence Nice",
    impressions: 4180,
    clicks: 187,
    cost: 381.22,
    conversions: 14,     // 14 appels qualifiés
    conversionsValue: 8400,
  },
  {
    campaignId: "312",
    campaignName: "Search · Dépannage fuite chauffe-eau",
    impressions: 2340,
    clicks: 96,
    cost: 198.44,
    conversions: 5,
    conversionsValue: 2750,
  },
  {
    campaignId: "313",
    campaignName: "Search · Marque (Dupont Plomberie)",
    impressions: 890,
    clicks: 71,
    cost: 49.21,
    conversions: 3,
    conversionsValue: 1650,
  },
];

// Problèmes détectés (affiché pendant la démo)
export const DEMO_PROBLEMES = [
  { gravite: "haute", texte: "47 mots-clés non qualifiés actifs (\"plombier emploi\", \"formation plomberie\", \"plombier salaire\"…)" },
  { gravite: "haute", texte: "Aucune extension d'appel configurée — les prospects ne peuvent pas appeler en 1 clic" },
  { gravite: "haute", texte: "Annonces identiques jour et nuit — les urgences nocturnes coûtent 3× plus sans ajustement" },
  { gravite: "moyenne", texte: "Zone géographique trop large — vous payez des clics hors Nice (Toulon, Marseille)" },
  { gravite: "moyenne", texte: "Pas de suivi des conversions — Google optimise sans savoir ce qui génère des appels" },
  { gravite: "basse", texte: "Quality Score moyen 4/10 — vos annonces ne sont pas assez pertinentes pour les mots-clés" },
];

// Actions réalisées par Stratyx (affiché après la démo)
export const DEMO_ACTIONS = [
  "Suppression de 47 mots-clés non qualifiés",
  "Extension d'appel activée sur toutes les annonces",
  "Campagne urgence séparée avec enchères majorées la nuit et le week-end",
  "Zone géographique affinée : Nice + 20 km uniquement",
  "Suivi des appels installé (Google Call Extensions + tag conversion)",
  "Nouvelles annonces avec score de qualité 8/10",
];

// ---------------------------------------------------------------------------
// Compte INTERNE — D2B Rénovation (dev / templates)
// ---------------------------------------------------------------------------

export const MOCK_ACCOUNT: AdsAccount = {
  customerId: "1858385399",
  descriptiveName: "D2B Rénovation Ads (démo)",
  currencyCode: "EUR",
  timeZone: "Europe/Paris",
};

export const MOCK_CAMPAIGNS: Campaign[] = [
  { id: "201", name: "Search · Rénovation salle de bain", status: "ENABLED", channel: "SEARCH", dailyBudget: 45 },
  { id: "202", name: "Search · Marque (brand)", status: "ENABLED", channel: "SEARCH", dailyBudget: 15 },
  { id: "203", name: "PMax · Toutes prestations", status: "ENABLED", channel: "PERFORMANCE_MAX", dailyBudget: 80 },
  { id: "204", name: "Display · Remarketing", status: "PAUSED", channel: "DISPLAY", dailyBudget: 20 },
  { id: "205", name: "Search · Isolation combles", status: "ENABLED", channel: "SEARCH", dailyBudget: 30 },
];

export const MOCK_METRICS: CampaignMetrics[] = [
  { campaignId: "201", campaignName: "Search · Rénovation salle de bain", impressions: 48210, clicks: 1620, cost: 1310.42, conversions: 38, conversionsValue: 41800 },
  { campaignId: "202", campaignName: "Search · Marque (brand)", impressions: 9120, clicks: 890, cost: 268.15, conversions: 41, conversionsValue: 52300 },
  { campaignId: "203", campaignName: "PMax · Toutes prestations", impressions: 132400, clicks: 2980, cost: 2240.90, conversions: 52, conversionsValue: 61250 },
  { campaignId: "204", campaignName: "Display · Remarketing", impressions: 88010, clicks: 410, cost: 190.33, conversions: 3, conversionsValue: 2400 },
  { campaignId: "205", campaignName: "Search · Isolation combles", impressions: 21540, clicks: 720, cost: 690.77, conversions: 11, conversionsValue: 13750 },
];