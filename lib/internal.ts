// Mode "usage interne" : Stratyx tourne pour l'activité de l'owner uniquement,
// avant toute commercialisation.
//
//   STRATYX_INTERNAL_MODE=true     → inscriptions fermées, seuls l'owner (et
//                                     STRATYX_ALLOWED_EMAILS) consomment de l'IA.
//   OWNER_MONTHLY_BUDGET_USD=5     → plafond de coût API Anthropic de l'owner
//                                     (défaut 5 $ = 100 crédits). "0" = IA coupée.
//
// Le Waste Detector, lui, ne consomme aucun crédit (calcul déterministe).

export const INTERNAL_MODE = process.env.STRATYX_INTERNAL_MODE === "true";

const ALLOWED = (process.env.STRATYX_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Email explicitement autorisé en plus de l'owner (mode interne). */
export function isAllowedEmail(email: string | null | undefined): boolean {
  return !!email && ALLOWED.includes(email.toLowerCase());
}

/** Plafond mensuel (USD) du coût IA de l'owner. */
export function ownerMonthlyBudgetUsd(): number {
  const raw = process.env.OWNER_MONTHLY_BUDGET_USD;
  if (raw === undefined || raw.trim() === "") return 5;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}
