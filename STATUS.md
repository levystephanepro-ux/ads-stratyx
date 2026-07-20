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

---

## 📝 Journal de session

### 2026-07-20 — Cowork (setup)
- Projet monté et analysé
- Créé `CLAUDE.md` (contexte complet du projet)
- Créé `STATUS.md` (ce fichier)
- Stack confirmée : Next.js 15, Supabase, Vercel, Stripe, Google Ads API, Anthropic SDK

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
