// Définition des offres et de leurs limites.
//
// - starter : le client a déjà Claude Pro/Max → il utilise le connecteur MCP
//   dans SON Claude (coût IA quasi nul pour nous). Petit quota IA in-app.
// - pro : tout passe par l'app (Copilote + Agents sur notre clé API) → quota
//   IA plus large, provisionné dans le prix.
//
// Le quota mensuel (USD) plafonne le coût API Anthropic par workspace ; il se
// réinitialise le 1er du mois (voir lib/agent/cost.ts).

export type PlanId = "starter" | "pro";

export interface PlanLimits {
  label: string;
  priceEur: number;
  maxAgents: number; // nombre max d'agents créés par workspace
  monthlyBudgetUsd: number; // plafond de coût API Anthropic / mois / workspace
}

export const PLANS: Record<PlanId, PlanLimits> = {
  starter: { label: "Starter", priceEur: 49, maxAgents: 3, monthlyBudgetUsd: 5 },
  pro: { label: "Pro", priceEur: 97, maxAgents: 10, monthlyBudgetUsd: 25 },
};

/** Limites du plan, avec repli sur Pro (valeur historique en base : "pro"). */
export function planLimits(plan: string | null | undefined): PlanLimits {
  return PLANS[plan as PlanId] ?? PLANS.pro;
}

// ---- Crédits ----
// Face client, le quota est exprimé en "crédits" (plus parlant qu'un montant
// API en dollars). 1 crédit = 0,05 $ de coût API Anthropic.
// Starter 5 $ → 100 crédits/mois · Pro 25 $ → 500 crédits/mois.
export const USD_PER_CREDIT = 0.05;

export function usdToCredits(usd: number): number {
  return Math.round(usd / USD_PER_CREDIT);
}

/** Crédits mensuels inclus dans un plan. */
export function planCredits(plan: string | null | undefined): number {
  return usdToCredits(planLimits(plan).monthlyBudgetUsd);
}
