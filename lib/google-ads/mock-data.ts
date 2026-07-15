// Données factices réalistes pour développer sans accès Google Ads API.
// Compte inspiré de l'exemple vu : "D2B Rénovation Ads" (secteur rénovation).
import type { AdsAccount, Campaign, CampaignMetrics } from "./types";

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

// Métriques sur 30 jours, cohérentes avec les budgets ci-dessus.
export const MOCK_METRICS: CampaignMetrics[] = [
  { campaignId: "201", campaignName: "Search · Rénovation salle de bain", impressions: 48210, clicks: 1620, cost: 1310.42, conversions: 38, conversionsValue: 41800 },
  { campaignId: "202", campaignName: "Search · Marque (brand)", impressions: 9120, clicks: 890, cost: 268.15, conversions: 41, conversionsValue: 52300 },
  { campaignId: "203", campaignName: "PMax · Toutes prestations", impressions: 132400, clicks: 2980, cost: 2240.9, conversions: 52, conversionsValue: 61250 },
  { campaignId: "204", campaignName: "Display · Remarketing", impressions: 88010, clicks: 410, cost: 190.33, conversions: 3, conversionsValue: 2400 },
  { campaignId: "205", campaignName: "Search · Isolation combles", impressions: 21540, clicks: 720, cost: 690.77, conversions: 11, conversionsValue: 13750 },
];
