// Moteur d'agent partagé : une boucle "tool use" réutilisable par l'Agent IA
// (missions autonomes) ET le Copilote (chat interactif).
//
// On donne à Claude l'accès aux mêmes outils que le serveur MCP. Claude raisonne,
// appelle les outils lui-même, et on continue jusqu'à ce qu'il rende sa réponse.
import Anthropic from "@anthropic-ai/sdk";
import { MCP_TOOLS, callTool } from "@/lib/mcp/tools";
import { resolveWorkspace } from "@/lib/mcp/auth";
import { calcCost, type TokenUsage } from "./cost";

// Modèle par défaut : Haiku 4.5 (rapide + économique). Configurable via env.
export const DEFAULT_MODEL =
  process.env.AGENT_MODEL ?? "claude-haiku-4-5-20251001";

// Garde-fou : nombre max d'allers-retours modèle (évite une boucle infinie).
const MAX_STEPS = 12;

// Outils en écriture : exclus par défaut (agent autonome = lecture seule).
const WRITE_TOOLS = new Set(["set_campaign_status", "update_campaign_budget"]);

export function buildTools(allowWrite: boolean): Array<{
  name: string;
  description: string;
  input_schema: Anthropic.Tool.InputSchema;
}> {
  return MCP_TOOLS.filter((t) => allowWrite || !WRITE_TOOLS.has(t.name)).map(
    (t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }),
  );
}

export interface LoopOptions {
  system: string;
  allowWrite?: boolean;
  model?: string;
  maxTokens?: number;
  customerId?: string;
}

export interface LoopResult {
  finalText: string;
  messages: Anthropic.MessageParam[];
  toolCalls: string[];
  steps: number;
  usage: TokenUsage;
}

export async function runAgentLoop(
  inputMessages: Anthropic.MessageParam[],
  opts: LoopOptions,
): Promise<LoopResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY manquante. Ajoute-la dans les variables d'environnement Vercel.",
    );
  }

  // Même contexte que le serveur MCP : le compte Google Ads défini en env.
  let ws = await resolveWorkspace(process.env.MCP_SHARED_TOKEN ?? null);
  if (!ws) {
    throw new Error(
      "Workspace introuvable. Vérifie ADS_DATA_MODE=live et la connexion Google Ads.",
    );
  }

  // Si un compte spécifique est demandé, restreindre le workspace à ce seul compte.
  if (opts.customerId && ws.connections.length > 1) {
    const match = ws.connections.filter((c) => c.customerId === opts.customerId);
    if (match.length > 0) ws = { ...ws, connections: match };
  }

  const client = new Anthropic({ apiKey });
  const model = opts.model ?? DEFAULT_MODEL;
  const tools = buildTools(opts.allowWrite ?? false);
  const messages: Anthropic.MessageParam[] = [...inputMessages];
  const toolCalls: string[] = [];
  let steps = 0;
  let totalInput = 0;
  let totalOutput = 0;

  while (steps < MAX_STEPS) {
    steps++;
    const res = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 2048,
      system: opts.system,
      messages,
      tools,
    });

    totalInput += res.usage.input_tokens;
    totalOutput += res.usage.output_tokens;
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      const finalText = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return {
        finalText: finalText || "(aucun texte renvoyé)",
        messages,
        toolCalls,
        steps,
        usage: calcCost(model, totalInput, totalOutput),
      };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      toolCalls.push(block.name);
      try {
        const { text } = await callTool(
          block.name,
          (block.input ?? {}) as Record<string, unknown>,
          ws,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: text,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Erreur : ${msg}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    finalText:
      "⚠️ Limite d'étapes atteinte sans conclure. Simplifie la demande ou " +
      "restreins la période analysée.",
    messages,
    toolCalls,
    steps,
    usage: calcCost(model, totalInput, totalOutput),
  };
}
