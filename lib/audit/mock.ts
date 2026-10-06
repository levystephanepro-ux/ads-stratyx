// Scénario factice (mode mock) : plombier niçois, avec un exemple de chaque type
// de constat pour tester l'écran sans compte Google Ads.
import { MOCK_SEARCH_TERMS } from "@/lib/google-ads/mock-data";
import type { AuditData } from "./types";

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
};

export const MOCK_AUDIT_DATA: AuditData = {
  searchTerms: MOCK_SEARCH_TERMS,
  keywords: [
    { campaign: "Search - Plombier Nice", campaignId: "1001", adGroup: "Urgence", adGroupId: "11", text: "plombier urgence nice", matchType: "PHRASE", qualityScore: 7, cost: 307, clicks: 96, impressions: 1180, conversions: 9 },
    { campaign: "Search - Plombier Nice", campaignId: "1001", adGroup: "Urgence", adGroupId: "11", text: "plombier saint laurent du var", matchType: "EXACT", qualityScore: null, cost: 0, clicks: 0, impressions: 0, conversions: 0 },
    { campaign: "Search - Plombier Nice", campaignId: "1001", adGroup: "Dépannage", adGroupId: "12", text: "débouchage canalisation", matchType: "PHRASE", qualityScore: 3, cost: 96, clicks: 31, impressions: 412, conversions: 0 },
    { campaign: "Search - Chauffe-eau", campaignId: "1002", adGroup: "Thermodynamique", adGroupId: "21", text: "chauffe eau thermodynamique", matchType: "PHRASE", qualityScore: 5, cost: 497, clicks: 180, impressions: 2950, conversions: 2 },
  ],
  negatives: [
    { level: "campaign", campaignId: "1001", campaign: "Search - Plombier Nice", text: "saint laurent", matchType: "PHRASE" },
    { level: "shared", campaignId: "1001", campaign: "Search - Plombier Nice", sharedSet: "Exclusions générales", text: "débouchage canalisation", matchType: "BROAD" },
    { level: "campaign", campaignId: "1002", campaign: "Search - Chauffe-eau", text: "gratuit", matchType: "PHRASE" },
  ],
  campaigns: [
    { id: "1001", name: "Search - Plombier Nice", channel: "SEARCH", dailyBudget: 40, cost: 1196, clicks: 435, conversions: 26, impressionShare: 0.62, lostBudget: 0.24, lostRank: 0.14 },
    { id: "1002", name: "Search - Chauffe-eau", channel: "SEARCH", dailyBudget: 25, cost: 585, clicks: 180, conversions: 2, impressionShare: 0.45, lostBudget: 0.05, lostRank: 0.5 },
  ],
  policy: [
    { kind: "extension", campaign: null, label: "06 12 34 56 78", status: "DISAPPROVED", reasons: ["UNVERIFIED_PHONE_NUMBER"] },
  ],
  daily: Array.from({ length: 30 }, (_, i) => ({
    date: day(30 - i),
    clicks: 20,
    conversions: i < 23 && i % 3 === 0 ? 1 : 0,
    cost: 59,
  })),
  conversionActions: 2,
};
