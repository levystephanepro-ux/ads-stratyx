-- =====================================================================
-- ads-stratyx — Templates & Agents éditables
-- templates   : bibliothèque de prompts modifiables (skills réutilisables)
-- agent_tasks : missions de l'Agent IA créées/éditées depuis l'interface
--
-- Phase mono-utilisateur : pas de workspace_id ni de policy publique. Seul le
-- serveur (clé service_role, hors RLS) lit/écrit ces tables ; l'accès est protégé
-- côté application par le token partagé (MCP_SHARED_TOKEN). Le multi-utilisateur
-- (workspace_id + RLS) sera ajouté le jour où on branche l'authentification.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- templates ----------
create table if not exists public.templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  category    text not null default 'Général',
  prompt      text not null,
  icon        text not null default '📋',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS activée SANS policy : bloque l'accès via la clé anonyme (navigateur).
-- Le serveur utilise la clé service_role, qui contourne la RLS.
alter table public.templates enable row level security;

-- ---------- agent_tasks ----------
create table if not exists public.agent_tasks (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text not null default '',
  prompt       text not null,
  frequency    text not null default 'daily',   -- 'daily' | 'weekly'
  day_of_week  int,                              -- 0=dimanche … 6=samedi (weekly)
  enabled      boolean not null default true,
  allow_write  boolean not null default false,   -- l'agent peut-il modifier ? défaut non
  last_run_at  timestamptz,
  last_status  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.agent_tasks enable row level security;

-- ---------- Bibliothèque de départ (seed uniquement si vide) ----------
insert into public.templates (name, description, category, prompt, icon)
select v.name, v.description, v.category, v.prompt, v.icon
from (values
  ($$Audit quotidien$$,
   $$État des campagnes actives, dépense, et alerte si quelque chose dérape.$$,
   $$Analyse$$,
   $$Fais-moi un point rapide sur mes campagnes Google Ads. Liste les comptes gérés, puis pour le compte principal regarde les campagnes et leur performance sur les 7 derniers jours. Signale toute anomalie : campagne qui dépense sans convertir, chute ou explosion de coût, ROAS faible. Si tout est normal, dis-le en une phrase.$$,
   $$🌅$$),
  ($$Rapport de performance hebdo$$,
   $$Synthèse chiffrée de la semaine (coût, conversions, ROAS) et tendance.$$,
   $$Reporting$$,
   $$Rédige le rapport de performance de mon compte Google Ads principal sur les 7 derniers jours : coût total, conversions, valeur, CPA et ROAS, sous forme de tableau. Compare aux 7 jours précédents et indique la tendance. Conclus par les 2-3 points d'attention de la semaine.$$,
   $$📊$$),
  ($$Chasse au gaspillage$$,
   $$Termes de recherche et groupes d'annonces qui dépensent sans convertir.$$,
   $$Optimisation$$,
   $$Analyse les 30 derniers jours de mon compte principal. Identifie les termes de recherche et groupes d'annonces qui ont dépensé sans générer de conversion. Donne la liste priorisée (du plus coûteux au moins coûteux) avec, pour chacun, le montant gaspillé et l'action recommandée.$$,
   $$🗑️$$),
  ($$Suggestions de mots-clés négatifs$$,
   $$Repère les requêtes hors-cible à exclure pour arrêter de payer pour rien.$$,
   $$Optimisation$$,
   $$Analyse les termes de recherche des 30 derniers jours. Repère les requêtes hors-sujet ou qui n'ont jamais converti malgré des clics. Propose une liste de mots-clés négatifs à ajouter, groupés par thème, avec le budget consommé par chacun.$$,
   $$🚫$$),
  ($$Opportunités de budget$$,
   $$Où mettre plus (ce qui performe) et où couper (ce qui gaspille).$$,
   $$Optimisation$$,
   $$Analyse la performance de mes campagnes sur 30 jours. Identifie 1) les campagnes rentables qui mériteraient plus de budget, 2) les campagnes qui dépensent beaucoup pour peu de résultats et où réduire. Recommandations chiffrées et priorisées. Tu ne fais que recommander.$$,
   $$💰$$),
  ($$Bilan tous comptes$$,
   $$Vue d'ensemble de tous les comptes gérés en un coup d'œil.$$,
   $$Reporting$$,
   $$Liste tous les comptes Google Ads gérés. Pour chacun, donne un résumé très court de la performance des 7 derniers jours (coût, conversions, ROAS) sous forme de tableau. Termine par quel compte a besoin d'attention en priorité.$$,
   $$🌐$$)
) as v(name, description, category, prompt, icon)
where not exists (select 1 from public.templates);

-- Agents de départ : les 3 missions programmées (pour que le cron continue).
insert into public.agent_tasks (name, description, prompt, frequency, day_of_week, enabled)
select v.name, v.description, v.prompt, v.frequency, v.day_of_week, true
from (values
  ($$Audit quotidien des campagnes$$,
   $$Chaque matin : état des campagnes, dépense, alerte si ça dérape.$$,
   $$Fais-moi un point rapide sur mes campagnes Google Ads. Liste les comptes gérés, puis pour le compte principal regarde les campagnes et leur performance sur les 7 derniers jours. Signale toute anomalie. Si tout est normal, dis-le en une phrase.$$,
   $$daily$$, null::int),
  ($$Rapport de performance hebdomadaire$$,
   $$Chaque lundi : synthèse chiffrée de la semaine et tendance.$$,
   $$Rédige le rapport de performance de mon compte principal sur les 7 derniers jours : coût, conversions, valeur, CPA, ROAS en tableau. Compare aux 7 jours précédents et indique la tendance. Conclus par les points d'attention.$$,
   $$weekly$$, 1),
  ($$Chasse au gaspillage$$,
   $$Chaque jeudi : ce qui dépense sans convertir.$$,
   $$Analyse les 30 derniers jours de mon compte principal. Identifie les termes de recherche et groupes d'annonces qui dépensent sans convertir. Liste priorisée avec montant gaspillé et action recommandée.$$,
   $$weekly$$, 4)
) as v(name, description, prompt, frequency, day_of_week)
where not exists (select 1 from public.agent_tasks);
