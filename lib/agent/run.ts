// Exécution d'une tâche de l'Agent IA (autonome, lecture seule par défaut).
// La logique de boucle "tool use" vit dans loop.ts (partagée avec le Copilote).
import { runAgentLoop } from "./loop";
import { DEFAULT_SYSTEM } from "./missions";
import type { TokenUsage } from "./cost";
import type { AgentTask } from "./store";

export interface AgentResult {
  taskId: string;
  taskName: string;
  summary: string;
  steps: number;
  toolCalls: string[];
  usage: TokenUsage;
}

/** Exécute une tâche (venue de la base ou du repli codé en dur). */
export async function runTask(task: {
  id: string;
  name: string;
  prompt: string;
  allow_write?: boolean;
  model?: string;
}, customerId?: string): Promise<AgentResult> {
  const r = await runAgentLoop([{ role: "user", content: task.prompt }], {
    system: DEFAULT_SYSTEM,
    allowWrite: task.allow_write ?? false,
    model: task.model,
    customerId,
  });
  return {
    taskId: task.id,
    taskName: task.name,
    summary: r.finalText,
    steps: r.steps,
    toolCalls: r.toolCalls,
    usage: r.usage,
  };
}

export type { AgentTask };
