// Définit le compte Google Ads par défaut (parmi les comptes du MCC) ciblé par
// le Copilote et les agents. Persisté dans app_settings.
import { NextResponse } from "next/server";
import { tokenOk } from "@/lib/api-auth";
import { setSetting } from "@/lib/agent/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await tokenOk(req))) {
    return NextResponse.json({ error: "token invalide" }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  const customerId = String(b.customer_id ?? "").replace(/\D/g, "");
  if (!customerId) {
    return NextResponse.json({ error: "customer_id manquant" }, { status: 400 });
  }
  try {
    await setSetting("default_customer_id", customerId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
