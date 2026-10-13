// Budget Optimizer : rythme de dépense du mois, projection et budget/jour conseillé.
import { getSetting } from "@/lib/agent/store";
import type { CampaignLite, DayRow } from "./data";

export const budgetKey = (customerId: string, month: string) => `budget_target:${customerId}:${month}`;

export async function readTargets(customerId: string, month: string): Promise<Record<string, number>> {
  try {
    const raw = await getSetting(budgetKey(customerId, month));
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface MonthFrame {
  month: string; // AAAA-MM
  first: string;
  last: string;
  yesterday: string;
  daysInMonth: number;
  elapsed: number; // jours complets écoulés (jusqu'à hier)
  remaining: number; // jours restants, aujourd'hui compris
  rateSince: string; // début de la fenêtre « rythme récent » (7 jours)
}

export function monthFrame(now = new Date()): MonthFrame {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(y, m + 1, 0));
  const yesterday = new Date(Date.UTC(y, m, now.getUTCDate() - 1));
  const daysInMonth = last.getUTCDate();
  const elapsed = now.getUTCDate() - 1;
  const rateSince = new Date(yesterday);
  rateSince.setUTCDate(rateSince.getUTCDate() - 6);
  return {
    month: `${y}-${String(m + 1).padStart(2, "0")}`,
    first: iso(first), last: iso(last), yesterday: iso(yesterday),
    daysInMonth, elapsed, remaining: daysInMonth - elapsed, rateSince: iso(rateSince),
  };
}

export interface CampaignPace {
  id: string;
  name: string;
  status: string;
  dailyBudget: number;
  spent: number; // ce mois
  rate: number; // €/jour sur 7 jours
  projected: number; // fin de mois au rythme actuel
  target: number | null; // budget du mois saisi
  perDay: number | null; // budget/jour à mettre pour tenir la cible
}

export function pace(campaigns: CampaignLite[], rows: DayRow[], f: MonthFrame, targets: Record<string, number>) {
  const byCamp = new Map<string, DayRow[]>();
  for (const r of rows) byCamp.set(r.campaignId, [...(byCamp.get(r.campaignId) ?? []), r]);
  const list: CampaignPace[] = campaigns
    .filter((c) => c.status === "ENABLED" || (byCamp.get(c.id) ?? []).some((r) => r.date >= f.first && r.cost > 0))
    .map((c) => {
      const rs = byCamp.get(c.id) ?? [];
      const spent = rs.filter((r) => r.date >= f.first && r.date <= f.yesterday).reduce((s, r) => s + r.cost, 0);
      const recent = rs.filter((r) => r.date >= f.rateSince && r.date <= f.yesterday);
      const rate = c.status === "ENABLED" ? recent.reduce((s, r) => s + r.cost, 0) / 7 : 0;
      const projected = spent + rate * f.remaining;
      const target = targets[c.id] ?? null;
      return {
        id: c.id, name: c.name, status: c.status, dailyBudget: c.dailyBudget, spent, rate, projected, target,
        perDay: target !== null && f.remaining > 0 ? Math.max(0, (target - spent) / f.remaining) : null,
      };
    })
    .sort((a, b) => b.spent - a.spent);
  const spent = list.reduce((s, c) => s + c.spent, 0);
  const projected = list.reduce((s, c) => s + c.projected, 0);
  const activeBudgets = campaigns.filter((c) => c.status === "ENABLED").reduce((s, c) => s + c.dailyBudget, 0);
  const derived = Math.round(activeBudgets * f.daysInMonth * 100) / 100;
  const target = targets.total ?? derived;
  // cumul jour par jour
  const days: { date: string; cum: number }[] = [];
  let cum = 0;
  for (let d = 1; d <= f.elapsed; d++) {
    const date = `${f.month}-${String(d).padStart(2, "0")}`;
    cum += rows.filter((r) => r.date === date).reduce((s, r) => s + r.cost, 0);
    days.push({ date, cum });
  }
  return { list, spent, projected, target, targetIsDerived: targets.total === undefined, derived, rate: list.reduce((s, c) => s + c.rate, 0), days };
}
