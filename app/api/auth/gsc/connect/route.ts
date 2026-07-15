import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspaceToken = url.searchParams.get("token") || process.env.MCP_SHARED_TOKEN || "";

  const redirectUri = `${getAppUrl()}/api/auth/gsc/callback`;
  const state = Buffer.from(JSON.stringify({ token: workspaceToken })).toString("base64url");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/auth");
  authUrl.searchParams.set("client_id", process.env.GOOGLE_ADS_OAUTH_CLIENT_ID ?? "");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
