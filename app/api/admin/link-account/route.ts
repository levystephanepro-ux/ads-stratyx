// Admin : relier / délier un compte Google Ads du MCC à l'espace d'un client.
// Réservé à l'owner (session Supabase + email owner).
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDashboardContext } from "@/lib/workspace";
import { getSetting, setSetting } from "@/lib/agent/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = await getDashboardContext();
  if (!ctx.authed || !ctx.isOwner) {
    return NextResponse.json({ error: "accès refusé" }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const workspaceId = String(b.workspaceId ?? "");
  const customerId = String(b.customerId ?? "").replace(/\D/g, "");
  const action = String(b.action ?? "link"); // link | unlink
  const name = typeof b.name === "string" ? b.name : null;

  if (!workspaceId || !customerId) {
    return NextResponse.json(
      { error: "workspaceId et customerId obligatoires" },
      { status: 400 },
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    if (action === "unlink") {
      const { error } = await admin
        .from("google_ads_connections")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("customer_id", customerId);
      if (error) throw new Error(error.message);
      // Si c'était le compte par défaut du client, on efface le réglage.
      const def = await getSetting("default_customer_id", workspaceId);
      if (def === customerId) await setSetting("default_customer_id", "", workspaceId);
      return NextResponse.json({ ok: true });
    }

    const { error } = await admin
      .from("google_ads_connections")
      .upsert(
        { workspace_id: workspaceId, customer_id: customerId, descriptive_name: name },
        { onConflict: "workspace_id,customer_id" },
      );
    if (error) throw new Error(error.message);

    // Premier compte relié → devient automatiquement le compte par défaut.
    const def = await getSetting("default_customer_id", workspaceId);
    if (!def) await setSetting("default_customer_id", customerId, workspaceId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
