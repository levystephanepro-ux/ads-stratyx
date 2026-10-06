// Détection des négatifs qui bloquent des mots-clés actifs.
// Règles de correspondance des négatifs Google Ads (pas de variantes proches) :
//   [exact]     → bloque si la requête est exactement le négatif
//   "expression" → bloque si la requête contient les mots dans cet ordre
//   requête large → bloque si la requête contient tous les mots (ordre libre)
// On teste le TEXTE du mot-clé comme requête type : si ce texte est bloqué, le
// mot-clé ne peut pas (ou presque pas) diffuser.
import type { AuditData, Constat } from "./types";

export function normKw(s: string): string {
  return s
    .toLowerCase()
    .replace(/^[\["+]+|[\]"]+$/g, "")
    .replace(/\+/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function negativeBlocks(neg: string, negMatch: string, query: string): boolean {
  const n = normKw(neg);
  const q = normKw(query);
  if (!n || !q) return false;
  if (negMatch === "EXACT") return n === q;
  if (negMatch === "PHRASE") return ` ${q} `.includes(` ${n} `);
  const qWords = new Set(q.split(" "));
  return n.split(" ").every((w) => qWords.has(w));
}

const fmtNeg = (text: string, m: string) =>
  m === "EXACT" ? `[${text}]` : m === "PHRASE" ? `"${text}"` : text;

export function negativeConflicts(data: AuditData): Constat[] {
  const out: Constat[] = [];
  const seen = new Set<string>();
  for (const kw of data.keywords) {
    const applicable = data.negatives.filter((n) =>
      n.level === "ad_group" ? n.adGroupId === kw.adGroupId : n.campaignId === kw.campaignId,
    );
    for (const neg of applicable) {
      if (!negativeBlocks(neg.text, neg.matchType, kw.text)) continue;
      const id = `conflit:${kw.campaignId}:${kw.adGroupId}:${normKw(kw.text)}:${normKw(neg.text)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const where =
        neg.level === "shared"
          ? `la liste partagée « ${neg.sharedSet ?? "?"} »`
          : neg.level === "ad_group"
            ? `le groupe « ${kw.adGroup} »`
            : `la campagne`;
      const same = normKw(neg.text) === normKw(kw.text);
      out.push({
        id,
        category: "conflits",
        // bloque des recherches voulues sans coûter d'argent : important, pas critique
        severity: "important",
        title: same
          ? `Le mot-clé « ${kw.text} » est aussi en négatif`
          : `Le négatif ${fmtNeg(neg.text, neg.matchType)} bloque le mot-clé « ${kw.text} »`,
        detail:
          `Négatif ${fmtNeg(neg.text, neg.matchType)} dans ${where}, mot-clé ${fmtNeg(kw.text, kw.matchType)} ` +
          `dans « ${kw.adGroup} ». ${kw.impressions} impression(s) en 30 jours.`,
        campaign: kw.campaign,
        amount: null,
        fix:
          neg.level !== "shared" && neg.resourceName
            ? {
                type: "remove_negative",
                resourceName: neg.resourceName,
                level: neg.level,
                parentId: neg.level === "ad_group" ? (neg.adGroupId ?? "") : neg.campaignId,
                text: neg.text,
                matchType: neg.matchType,
                where: neg.level === "ad_group" ? `du groupe « ${kw.adGroup} »` : `de la campagne « ${kw.campaign} »`,
              }
            : undefined,
        action: same
          ? "Garde l'un des deux : retire le négatif si ce mot-clé doit diffuser, sinon mets le mot-clé en pause."
          : "Retire ou resserre ce négatif (en exact par exemple) pour laisser diffuser le mot-clé.",
      });
    }
  }
  return out;
}
