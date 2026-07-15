// Endpoint MCP appelé par Claude Desktop / Claude (connecteur personnalisé).
// URL à coller dans Claude, ex. :
//   http://localhost:3000/api/mcp?token=<ton_token_mcp>
//
// Transport "Streamable HTTP" : Claude envoie du JSON-RPC en POST. On répond en
// application/json. GET renvoie un petit statut (pratique pour tester au navigateur).
import { NextResponse, type NextRequest } from "next/server";
import { extractToken, resolveWorkspace } from "@/lib/mcp/auth";
import { handleRpc } from "@/lib/mcp/server";

// Ces appels ne doivent pas être mis en cache ni pré-rendus.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ws = await resolveWorkspace(extractToken(req));
  return NextResponse.json({
    server: "ads-stratyx",
    transport: "streamable-http (POST JSON-RPC)",
    authenticated: !!ws && !ws.demo,
    demo: ws?.demo ?? false,
    hint: "Colle cette URL (avec ?token=...) comme connecteur MCP dans Claude.",
  });
}

export async function POST(req: NextRequest) {
  const ws = await resolveWorkspace(extractToken(req));
  if (!ws) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Token MCP invalide" } },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalide" } },
      { status: 400 },
    );
  }

  // JSON-RPC autorise un message unique ou un lot (array).
  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const m of messages) {
    const res = await handleRpc(m, ws);
    if (res) responses.push(res); // on ignore les notifications (res === null)
  }

  // Que des notifications → 202 sans corps.
  if (responses.length === 0) return new NextResponse(null, { status: 202 });

  const payload = Array.isArray(body) ? responses : responses[0];
  return NextResponse.json(payload);
}
