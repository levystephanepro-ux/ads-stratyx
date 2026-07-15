import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabase } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const form = await req.formData().catch(() => null);
  const email = String(form?.get("email") ?? "");
  const password = String(form?.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error || !data.user) {
    const msg = error?.message ?? "Erreur inconnue";
    return NextResponse.redirect(
      `${origin}/register?error=${encodeURIComponent(msg)}`,
      { status: 303 },
    );
  }

  // Crée une période d'essai de 14 jours
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  const admin = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  await admin.from("subscriptions").insert({
    user_id: data.user.id,
    status: "trialing",
    plan: "pro",
    trial_ends_at: trialEnd.toISOString(),
  });

  return NextResponse.redirect(`${origin}/dashboard`, { status: 303 });
}
