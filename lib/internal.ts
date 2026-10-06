// Mode "usage interne" : Stratyx tourne pour l'activité de l'owner uniquement,
// avant toute commercialisation.
//
//   STRATYX_INTERNAL_MODE=true     → inscriptions fermées, seuls l'owner (et
//                                     STRATYX_ALLOWED_EMAILS) consomment de l'IA.
//   OWNER_MONTHLY_BUDGET_EUR=5     → plafond de coût API Anthropic de l'owner, en euros
//                                     (ou OWNER_MONTHLY_BUDGET_USD ; défaut 5 $). "0" = IA coupée.
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

/**
 * Plafond mensuel du coût IA de l'owner, converti en USD (Anthropic facture en dollars).
 * On lit en priorité OWNER_MONTHLY_BUDGET_EUR (converti avec EUR_TO_USD, 1,15 par
 * défaut), sinon OWNER_MONTHLY_BUDGET_USD, sinon 5 $.
 */
export function ownerMonthlyBudgetUsd(): number {
  const parse = (raw: string | undefined) => {
    if (raw === undefined || raw.trim() === "") return null;
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const eur = parse(process.env.OWNER_MONTHLY_BUDGET_EUR);
  if (eur !== null) {
    const rate = parse(process.env.EUR_TO_USD) ?? 1.15;
    return Math.round(eur * rate * 100) / 100;
  }
  return parse(process.env.OWNER_MONTHLY_BUDGET_USD) ?? 5;
}
