// Journal des modifications (change_event) traduit en phrases pour un client.
// Limite Google : seuls les 30 derniers jours sont disponibles.
import { searchRaw, type AdsContext, type RawRow } from "@/lib/google-ads/client";

export interface ChangeLine {
  date: string;      // YYYY-MM-DD
  time: string;      // HH:MM
  campaign: string;
  kind: string;      // famille, pour regrouper et filtrer
  text: string;      // phrase lisible
  detail: string[];  // éléments concernés (mots-clés, montants…)
  author: string;
  tool: string;
}

const TOOL: Record<string, string> = {
  GOOGLE_ADS_WEB_CLIENT: "Interface", GOOGLE_ADS_AUTOMATED_RULE: "Règle auto", GOOGLE_ADS_SCRIPTS: "Script",
  GOOGLE_ADS_BULK_UPLOAD: "Import", GOOGLE_ADS_API: "API", GOOGLE_ADS_EDITOR: "Editor",
  GOOGLE_ADS_MOBILE_APP: "Appli mobile", GOOGLE_ADS_RECOMMENDATIONS: "Recos Google",
  SEARCH_ADS_360_SYNC: "SA360", SEARCH_ADS_360_POST: "SA360", INTERNAL_TOOL: "Google", OTHER: "Autre",
};

const kwFmt = (k?: { text?: string; matchType?: string }) =>
  !k?.text ? "" : k.matchType === "EXACT" ? `[${k.text}]` : k.matchType === "PHRASE" ? `"${k.text}"` : k.text;
const eur = (micros: unknown) => `${(Number(micros ?? 0) / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
const STATUS: Record<string, string> = { ENABLED: "activé(e)", PAUSED: "mis(e) en pause", REMOVED: "supprimé(e)" };

function describe(r: RawRow): { kind: string; verb: string; item: string } {
  const e = r.changeEvent ?? {};
  const op = e.resourceChangeOperation as string;
  const n = e.newResource ?? {}; const o = e.oldResource ?? {};
  const fields = String(e.changedFields ?? "");
  switch (e.changeResourceType) {
    case "AD_GROUP_CRITERION": {
      const c = n.adGroupCriterion ?? o.adGroupCriterion ?? {};
      const neg = !!c.negative; const kw = kwFmt(c.keyword);
      if (op === "CREATE") return { kind: neg ? "negatifs" : "mots_cles", verb: neg ? "négatif(s) ajouté(s)" : "mot(s)-clé(s) ajouté(s)", item: kw };
      if (op === "REMOVE") return { kind: neg ? "negatifs" : "mots_cles", verb: neg ? "négatif(s) retiré(s)" : "mot(s)-clé(s) retiré(s)", item: kw };
      if (fields.includes("status")) return { kind: "mots_cles", verb: `mot(s)-clé(s) ${STATUS[n.adGroupCriterion?.status] ?? "modifié(s)"}`, item: kw };
      if (fields.includes("cpc_bid")) return { kind: "encheres", verb: "enchère(s) de mot-clé modifiée(s)", item: `${kw} : ${eur(o.adGroupCriterion?.cpcBidMicros)} → ${eur(n.adGroupCriterion?.cpcBidMicros)}` };
      return { kind: "mots_cles", verb: "mot(s)-clé(s) modifié(s)", item: kw };
    }
    case "CAMPAIGN_CRITERION": {
      const c = n.campaignCriterion ?? o.campaignCriterion ?? {};
      if (c.keyword) return { kind: "negatifs", verb: op === "REMOVE" ? "négatif(s) de campagne retiré(s)" : "négatif(s) de campagne ajouté(s)", item: kwFmt(c.keyword) };
      if (c.location || c.proximity) return { kind: "ciblage", verb: "zone(s) de ciblage modifiée(s)", item: "" };
      if (c.adSchedule) return { kind: "ciblage", verb: "horaires de diffusion modifiés", item: "" };
      if (c.device) return { kind: "ciblage", verb: "ajustement par appareil modifié", item: "" };
      return { kind: "ciblage", verb: "ciblage de campagne modifié", item: "" };
    }
    case "CAMPAIGN_BUDGET":
      return { kind: "budget", verb: "budget modifié", item: fields.includes("amount_micros") ? `${eur(o.campaignBudget?.amountMicros)} → ${eur(n.campaignBudget?.amountMicros)} par jour` : "" };
    case "CAMPAIGN":
      if (op === "CREATE") return { kind: "campagnes", verb: "campagne créée", item: "" };
      if (fields.includes("status")) return { kind: "campagnes", verb: `campagne ${STATUS[n.campaign?.status] ?? "modifiée"}`, item: "" };
      if (fields.includes("bidding") || fields.includes("target_cpa") || fields.includes("maximize")) return { kind: "encheres", verb: "stratégie d'enchères modifiée", item: "" };
      return { kind: "campagnes", verb: "réglages de campagne modifiés", item: fields.split(",").slice(0, 3).join(", ") };
    case "AD_GROUP":
      return { kind: "structure", verb: op === "CREATE" ? "groupe d'annonces créé" : fields.includes("status") ? `groupe d'annonces ${STATUS[n.adGroup?.status] ?? "modifié"}` : "groupe d'annonces modifié", item: n.adGroup?.name ?? "" };
    case "AD_GROUP_AD":
    case "AD":
      return { kind: "annonces", verb: op === "CREATE" ? "annonce(s) créée(s)" : fields.includes("status") ? `annonce(s) ${STATUS[n.adGroupAd?.status] ?? "modifiée(s)"}` : "annonce(s) modifiée(s)", item: "" };
    case "ASSET": case "CAMPAIGN_ASSET": case "AD_GROUP_ASSET": case "CUSTOMER_ASSET": case "ASSET_SET": case "ASSET_SET_ASSET":
      return { kind: "extensions", verb: op === "CREATE" ? "extension(s) ajoutée(s)" : op === "REMOVE" ? "extension(s) retirée(s)" : "extension(s) modifiée(s)", item: "" };
    default:
      return { kind: "autres", verb: `${String(e.changeResourceType ?? "élément").toLowerCase().replace(/_/g, " ")} ${op === "CREATE" ? "créé" : op === "REMOVE" ? "supprimé" : "modifié"}`, item: "" };
  }
}

