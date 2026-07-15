/**
 * Génère un refresh token Google avec le scope Search Console.
 * Usage : node scripts/get-gsc-token.mjs
 *
 * Prérequis : GOOGLE_ADS_OAUTH_CLIENT_ID et GOOGLE_ADS_OAUTH_CLIENT_SECRET dans .env.local
 */

import { readFileSync } from "fs";
import { createServer } from "http";
import { URL } from "url";

// Lire .env.local
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim()))
    .map(([k, ...v]) => [k, v.join("=")])
);

const CLIENT_ID = env.GOOGLE_ADS_OAUTH_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_ADS_OAUTH_CLIENT_SECRET;
const PORT = 9876;
const REDIRECT = `http://localhost:${PORT}/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌  GOOGLE_ADS_OAUTH_CLIENT_ID ou GOOGLE_ADS_OAUTH_CLIENT_SECRET manquant dans .env.local");
  process.exit(1);
}

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
].join(" ");

const authUrl =
  `https://accounts.google.com/o/oauth2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&response_type=code` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log("\n🔑  Ouvre cette URL dans ton navigateur :\n");
console.log(authUrl);
console.log("\nEn attente du callback sur http://localhost:" + PORT + "…\n");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.end(`<h2>Erreur : ${error}</h2>`);
    server.close();
    return;
  }

  if (!code) {
    res.end("En attente…");
    return;
  }

  // Échange le code contre un refresh token
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
  const token = await tokenRes.json();

  if (!token.refresh_token) {
    const msg = `Pas de refresh_token dans la réponse : ${JSON.stringify(token)}`;
    console.error("❌ ", msg);
    res.end(`<h2>Erreur</h2><pre>${msg}</pre>`);
    server.close();
    return;
  }

  console.log("\n✅  Refresh token obtenu !\n");
  console.log("Ajoute ces lignes dans ton .env.local :\n");
  console.log(`SEARCH_CONSOLE_DATA_MODE=live`);
  console.log(`GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN=${token.refresh_token}\n`);

  res.end(`
    <h2>✅ Succès !</h2>
    <p>Copie dans ton <code>.env.local</code> :</p>
    <pre>SEARCH_CONSOLE_DATA_MODE=live
GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN=${token.refresh_token}</pre>
    <p>Tu peux fermer cet onglet.</p>
  `);

  server.close();
  process.exit(0);
});

server.listen(PORT);
