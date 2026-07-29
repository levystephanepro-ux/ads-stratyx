# STATUS — ads-stratyx

> Fichier de suivi partagé entre **Claude Code** (desktop) et **Cowork** (mobile/web).
> Mettre à jour en début ET fin de chaque session.
> Format : `[YYYY-MM-DD] [session: code|cowork] message`

---

## 🟢 État actuel

| Aspect | Statut |
|--------|--------|
| App | ✅ Initialisée |
| Vercel | ✅ Connecté (project: ads-stratyx) |
| Supabase | ✅ Configuré |
| Stripe | ✅ Intégré |
| Google Ads API | ⚠️ Mode mock (à passer en live) |
| Search Console | ⚠️ Mode mock (à passer en live) |
| MCP_SHARED_TOKEN | ⚠️ À configurer avant mise en prod |

---

## 📋 Backlog

### 🔴 Priorité haute
- [ ] Configurer `MCP_SHARED_TOKEN` en prod (.env Vercel)
- [ ] Passer `ADS_DATA_MODE=live` avec vrais tokens Google Ads
- [ ] Passer `SEARCH_CONSOLE_DATA_MODE=live`

### 🟡 Priorité moyenne
- [ ] ...

### 🟢 Priorité basse / idées
- [ ] ...

---

## 🔄 En cours

*(rien en cours)*

---

## ✅ Terminé

- [2026-07-20] [cowork] Setup CLAUDE.md + STATUS.md — communication bidirectionnelle Claude Code ↔ Cowork

- [2026-07-22] [cowork] Audit sécurité Supabase — correction complète RLS + fonctions

---

## 📝 Journal de session

### 2026-07-20 — Cowork (setup)
- Projet monté et analysé
- Créé `CLAUDE.md` (contexte complet du projet)
- Créé `STATUS.md` (ce fichier)
- Stack confirmée : Next.js 15, Supabase, Vercel, Stripe, Google Ads API, Anthropic SDK

### 2026-07-22 — Cowork (sécurité Supabase)
- Alerte critique résolue : table `discovery_sessions` supprimée (inutilisée, RLS désactivé)
- Policies RLS créées : `agent_tasks`, `templates`, `personas` (INSERT corrigé)
- Fonctions sécurisées : `handle_new_user` et `update_updated_at` → SECURITY INVOKER + search_path fixé
- `handle_new_user` : accès anon/authenticated révoqué
- Leaked password protection : non disponible (plan Free Supabase)
- `app_settings` et `oauth_tokens` : RLS activé sans policy = bloqué côté client ✅
- Résultat final : 0 erreurs critiques, 1 warning non bloquant (plan Free)

---

## 🐛 Bugs connus

*(aucun pour l'instant)*

---

## 💡 Notes importantes

- Mode `mock` = aucun appel réel à Google Ads (safe pour dev)
- Le connecteur MCP (`/api/mcp`) permet aux users Claude Pro de brancher leurs campagnes directement dans Claude
- Les agents tournent en cron (`/api/cron`) et envoient des rapports email
- Auth : Supabase SSR (cookies httpOnly)

---

*Template : ajouter une ligne dans "Journal de session" à chaque ouverture*
