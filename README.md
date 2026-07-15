# ads-stratyx

Pilote tes campagnes **Google Ads** depuis **Claude**, via un serveur **MCP**.
L'utilisateur connecte son compte Google Ads, récupère une URL MCP, la colle dans
Claude, et gère ses campagnes en langage naturel (audit, perf, budgets…).

Stack : **Next.js 15 + React 19 + Supabase** (auth magic-link + Postgres/RLS).

## Démarrer en 30 secondes (mode démo, zéro config)

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000 → le **dashboard tourne directement en mode démo**
(données factices, pas d'authentification) tant que Supabase n'est pas configuré.
Tu peux déjà tester le serveur MCP :

```bash
# statut
curl http://localhost:3000/api/mcp?token=demo
# lister les outils exposés à Claude
curl -X POST http://localhost:3000/api/mcp?token=demo \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Brancher dans Claude

1. Le serveur MCP doit être joignable par Claude. En local, expose-le
   (`ngrok http 3000`) ou déploie sur Vercel pour obtenir une URL publique.
2. Copie l'URL MCP affichée sur le dashboard : `https://<host>/api/mcp?token=<token>`.
3. Claude → Réglages → Connecteurs → connecteur personnalisé → colle l'URL.
4. Demande : « Liste mes comptes Google Ads », « Analyse la performance sur 30 jours ».

## Passer en mode réel (live)

1. `cp .env.local.example .env.local` et renseigne Supabase + Google Ads.
2. Crée la base : `supabase start && supabase db reset` (applique `migrations/`).
3. Obtiens un **developer token** Google Ads + identifiants **OAuth** (Google Cloud).
4. Mets `ADS_DATA_MODE=live` et `GOOGLE_ADS_API_VERSION=<version supportée>`.
5. Câble les appels réels dans `lib/google-ads/client.ts` (voir les TODO fléchés).

> **Version d'API** : elle vit dans **une seule** variable (`GOOGLE_ADS_API_VERSION`).
> Quand Google déprécie une version (« Version vXX is deprecated »), tu changes
> cette ligne — rien d'autre. Vérifie la version courante sur les release notes
> Google Ads API.

## Structure

```
app/
  login/                 Connexion magic-link
  auth/callback/         Échange du code de session
  dashboard/             UI : URL MCP + statut + aperçu performance
  api/mcp/               ← Endpoint MCP appelé par Claude (JSON-RPC)
  api/google-ads/        OAuth connect + callback
lib/
  supabase/              Clients navigateur / serveur / admin (service_role)
  google-ads/            config (version!) · types · mock-data · client (façade mock↔live)
  mcp/                   auth (token→workspace) · tools · server (dispatch JSON-RPC)
  workspace.ts           Contexte dashboard (dégradation gracieuse sans config)
supabase/migrations/     Schéma + RLS (workspaces, connexions, tokens MCP)
```

## Sécurité (à durcir avant prod)

- Chiffrer `refresh_token` (Supabase Vault / KMS) au lieu du stockage en clair.
- Signer le `state` OAuth (anti-CSRF) au lieu de passer l'`user.id` brut.
- Faire tourner / révoquer les tokens MCP ; limiter le débit sur `/api/mcp`.
