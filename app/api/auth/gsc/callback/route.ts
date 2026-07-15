import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { setOAuthToken } from "@/lib/oauth-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const oauthError = url.searchParams.get("error");

  const base = getAppUrl();

  if (oauthError) {
    return NextResponse.redirect(`${base}/connexions?gsc_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${base}/connexions?gsc_error=no_code`);
  }

  let workspaceToken = "";
  try {
    workspaceToken = JSON.parse(Buffer.from(state, "base64url").toString()).token ?? "";
  } catch {
    return NextResponse.redirect(`${base}/connexions?gsc_error=invalid_state`);
  }

  const redirectUri = `${base}/api/auth/gsc/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_ADS_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const t = await tokenRes.json();

  if (!t.refresh_token) {
    const msg = t.error_description ?? t.error ?? "no_refresh_token";
    return NextResponse.redirect(`${base}/connexions?gsc_error=${encodeURIComponent(msg)}`);
  }

  let email: string | undefined;
  try {
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${t.access_token}` },
    });
    const info = await infoRes.json();
    email = info.email;
  } catch { /* optional */ }

  await setOAuthToken(workspaceToken, "gsc", t.refresh_token, email);

  return NextResponse.redirect(`${base}/connexions?gsc=connected`);
}