/** Lit le journal sur [since, until] (borné aux 30 derniers jours) et regroupe par jour + type + campagne. */
export async function readChanges(ctx: AdsContext, since: string, until: string): Promise<{ lines: ChangeLine[]; clampedSince: string }> {
  const limit = new Date(); limit.setUTCDate(limit.getUTCDate() - 29);
  const minSince = limit.toISOString().slice(0, 10);
  const from = since < minSince ? minSince : since;
  if (from > until) return { lines: [], clampedSince: from };
  const rows = await searchRaw(ctx, `
    SELECT change_event.change_date_time, change_event.user_email, change_event.client_type,
           change_event.change_resource_type, change_event.resource_change_operation, change_event.changed_fields,
           change_event.old_resource, change_event.new_resource, campaign.name
    FROM change_event
    WHERE change_event.change_date_time >= '${from}' AND change_event.change_date_time <= '${until} 23:59:59'
    ORDER BY change_event.change_date_time DESC LIMIT 2000`);

  const groups = new Map<string, ChangeLine>();
  for (const r of rows) {
    const dt = String(r.changeEvent?.changeDateTime ?? "");
    const date = dt.slice(0, 10); const time = dt.slice(11, 16);
    const d = describe(r);
    const campaign = r.campaign?.name ?? "";
    const key = `${date}|${d.verb}|${campaign}`;
    const g: ChangeLine = groups.get(key) ?? {
      date, time, campaign, kind: d.kind, text: d.verb, detail: [],
      author: r.changeEvent?.userEmail ?? "", tool: TOOL[r.changeEvent?.clientType] ?? r.changeEvent?.clientType ?? "",
    };
    if (d.item && !g.detail.includes(d.item)) g.detail.push(d.item);
    g.time = g.time > time ? g.time : time;
    groups.set(key, g);
  }
  const lines = [...groups.values()].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  // nombre d'éléments dans la phrase : « 2 négatifs ajoutés »
  lines.forEach((l) => {
    const count = Math.max(1, l.detail.length);
    l.text = `${count > 1 ? `${count} ` : ""}${l.text.replace(/\(s\)/g, count > 1 ? "s" : "").replace(/\(e\)/g, l.kind === "mots_cles" || l.kind === "structure" ? "" : "e")}${l.campaign ? ` dans « ${l.campaign} »` : ""}`;
  });
  return { lines, clampedSince: from };
}

export const CHANGE_KINDS: Record<string, string> = {
  negatifs: "Négatifs", mots_cles: "Mots-clés", encheres: "Enchères", budget: "Budget", campagnes: "Campagnes",
  ciblage: "Ciblage", structure: "Structure", annonces: "Annonces", extensions: "Extensions", autres: "Autres",
};
