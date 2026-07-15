// Types métier "propres" exposés au reste de l'app (UI + MCP).
// Volontairement découplés de la forme brute de l'API Google Ads : le client
// (mock ou live) est responsable de mapper vers ces types.

export interface AdsAccount {
  customerId: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
}

export type CampaignStatus = "ENABLED" | "PAUSED" | "REMOVED";

export type CampaignChannel =
  | "SEARCH"
  | "SHOPPING"
  | "PERFORMANCE_MAX"
  | "DISPLAY"
  | "VIDEO"
  | "DEMAND_GEN"
  | "LOCAL_SERVICES"
  | "OTHER";

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  channel: CampaignChannel;
  /** Budget quotidien en unités de devise (pas en micros). */
  dailyBudget: number;
}

export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  /** Coût en unités de devise. */
  cost: number;
  conversions: number;
  /** Valeur de conversion (CA remonté). */
  conversionsValue: number;
}

export interface DateRange {
  /** Format ISO YYYY-MM-DD. */
  since: string;
  until: string;
}
