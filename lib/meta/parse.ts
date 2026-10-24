// Lecture des chiffres Meta : fonctions pures, sans import (testables avec node --test).

export type MetaAction = { action_type: string; value: string };

/** Une ligne de la réponse GET /act_{id}/insights (les nombres arrivent en texte). */
export type MetaInsightRow = {
  account_name?: string;
  account_currency?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: MetaAction[];
};

export type MetaAccountInsights = {
  accountId: string;
  accountName: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  /** spend / leads, ou null si aucun lead. */
  cpl: number | null;
};

/** Résultat du rapport : les comptes lus, et ceux qui ont échoué (jamais d'exception). */
export type MetaInsightsResult = { accounts: MetaAccountInsights[]; failed: string[] };

// Types d'action Meta comptés comme « lead ».
// Choix anti double comptage : `lead` regroupe en pratique les leads des formulaires
// Meta (`onsite_conversion.lead_grouped`) et ceux du pixel (`offsite_conversion.fb_pixel_lead`).
// Les additionner compterait deux fois le même lead. On retient donc le type le plus élevé
// présent pour la ligne, jamais la somme. Au pire on sous-compte un peu (formulaire + pixel
// sur des leads différents sans type `lead` agrégé), on ne gonfle jamais le nombre de leads.
const LEAD_ACTION_TYPES: ReadonlySet<string> = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
]);

export function countLeads(actions: readonly MetaAction[] | undefined): number {
  let best = 0;
  for (const a of actions ?? []) {
    if (!LEAD_ACTION_TYPES.has(a.action_type)) continue;
    const n = Number(a.value);
    if (Number.isFinite(n) && n > best) best = n;
  }
  return best;
}

const num = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Résume les lignes d'un compte. Avec level=account l'API renvoie une seule ligne,
 * ou aucune si le compte n'a rien dépensé sur la période : ce n'est pas une erreur.
 */
export function summarizeRows(accountId: string, rows: readonly MetaInsightRow[]): MetaAccountInsights {
  let spend = 0, impressions = 0, clicks = 0, leads = 0;
  for (const r of rows) {
    spend += num(r.spend);
    impressions += num(r.impressions);
    clicks += num(r.clicks);
    leads += countLeads(r.actions);
  }
  return {
    accountId,
    accountName: rows.find((r) => r.account_name)?.account_name ?? null,
    spend, impressions, clicks, leads,
    cpl: leads > 0 ? spend / leads : null,
  };
}
