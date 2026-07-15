// Cœur du protocole MCP côté serveur : un dispatch JSON-RPC 2.0.
// On implémente le minimum utile pour Claude : initialize, tools/list, tools/call,
// ping, et l'accusé notifications/initialized. Transport = "Streamable HTTP"
// (POST JSON) ; on répond en application/json, ce que le client Claude accepte.
import { MCP_TOOLS, callTool } from "./tools";
import type { WorkspaceContext } from "./auth";

const SERVER_INFO = { name: "ads-stratyx", version: "0.1.0" };
const DEFAULT_PROTOCOL = "2025-06-18";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}
function err(
  id: string | number | null,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/**
 * Traite un message JSON-RPC. Renvoie une réponse, ou null pour une notification
 * (message sans `id` — le protocole n'attend alors aucune réponse).
 */
export async function handleRpc(
  msg: JsonRpcRequest,
  ws: WorkspaceContext,
): Promise<JsonRpcResponse | null> {
  const id = msg.id ?? null;

  switch (msg.method) {
    case "initialize": {
      const requested = (msg.params?.protocolVersion as string) ?? DEFAULT_PROTOCOL;
      return ok(id, {
        protocolVersion: requested,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Serveur ads-stratyx : pilotage Google Ads. Commence par " +
          "list_ads_accounts, puis list_campaigns et get_campaign_performance.",
      });
    }

    // Notifications (pas d'id, pas de réponse attendue).
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, { tools: MCP_TOOLS });

    case "tools/call": {
      const name = msg.params?.name as string;
      const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
      if (!name) return err(id, -32602, "Paramètre 'name' manquant");
      try {
        const { text } = await callTool(name, args, ws);
        return ok(id, { content: [{ type: "text", text }], isError: false });
      } catch (e) {
        // Erreur d'exécution d'outil : on la renvoie DANS le résultat (isError)
        // pour que Claude la voie, plutôt qu'en erreur de protocole.
        const message = e instanceof Error ? e.message : String(e);
        return ok(id, {
          content: [{ type: "text", text: `Erreur : ${message}` }],
          isError: true,
        });
      }
    }

    default:
      return err(id, -32601, `Méthode non supportée : ${msg.method}`);
  }
}
