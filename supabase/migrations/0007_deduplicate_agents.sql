-- =====================================================================
-- Migration 0007 — Dédoublonnage des agents + affectation des modèles IA
-- =====================================================================

-- 1. Supprimer les agents créés par 0004 qui doublonnent les 3 agents programmés d'origine.
--    On garde les programmés (enabled=true) et on retire les copies à la demande (enabled=false).
DELETE FROM public.agent_tasks
WHERE name = 'Audit quotidien'
  AND enabled = false;

DELETE FROM public.agent_tasks
WHERE name = 'Rapport de performance hebdo'
  AND enabled = false;

-- "Suggestions de mots-clés négatifs" (0002) + "Mots-clés négatifs prioritaires" (0003/0004)
-- On garde "Mots-clés négatifs prioritaires" (plus précis, venu de la lib 40 templates)
-- et on retire l'ancien de 0002.
DELETE FROM public.agent_tasks
WHERE name = 'Suggestions de mots-clés négatifs';

-- 2. Corriger les valeurs NULL sur les colonnes ajoutées par 0006
--    (les lignes insérées avant la migration n'ont pas de valeur explicite).
UPDATE public.agent_tasks
SET
  model        = 'claude-haiku-4-5-20251001',
  run_hour_utc = 7
WHERE model IS NULL OR model = '';

-- 3. Assigner Sonnet 5 aux tâches complexes (analyse en profondeur, stratégie).
--    Toutes les autres restent sur Haiku 4.5 (rapide + économique).
UPDATE public.agent_tasks
SET model = 'claude-sonnet-5'
WHERE name IN (
  'Audit complet du compte',
  'Analyse de la structure du compte',
  'Plan d''action 30 jours',
  'Recommandations de croissance',
  'Bilan et cap du trimestre',
  'Rapport mensuel complet',
  'Réduction du CPA',
  'Rééquilibrage des budgets'
);
