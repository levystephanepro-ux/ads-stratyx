// Définit le compte Google Ads par défaut (parmi les comptes du MCC) ciblé par
// le Copilote et les agents. Persisté dans app_settings.
import { NextResponse } from "next/server";
import { tokenOk, getWorkspaceId } from "@/lib/api-auth";
import { setSetting } from "@/lib/agent/store";
import { getWorkspaceOwnerEmail } from "@/lib/billing";
import { isOwnerEmail } from "@/lib/owner";
import { listWorkspaceAccounts } from "@/lib/google-ads/default-account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await tokenOk(req))) {
    return NextResponse.json({ error: "token invalide" }, { status: 401 });
  }
  const workspaceId = await getWorkspaceId(req);
  const b = await req.json().catch(() => ({}));
  const customerId = String(b.customer_id ?? "").replace(/\D/g, "");
  if (!customerId) {
    return NextResponse.json({ error: "customer_id manquant" }, { status: 400 });
  }
  // Isolation : un client ne peut choisir qu'un compte relié à SON espace.
  // L'owner, lui, peut cibler n'importe quel compte du MCC.
  if (workspaceId && !isOwnerEmail(await getWorkspaceOwnerEmail(workspaceId))) {
    const allowed = await listWorkspaceAccounts(workspaceId);
    if (!allowed.some((a) => a.customerId === customerId)) {
      return NextResponse.json(
        { error: "Ce compte n'est pas relié à ton espace." },
        { status: 403 },
      );
    }
  }
  try {
    await setSetting("default_customer_id", customerId, workspaceId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
