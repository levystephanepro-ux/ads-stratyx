import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const form = await req.formData().catch(() => null);
  const email = String(form?.get("email") ?? "");
  const password = String(form?.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=1`, { status: 303 });
  }

  return NextResponse.redirect(`${origin}/dashboard`, { status: 303 });
}
