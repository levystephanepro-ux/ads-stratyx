import { NextResponse } from "next/server";
import { tokenValueOk, getWorkspaceIdFromValue } from "@/lib/api-auth";
import { getSetting, setSetting } from "@/lib/agent/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = req.headers.get("x-app-token");
  if (!(await tokenValueOk(token))) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }
  const workspaceId = await getWorkspaceIdFromValue(token);
  const raw = await getSetting("campaign_filter", workspaceId);
  return NextResponse.json({ filter: raw ? JSON.parse(raw) : { mode: "all" } });
}

export async function POST(req: Request) {
  const token = req.headers.get("x-app-token");
  if (!(await tokenValueOk(token))) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }
  const workspaceId = await getWorkspaceIdFromValue(token);
  const body = await req.json();
  await setSetting("campaign_filter", JSON.stringify(body), workspaceId);
  return NextResponse.json({ ok: true });
}
