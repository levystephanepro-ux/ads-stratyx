// Admin : activer / changer le plan d'un client, ou couper son accès.
// Réservé à l'owner (session Supabase + email owner).
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDashboardContext } from "@/lib/workspace";
import { PLANS, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = await getDashboardContext();
  if (!ctx.authed || !ctx.isOwner) {
    return NextResponse.json({ error: "accès refusé" }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const userId = String(b.userId ?? "");
  const action = String(b.action ?? "activate"); // activate | cancel
  const plan = String(b.plan ?? "pro");

  if (!userId) {
    return NextResponse.json({ error: "userId manquant" }, { status: 400 });
  }
  if (action === "activate" && !PLANS[plan as PlanId]) {
    return NextResponse.json({ error: "plan inconnu" }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const patch =
    action === "cancel"
      ? { status: "canceled", updated_at: new Date().toISOString() }
      : { status: "active", plan, updated_at: new Date().toISOString() };

  const { error } = await admin
    .from("subscriptions")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
