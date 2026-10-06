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

- [2026-10-06] [cowork] Usage interne + **Diagnostic (phase 1)** : code écrit, typecheck OK, règles testées, **à déployer et tester**
  1. Lancer `supabase/migrations/0018_audit_reports.sql` dans le SQL Editor Supabase
     (ignorer `supabase/_obsolete/0018_waste_reports.sql`, version abandonnée, à supprimer)
  2. Vercel : `STRATYX_INTERNAL_MODE=true`, `OWNER_MONTHLY_BUDGET_EUR=5`, vérifier `CRON_SECRET`
  3. Ouvrir /waste (menu « Diagnostic ») → « Relancer le diagnostic » (mock puis live)
  4. Comparer aux constats Ades sur D2B (conflits « la garde » et « fenetre bois sur mesure »,
     extension d'appel refusée, budget limité) puis `npm run types`

## 🗺️ Feuille de route « type Ades » (une phase = déployée et testée avant la suivante)

| Phase | Contenu | État |
|---|---|---|
| 1 | Diagnostic 6 catégories + santé /100 + « Par où commencer » + email du matin | ✅ en ligne, testé sur D2B (78/100) |
| 1b | Bibliothèque de scripts : 98/98 (lot 1 en ligne et testé sur D2B, lots 2-3 à tester) | ✅ codé |
| 2 | Corrections en un clic (négatif, pause mot-clé, retrait d'un négatif bloquant) avec journal + annulation 30 j | ✅ codé, migration 0020 à lancer, à tester |
| 3 | Dashboard période vs précédente, part d'impressions, budget du mois | ✅ codé, à tester |
| 4 | Alertes : modèles (compte à l'arrêt, dépense qui s'emballe, plus de conversions, CPA en hausse, budget du mois, pages en erreur) + règles perso | ✅ codé, à tester |
| 5a | Dossiers par client, rapport client (Hebdo/Mensuel/QBR/Annuel, lead gen/e-commerce, clair/sombre, 10 sections, aperçu, lien public /r/token, PDF via impression), compte rendu mensuel (change_event) | ✅ codé, migration 0019 à lancer, à tester |
| 5b | Page « Comptes liés » (dépense 30 j, santé, surveillance on/off) + Change Impact (décomposition volume/prix/taux, effet de chaque modification avant/après) | ✅ codé, à tester |
| 6 | Prévisions (planificateur de mots-clés, estimation par budget) + création de campagne Search en pause | ✅ codé, à tester |

Différenciants Stratyx à garder : intentions métier artisans, niveau « à surveiller » pour petits comptes,
exclusivité territoriale, connecteur MCP Claude Pro.

*(rien en cours)*

---

## ✅ Terminé

- [2026-07-20] [cowork] Setup CLAUDE.md + STATUS.md — communication bidirectionnelle Claude Code ↔ Cowork

- [2026-07-22] [cowork] Audit sécurité Supabase — correction complète RLS + fonctions

---

## 📝 Journal de session

### 2026-10-06 — Cowork (Phase 6 : Prévisions + jauge IA)
- `adsPost()` dans client.ts (POST générique : generateKeywordIdeas, geoTargetConstants:suggest, googleAds:mutate).
- `lib/planner/ideas.ts` : lieux, idées de mots-clés (FR, Search), taux de conv. du compte 90 j, `forecast()` (CPC = milieu fourchette haut de page pondéré, CTR 6 %, conv. = taux du compte ou 5 %).
- `lib/planner/create.ts` : campagne Search EN PAUSE en un mutate atomique (budget, campagne, lieux, langue FR, groupe, mots-clés, RSA), `validateSpec`, mode « Vérifier sans créer » (validateOnly).
- Page `/previsions` (menu) + `components/CampaignForm.tsx` (useActionState, la saisie est conservée). Création journalisée (action_log), annulable (campagne retirée).
- Prévisions façon Forecast d'Ades : budget mensuel, pays, langue, objectif leads/ventes, panier moyen, marge, % leads → clients, frais d'agence ; tableau de rentabilité (clients, marge, résultat net, ROI) et seuil de rentabilité ; bouton « Scanner la page » (mots-clés tirés de l'URL seule).
- Prévisions : « ✦ Proposer la structure avec l'IA » (lib/planner/ai.ts, modèle BUILDER_MODEL, défaut claude-sonnet-4-6, repli Haiku ; contexte « Enrichir l'agent » inclus ; plafond getGlobalBilling ; `sanitize` coupe titres > 30 / descriptions > 90, doublons, négatifs qui bloqueraient un mot-clé). `components/CampaignBuilder.tsx` remplace CampaignForm : plusieurs groupes éditables + négatifs de campagne, création atomique multi-groupes.
- Alertes : test des pages en navigateur, 2 essais de 12 s ; seules 404/410/5xx sont critiques ; « injoignable » signalé seulement deux passages de suite (pare-feu des hébergeurs).
- Jauge sidebar : pour l'owner, « IA ce mois : x € / plafond € » (workspace + appels globaux), via /api/usage.

### 2026-10-06 — Cowork (Phase 4 : alertes)
- `lib/alerts/config.ts` : 6 modèles activables avec seuil + règles perso (indicateur, hier/7 j, >/<, seuil, filtre campagne), stockés en JSON dans app_settings (`alerts_config`), aucune migration.
- `lib/alerts/run.ts` : `runAlertsForOwner()` sur les comptes surveillés, dernier résultat dans `alerts_last` ; pages vérifiées en GET (15 URL max, 8 s).
- Cron /api/cron/waste : diagnostic + alertes en parallèle, email si diagnostic important OU alerte, alertes en tête.
- Page `/alertes` (menu) : dernière vérification, modèles, règles, bouton « Vérifier maintenant ».
- Tableau de bord : graphique en barres HTML pleine largeur, carte ROAS masquée si la valeur de conversion est négligeable.

### 2026-10-06 — Cowork (Phase 3 : tableau de bord)
- `lib/dashboard.ts` (`buildDashboard`) : KPI période vs précédente (7 j, 30 j, ce mois, mois dernier), dépense par jour, part d'impressions Search pondérée (perdue budget / classement, par campagne), rythme du mois (dépensé, projection au rythme des 7 derniers jours, budget mensuel saisi ou plafond Google = budgets quotidiens × jours).
- Budget mensuel par compte : clé `monthly_budget:<id>` dans app_settings, formulaire sur l'accueil.
- `components/DashboardPerf.tsx` sur /dashboard (owner, mode live). Section « Templates populaires » retirée (lien /templates supprimé).
- Diagnostic : bouton qui montre le calcul en cours, bandeau de résultat, heure de lecture (created_at mis à jour à chaque relance).

### 2026-10-06 — Cowork (Phase 2 : corrections en un clic)
- `Constat.fix` (lib/audit/types.ts) : add_negatives (recherches), pause_keyword (mots-clés sans conversion prouvés), remove_negative (négatif de campagne/groupe qui bloque un mot-clé ; jamais les listes partagées).
- Sécurité : un négatif proposé n'est jamais applicable s'il bloquerait un mot-clé actif ; la correction est relue dans le dernier diagnostic enregistré, pas dans le formulaire ; owner uniquement ; double application refusée.
- `lib/fixes/apply.ts` (mutate campaignCriteria/adGroupCriteria + annulation), `lib/fixes/store.ts`, migration `0020_action_log.sql`.
- UI : « Corriger en un clic » sous chaque constat du Diagnostic, « Corrigé le … · Annuler », page `/waste/journal`.
- fetch.ts lit désormais criterion_id et resource_name : relancer le diagnostic pour voir les boutons.

### 2026-10-06 — Cowork (Phase 5b : Comptes liés + Change Impact)
- `/comptes` : tous les comptes du MCC, dépense et conversions 30 j, dernière dépense, note santé, bouton surveillance (clé `monitoring:<id>` dans app_settings, activée par défaut).
- `monitoredAccounts()` dans lib/audit/run.ts : utilisé par le diagnostic du matin et le rapport du lundi (comptes coupés ignorés).
- `/rapports/impact` + lib/reports/impact.ts : Δ dépense = effet clics + effet CPC, Δ conversions = effet clics + effet taux (décomposition exacte), écarts par campagne, effet de chaque modification (7 ou 14 j avant/après, verdict).
- Correctifs éditeur de rapport : formulaire non collant, cases à cocher 16 px, sauts de page PDF.

### 2026-10-06 — Cowork (Phase 5a : rapports clients)
- Migration `0019_client_reports.sql` : tables `report_folders` et `client_reports` (RLS sans policy, accès service_role).
- `lib/reports/` : periods.ts (Hier, 7 j, semaine dernière, 14 j, ce mois, 30 j, mois dernier, 60 j, 90 j), data.ts (`buildReport`, 0 crédit IA), changes.ts (change_event regroupé en phrases, 30 j max), store.ts.
- `components/ReportView.tsx` (rendu partagé éditeur / lien public), styles `.rv*` dans globals.css (clair/sombre + impression).
- Pages : `/rapports` (dossiers), `/rapports/[id]` (éditeur + aperçu), `/rapports/compte-rendu`, `/r/[token]` (public, noindex, période modifiable par le client si cochée).
- middleware : `/r` en accès public. Menu : entrée « Rapports ».

### 2026-10-06 — Cowork (Copilote simplifié façon Ades)
- Copilote en LECTURE SEULE (allowWrite: false) + system prompt revu ; bibliothèque de 8 prompts en cartes,
  exemples de questions, historique des conversations (localStorage, par compte), « Enrichir l'agent »
  (contexte du compte : `lib/account-context.ts`, API `/api/copilote/context`, réglage `account_context:<customerId>`)
- Menu : « Agent IA » et « Templates » masqués (routes et données conservées) ; accueil renvoie vers Diagnostic et Scripts
- Missions quotidiennes coupées : cron `/api/cron/agent` retiré de vercel.json
- Rapport du lundi : `lib/weekly.ts` + cron `/api/cron/weekly` (lundi 6 h UTC), l'IA rédige à partir des scripts
  « Le point de la période » et « Match des campagnes » + priorités du diagnostic (~1 crédit/compte)

### 2026-10-06 — Cowork (Scripts, lots 2 et 3 : 98/98)
- lot2.ts (34) : CPC/CPA, mots-clés, recherches, rapports, enchères ; lot3.ts (33) : annonces, conversions,
  audiences, PMax, Display/Shopping, géographie, tendances 4 semaines, liens cassés, analyse IA des recherches
- `confirm` sur ScriptDef : exécution sur clic seulement (liens cassés = lent ; analyse IA = crédits, plafond owner vérifié)
- Négatifs bloquants vérifié sur D2B : 0 conflit correct (négatif « la garde » retiré depuis le matin)

### 2026-10-06 — Cowork (Scripts, lot 1)
- `lib/scripts/` : types, helpers, format (CSV ; Excel FR), registry, lot1-structure (12), lot1-performance (19)
- Pages `/scripts` (catalogue, recherche, filtres) et `/scripts/[id]` (compte, 7/30/90 j, tableau, export CSV)
- Les templates IA existants sont conservés : complémentaires (IA = commentaire, scripts = chiffres)
- Diagnostic : seuil « à surveiller » des recherches abaissé à 0,5 × CPA (comptes à CPA élevé)
- Reste : 67 scripts (CPC/CPA, annonces, audiences, PMax, Display/Shopping, rapports, liens cassés, analyse IA)

### 2026-10-06 — Cowork (Diagnostic phase 1)
- Moteur `lib/audit/` : types, fetch (11 requêtes GAQL isolées, un échec n'arrête pas les autres),
  rules (règles pures), negatives (conflits négatifs/mots-clés), mock, run (orchestration + stockage)
- Catégories : Recherches, Mots-clés (sans conversion, QS ≤ 3), Négatifs (conflits campagne / groupe /
  listes partagées), Budgets (limitée par le budget, campagne sans conversion, perte au classement),
  Annonces et extensions (refusées / limitées), Réglages et suivi (aucune action de conversion,
  0 conversion sur 7 j, 0 sur 30 j)
- Santé /100 : critique −15, important −5, mineur −1, plafond −20 par catégorie
- Testé sur un scénario reproduisant les constats Ades de D2B : mêmes problèmes trouvés, santé 72
- Page /waste renommée « Diagnostic » (onglets par catégorie, choix du compte), cron = diagnostic complet
- `searchRaw()` exporté dans lib/google-ads/client.ts pour les requêtes d'analyse

### 2026-10-06 — Cowork (usage interne + Waste Detector)
- Inspiré d'Ades Analytics : Waste Detector déterministe (lib/waste/detect.ts), 0 crédit IA
  - Seuil statistique : P(0 conv | clics, taux du compte) < 5 % → "prouvé"
  - Niveau "à surveiller" (coût ≥ 1,5 × CPA) pour les petits comptes artisans
  - Intentions négatives métier : emploi, formation, bricolage, gratuit, achat matériel
  - Totaux calculés sur l'union des termes (pas de double comptage)
- `getAllSearchTerms` (lib/google-ads/client.ts) + `MOCK_SEARCH_TERMS` (scénario plombier)
- Cron quotidien `/api/cron/waste` (5 h UTC), email Resend seulement s'il y a un constat
- Page `/waste` (owner uniquement) + bouton « Analyser maintenant » + entrée de menu « Gaspillage »
- Table `waste_reports` (migration 0018, RLS sans policy = service_role uniquement)
- Mode usage interne (`lib/internal.ts`) : `/register` et `/pricing` redirigés, non-owners sans IA
- Plafond IA owner `OWNER_MONTHLY_BUDGET_EUR` (en €, converti en $ ; défaut 5 $), appliqué aussi aux appels sans workspace
  (token partagé, tâches globales du cron) via `getGlobalBilling()` — avant : illimité
- Tarif Haiku 4.5 corrigé dans cost.ts (1 $ / 5 $ par M tokens), repli prudent au tarif Sonnet
- Rien n'écrit dans Google Ads : les négatifs proposés s'appliquent à la main

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
