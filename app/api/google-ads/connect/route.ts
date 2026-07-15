// Démarre le flux OAuth Google Ads : redirige l'utilisateur vers l'écran de
// consentement Google. Nécessite GOOGLE_ADS_OAUTH_CLIENT_ID en config.
// Tant que les identifiants ne sont pas renseignés, renvoie un message clair.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adsConfig } from "@/lib/google-ads/config";
import { getAppUrl } from "@/lib/app-url";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const ADWORDS_SCOPE = "https://www.googleapis.com/auth/adwords";

export async function GET(request: NextRequest) {
  // On exige une session : c'est l'utilisateur connecté qui relie son compte.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!adsConfig.oauthClientId) {
    return NextResponse.json(
      {
        error: "google_ads_oauth_non_configuré",
        message:
          "Renseigne GOOGLE_ADS_OAUTH_CLIENT_ID / _SECRET et GOOGLE_ADS_DEVELOPER_TOKEN " +
          "dans .env.local, puis passe ADS_DATA_MODE=live pour connecter un vrai compte.",
      },
      { status: 501 },
    );
  }

  const redirectUri = `${getAppUrl()}/api/google-ads/callback`;

  const params = new URLSearchParams({
    client_id: adsConfig.oauthClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: ADWORDS_SCOPE,
    access_type: "offline", // pour obtenir un refresh_token
    prompt: "consent",
    state: user.id, // relie le callback à l'utilisateur (à durcir : state signé)
  });

  return NextResponse.redirect(`${GOOGLE_AUTH}?${params.toString()}`);
}
