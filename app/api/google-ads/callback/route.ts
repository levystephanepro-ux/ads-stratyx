// Retour du consentement Google : on échange le code contre des tokens, puis on
// récupère la liste des comptes accessibles et on les enregistre.
// Le détail de l'appel "listAccessibleCustomers" sera câblé avec google-ads-api ;
// ici on gère déjà l'échange de code et le stockage du refresh_token.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adsConfig } from "@/lib/google-ads/config";
import { getAppUrl } from "@/lib/app-url";

const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // = user.id posé au /connect

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard?ads=error`);
  }
  if (!adsConfig.oauthClientId || !adsConfig.oauthClientSecret) {
    return NextResponse.redirect(`${origin}/dashboard?ads=not_configured`);
  }

  const redirectUri = `${getAppUrl()}/api/google-ads/callback`;

  // 1. Échange code → tokens.
  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: adsConfig.oauthClientId,
      client_secret: adsConfig.oauthClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/dashboard?ads=token_error`);
  }
  const tokens = (await tokenRes.json()) as { refresh_token?: string };

  // 2. Rattache au workspace de l'utilisateur.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || (state && state !== user.id)) {
    return NextResponse.redirect(`${origin}/login`);
  }
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!ws) {
    return NextResponse.redirect(`${origin}/dashboard?ads=no_workspace`);
  }

  // 3. TODO (mode live) : appeler listAccessibleCustomers via google-ads-api
  //    (version adsConfig.apiVersion) pour récupérer les customer_id réels et
  //    leurs infos (nom, devise, fuseau). Pour l'instant on stocke le token brut ;
  //    l'utilisateur pourra choisir le compte par défaut ensuite.
  if (tokens.refresh_token) {
    await supabase.from("google_ads_connections").upsert(
      {
        workspace_id: ws.id,
        customer_id: "pending", // sera remplacé par le vrai ID à l'étape live
        refresh_token: tokens.refresh_token,
        is_default: true,
      },
      { onConflict: "workspace_id,customer_id" },
    );
  }

  return NextResponse.redirect(`${origin}/dashboard?ads=connected`);
}
