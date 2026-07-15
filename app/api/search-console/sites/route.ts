import { NextResponse } from "next/server";
import { tokenOk } from "@/lib/api-auth";
import { listSites } from "@/lib/search-console/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await tokenOk(req))) return NextResponse.json({ error: "token invalide" }, { status: 401 });
  const workspaceToken = req.headers.get("x-app-token") ?? process.env.MCP_SHARED_TOKEN ?? "";
  try {
    const sites = await listSites(workspaceToken);
    return NextResponse.json({ sites });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
