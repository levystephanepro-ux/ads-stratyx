// Obtient un refresh_token Google Ads via un mini-flux OAuth local.
// Usage :  node scripts/get-refresh-token.mjs
//
// Pré-requis (une seule fois) dans Google Cloud Console → API et services →
// Identifiants → ton client OAuth "web" → URI de redirection autorisés, AJOUTE :
//     http://localhost:5858/oauth2callback
// Si l'écran de consentement est en mode "Test", ajoute ton adresse Google
// comme utilisateur de test.
//
// Le script lit GOOGLE_ADS_OAUTH_CLIENT_ID / _SECRET depuis .env.local.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "..", ".env.local");

function readEnv(key) {
  try {
    const line = readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith(key + "="));
    return line ? line.slice(key.length + 1).trim() : "";
  } catch {
    return "";
  }
}

const CLIENT_ID = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID || readEnv("GOOGLE_ADS_OAUTH_CLIENT_ID");
const CLIENT_SECRET = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET || readEnv("GOOGLE_ADS_OAUTH_CLIENT_SECRET");
const PORT = 5858;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = "https://www.googleapis.com/auth/adwords";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ CLIENT_ID / CLIENT_SECRET introuvables dans .env.local.");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("Pas de code reçu.");
    return;
  }

  // Échange code → tokens.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();

  if (tokens.refresh_token) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(
      "<h2>✅ C'est bon.</h2><p>Refresh token récupéré. Retourne au terminal, tu peux fermer cet onglet.</p>",
    );
    console.log("\n✅ REFRESH TOKEN :\n\n" + tokens.refresh_token + "\n");
    console.log("→ Colle-le dans .env.local : GOOGLE_ADS_REFRESH_TOKEN=" + tokens.refresh_token);
    console.log("→ Renseigne aussi GOOGLE_ADS_CUSTOMER_ID (ton compte, sans tirets) et passe ADS_DATA_MODE=live.\n");
  } else {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" }).end(
      "<h2>❌ Pas de refresh_token</h2><pre>" + JSON.stringify(tokens, null, 2) + "</pre>",
    );
    console.error("\n❌ Réponse sans refresh_token :", tokens, "\n");
  }
  server.close();
});

server.listen(PORT, () => {
  console.log("\n1) Ouvre cette URL dans ton navigateur (connecté au bon compte Google) :\n");
  console.log(authUrl.toString() + "\n");
  console.log("2) Autorise l'accès. Tu seras redirigé ici automatiquement.\n");
});
