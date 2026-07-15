// Calcul du coût Anthropic en $ à partir des tokens retournés par l'API.
// Prix au 1er juillet 2025 — à mettre à jour si Anthropic change la grille.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.80, output: 4.00 },  // $ / M tokens
  "claude-sonnet-5":           { input: 3.00, output: 15.00 },
  "claude-sonnet-4-6":         { input: 3.00, output: 15.00 },
};

const FALLBACK = { input: 0.80, output: 4.00 };

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export function calcCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): TokenUsage {
  const p = PRICING[model] ?? FALLBACK;
  const costUsd = (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
  return { inputTokens, outputTokens, costUsd };
}

/** Formate un montant en $0.0000 */
export function fmtCost(usd: number): string {
  if (usd < 0.0001) return "<$0.0001";
  return `$${usd.toFixed(4)}`;
}

/** Clé app_settings pour le mois courant, ex. "cost_2026_07" */
export function monthKey(date = new Date()): string {
  return `cost_${date.getUTCFullYear()}_${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Ajoute un coût au cumul mensuel dans app_settings (silencieux si Supabase absent). */
export async function addMonthlyCost(usd: number, source: "agent" | "copilote"): Promise<void> {
  try {
    const { getSetting, setSetting } = await import("./store");
    const key = monthKey();
    const sourceKey = `${key}_${source}`;
    const [total, bySource] = await Promise.all([getSetting(key), getSetting(sourceKey)]);
    await Promise.all([
      setSetting(key, String((parseFloat(total ?? "0") + usd).toFixed(6))),
      setSetting(sourceKey, String((parseFloat(bySource ?? "0") + usd).toFixed(6))),
    ]);
  } catch {
    // silencieux : le suivi de coût ne doit jamais bloquer l'app
  }
}

/** Lit le coût cumulé du mois + budget configuré. */
export async function getMonthlyUsage(): Promise<{
  spent: number;
  spentAgent: number;
  spentCopilote: number;
  budget: number | null;
  resetDate: Date;
}> {
  const { getSetting } = await import("./store");
  const key = monthKey();
  const now = new Date();
  const resetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [total, agent, copilote, budget] = await Promise.all([
    getSetting(key),
    getSetting(`${key}_agent`),
    getSetting(`${key}_copilote`),
    getSetting("budget_monthly_usd"),
  ]);
  return {
    spent: parseFloat(total ?? "0"),
    spentAgent: parseFloat(agent ?? "0"),
    spentCopilote: parseFloat(copilote ?? "0"),
    budget: budget ? parseFloat(budget) : null,
    resetDate,
  };
}
