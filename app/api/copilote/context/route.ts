// Contexte du compte (« Enrichir l'agent ») : texte libre stocké par compte
// Google Ads, injecté dans le prompt du Copilote et du rapport du lundi.
import { NextResponse } from "next/server";
import { tokenValueOk, getWorkspaceIdFromValue } from "@/lib/api-auth";
import { getSetting, setSetting } from "@/lib/agent/store";
import { contextKey } from "@/lib/account-context";
import { getWorkspaceOwnerEmail } from "@/lib/billing";
import { isOwnerEmail } from "@/lib/owner";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!(await tokenValueOk(token))) return NextResponse.json({ error: "token invalide" }, { status: 401 });
  const ws = await getWorkspaceIdFromValue(token);
  const context = await getSetting(contextKey(url.searchParams.get("customerId")), ws);
  return NextResponse.json({ context: context ?? "" });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!(await tokenValueOk(body.token))) return NextResponse.json({ error: "token invalide" }, { status: 401 });
  const ws = await getWorkspaceIdFromValue(body.token);
  const text = String(body.context ?? "").slice(0, 4000);
  await setSetting(contextKey(body.customerId), text, ws);
  // Owner : copie globale, lue par le rapport du lundi (qui tourne sans workspace).
  if (ws && isOwnerEmail(await getWorkspaceOwnerEmail(ws))) await setSetting(contextKey(body.customerId), text, null);
  return NextResponse.json({ ok: true });
}
