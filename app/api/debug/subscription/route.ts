import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  const { data: sessionData } = await supabase.auth.getSession();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "MISSING";
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = sessionData.session?.access_token ?? "MISSING";

  if (!user) return NextResponse.json({ error: "not logged in", userErr });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const authKey = serviceKey ?? anonKey;
  const authBearer = serviceKey ?? accessToken;

  const url = `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=status,trial_ends_at&limit=1`;

  let fetchResult: unknown = null;
  let fetchStatus = 0;
  let fetchError: string | null = null;
  try {
    const res = await fetch(url, {
      headers: { apikey: authKey, Authorization: `Bearer ${authBearer}`, Accept: "application/json" },
      cache: "no-store",
    });
    fetchStatus = res.status;
    fetchResult = await res.json();
  } catch (e) {
    fetchError = String(e);
  }

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    hasServiceKey,
    accessTokenPresent: accessToken !== "MISSING",
    fetchUrl: url,
    fetchStatus,
    fetchResult,
    fetchError,
  });
}
