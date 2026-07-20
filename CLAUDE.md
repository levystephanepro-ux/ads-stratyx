# ads-stratyx — Contexte Projet Partagé

> Ce fichier est lu automatiquement par Claude Code et Cowork (claude.ai).
> Il est la **source de vérité unique** sur l'architecture et l'état du projet.
> **Ne pas supprimer.** Mettre à jour après chaque changement structurant.

---

## Projet

**Stratyx** — Copilote IA pour Google Ads, ciblant media buyers et gérants de PME.
- Site : stratyxmedia.fr
- App déployée sur **Vercel** (project: `ads-stratyx`, org: team_GOORCmfXV3ybre2VK1sKTUuS)
- Base de données : **Supabase**
- Facturation : **Stripe**

---

## Stack technique

| Couche | Tech |
|--------|------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, CSS vanilla (variables CSS globales) |
| Auth | Supabase SSR |
| DB | Supabase (PostgreSQL) |
| IA | Anthropic SDK (`@anthropic-ai/sdk`) |
| Ads | Google Ads API v21 (`google-ads-api`) |
| SEO | Google Search Console API |
| Billing | Stripe |
| Deploy | Vercel |
| Types | TypeScript strict |

---

## Structure du repo

```
app/
├── page.tsx              ← Landing page publique (force-static)
├── layout.tsx            ← Shell global
├── dashboard/            ← Dashboard principal (post-login)
├── copilote/             ← Copilote IA (chat avec campagnes)
├── agent/                ← Agents autonomes 24/7
├── connexions/           ← Connexion comptes Google Ads
├── templates/            ← 40+ templates d'analyse
├── persona/              ← Persona builder
├── search-console/       ← Intégration GSC
├── pricing/              ← Page tarifs
├── admin/                ← Interface admin
├── login/ register/      ← Auth
└── api/
    ├── auth/             ← Callbacks OAuth
    ├── google-ads/       ← Endpoints Google Ads
    ├── mcp/              ← Serveur MCP (connecteur Claude Pro)
    ├── copilote/         ← Streaming IA
    ├── agent/            ← Exécution agents
    ├── stripe/           ← Webhooks facturation
    ├── cron/             ← Jobs planifiés
    ├── connexions/       ← Gestion comptes
    ├── search-console/   ← Endpoints GSC
    ├── templates/        ← Templates CRUD
    ├── usage/            ← Suivi crédits
    └── admin/            ← API admin

components/
├── Shell.tsx             ← Navigation / layout app
├── Copilote.tsx          ← Composant chat IA
├── AgentTasksManager.tsx ← Gestion agents
├── ConnexionsManager.tsx ← Gestion comptes Ads
├── ConnexionsGscCard.tsx ← Connexion GSC
├── TemplatesManager.tsx  ← Bibliothèque templates
├── AdminManager.tsx      ← Interface admin
├── AccountSwitcher.tsx   ← Changement de compte
├── CreditGauge.tsx       ← Jauge crédits IA
├── McpUrlBox.tsx         ← URL MCP pour Claude Pro
├── UsageWidget.tsx       ← Widget usage
└── ThemeToggle.tsx       ← Dark/light mode

lib/
├── agent/                ← Logique agents (loop, missions, store, cost, email)
├── google-ads/           ← Client Google Ads
├── mcp/                  ← Logique serveur MCP
├── search-console/       ← Client GSC
├── supabase/             ← Clients Supabase (server/client/middleware)
├── plans.ts              ← Définition plans Starter / Pro
├── billing.ts            ← Logique facturation
├── stripe.ts             ← Client Stripe
├── subscription.ts       ← Gestion abonnements
├── workspace.ts          ← Workspace utilisateur
├── oauth-store.ts        ← Stockage tokens OAuth
├── api-auth.ts           ← Auth API routes
├── admin.ts              ← Fonctions admin
├── owner.ts              ← Logique propriétaire
└── app-url.ts            ← URL helper
```

---

## Plans tarifaires

| Plan | Prix | Usage |
|------|------|-------|
| Starter | voir `lib/plans.ts` | MCP dans Claude Pro, agents limités |
| Pro | voir `lib/plans.ts` | Copilote in-app, agents +, crédits IA |

Essai gratuit 14j, sans CB, sans engagement.

---

## Variables d'environnement clés

```bash
NEXT_PUBLIC_SUPABASE_URL          # URL Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Clé publique
SUPABASE_SERVICE_ROLE_KEY         # Clé serveur (jamais exposée)
NEXT_PUBLIC_APP_URL               # URL app (localhost ou prod)
MCP_SHARED_TOKEN                  # Token sécurité MCP
ADS_DATA_MODE                     # mock | live
GOOGLE_ADS_API_VERSION            # v21
GOOGLE_ADS_DEVELOPER_TOKEN
GOOGLE_ADS_OAUTH_CLIENT_ID
GOOGLE_ADS_OAUTH_CLIENT_SECRET
GOOGLE_ADS_LOGIN_CUSTOMER_ID      # MCC (optionnel)
SEARCH_CONSOLE_DATA_MODE          # mock | live
GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN
```

---

## Conventions de code

- **Pas de librairie UI externe** — CSS vanilla uniquement (variables globales dans `globals.css`)
- Classes CSS : `btn`, `btn-ghost`, `card`, `pill`, `subtitle`, `brand`
- Auth côté serveur : `@supabase/ssr`
- API routes : validation dans `lib/api-auth.ts`
- Agents : logique dans `lib/agent/` (loop.ts = boucle principale)
- Mode données : `ADS_DATA_MODE=mock` pour dev, `live` pour prod

---

## Workflow de développement

```
Claude Code (desktop)          Cowork / Claude (mobile/portail)
─────────────────────          ─────────────────────────────────
Dev lourd (features)      ←→  Améliorations légères, bug fixes
Refactoring                    Suggestions, planning
Tests, build                   Monitoring, roadmap
git push → Vercel deploy       Review code, documentation
```

**Règle de synchronisation** :
1. Mettre à jour `STATUS.md` après chaque session
2. Committer les changements (`git push`) pour synchroniser
3. Lire `STATUS.md` en début de session pour reprendre le contexte

---

## Commandes utiles

```bash
npm run dev          # Serveur local
npm run build        # Build prod
npm run types        # Regénérer types Supabase
git push             # Déploie automatiquement sur Vercel
```

---

*Dernière mise à jour : 2026-07-20 — Setup initial par Cowork*
