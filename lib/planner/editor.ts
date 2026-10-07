// Export CSV pour Google Ads Editor (Compte > Importer > Depuis un fichier).
// Le format est celui des colonnes d'export d'Editor en français/anglais selon la langue du
// logiciel : si une colonne n'est pas reconnue, Editor l'indique à l'import sans rien casser.
import type { CampaignSpec } from "./create";
import { DAY_FR } from "./create";

const COLS = [
  "Campaign", "Budget", "Budget type", "Campaign Type", "Networks", "Languages", "Bid Strategy Type", "Ad Schedule", "Campaign Status",
  "Location", "Ad Group", "Max CPC", "Ad Group Status", "Keyword", "Criterion Type", "Status",
  "Ad type", ...Array.from({ length: 15 }, (_, i) => `Headline ${i + 1}`), ...Array.from({ length: 4 }, (_, i) => `Description ${i + 1}`),
  "Path 1", "Path 2", "Final URL", "Link Text", "Description Line 1", "Description Line 2", "Callout text", "Phone Number", "Country code",
] as const;
type Row = Partial<Record<(typeof COLS)[number], string | number>>;

const esc = (v: string | number | undefined) => {
  const t = v === undefined ? "" : String(v);
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const num = (n: number) => String(n).replace(".", ",");
const BID = { MAXIMIZE_CLICKS: "Maximize clicks", MAXIMIZE_CONVERSIONS: "Maximize conversions", MANUAL_CPC: "Manual CPC" } as const;
const MATCH = { PHRASE: "Phrase", EXACT: "Exact", BROAD: "Broad" } as const;
const LANG: Record<string, string> = { "1002": "fr", "1000": "en", "1003": "es", "1001": "de", "1004": "it" };

export function toEditorCsv(s: CampaignSpec): string {
  const camp = s.name;
  const rows: Row[] = [];
  const x = s.extensions;
  rows.push({
    Campaign: camp, Budget: num(s.dailyBudget), "Budget type": "Daily", "Campaign Type": "Search", Networks: "Google search",
    Languages: LANG[s.languageId ?? "1002"] ?? "fr", "Bid Strategy Type": BID[s.bidding], "Campaign Status": "Paused",
  });
  (s.geoNames ?? []).forEach((l) => rows.push({ Campaign: camp, Location: l }));
  if (x?.schedule) {
    for (const d of x.schedule.days) rows.push({ Campaign: camp, "Ad Schedule": `${DAY_FR[d]}[${String(x.schedule.startHour).padStart(2, "0")}:00 - ${String(x.schedule.endHour).padStart(2, "0")}:00]` });
  }
  s.negatives.forEach((k) => rows.push({ Campaign: camp, Keyword: k, "Criterion Type": "Negative Phrase" }));
  (x?.sitelinks ?? []).forEach((l) => rows.push({ Campaign: camp, "Link Text": l.text, "Description Line 1": l.desc1, "Description Line 2": l.desc2, "Final URL": l.url }));
  (x?.callouts ?? []).forEach((t) => rows.push({ Campaign: camp, "Callout text": t }));
  if (x?.phone) rows.push({ Campaign: camp, "Phone Number": x.phone, "Country code": "FR" });
  s.groups.forEach((g, i) => {
    const ag = g.name.trim() || `Groupe ${i + 1}`;
    rows.push({ Campaign: camp, "Ad Group": ag, "Ad Group Status": "Enabled", ...(s.bidding === "MANUAL_CPC" && s.maxCpc ? { "Max CPC": num(s.maxCpc) } : {}) });
    g.keywords.forEach((k) => rows.push({ Campaign: camp, "Ad Group": ag, Keyword: k, "Criterion Type": MATCH[s.matchType], Status: "Enabled" }));
    const ad: Row = { Campaign: camp, "Ad Group": ag, "Ad type": "Responsive search ad", "Final URL": s.finalUrl, Status: "Enabled", "Path 1": g.path1 ?? "", "Path 2": g.path2 ?? "" };
    g.headlines.forEach((h, j) => { (ad as Record<string, string>)[`Headline ${j + 1}`] = h; });
    g.descriptions.forEach((d, j) => { (ad as Record<string, string>)[`Description ${j + 1}`] = d; });
    rows.push(ad);
  });
  const lines = [COLS.map(esc).join(","), ...rows.map((r) => COLS.map((c) => esc(r[c])).join(","))];
  return "﻿" + lines.join("\r\n");
}
