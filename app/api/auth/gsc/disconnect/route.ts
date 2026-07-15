import { NextResponse } from "next/server";
import { tokenOk } from "@/lib/api-auth";
import { deleteOAuthToken } from "@/lib/oauth-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await tokenOk(req))) return NextResponse.json({ error: "token invalide" }, { status: 401 });
  const workspaceToken = req.headers.get("x-app-token") ?? process.env.MCP_SHARED_TOKEN ?? "";
  await deleteOAuthToken(workspaceToken, "gsc");
  return NextResponse.json({ ok: true });
}
