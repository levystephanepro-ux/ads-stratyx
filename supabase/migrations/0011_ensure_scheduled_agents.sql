-- Garantit que les 3 agents programmés existent et sont actifs.
-- La seed de 0002 ne s'exécute que si agent_tasks est vide — si elle a été ratée,
-- ces agents n'existent pas. On les insère s'ils manquent, et on les réactive sinon.

-- 1. Réactive ceux qui existent mais sont désactivés
UPDATE public.agent_tasks
SET enabled = true
WHERE name IN (
  'Audit quotidien des campagnes',
  'Rapport de performance hebdomadaire',
  'Chasse au gaspillage'
);

-- 2. Insère ceux qui manquent complètement
INSERT INTO public.agent_tasks (name, description, prompt, frequency, day_of_week, enabled, model, run_hour_utc, allow_write)
SELECT v.name, v.description, v.prompt, v.frequency, v.day_of_week, true,
       'claude-haiku-4-5-20251001', 7, false
FROM (VALUES
  (
    'Audit quotidien des campagnes',
    'Chaque matin : état des campagnes actives, dépense du jour, et alerte si quelque chose dérape.',
    'Fais-moi un point rapide sur mes campagnes Google Ads. Liste les comptes gérés, puis pour le compte principal regarde les campagnes et leur performance sur les 7 derniers jours. Signale toute anomalie : campagne qui dépense sans convertir, chute ou explosion de coût, ROAS faible. Si tout est normal, dis-le en une phrase.',
    'daily', null::int
  ),
  (
    'Rapport de performance hebdomadaire',
    'Chaque lundi : synthèse chiffrée de la semaine (coût, conversions, ROAS) et tendance.',
    'Rédige le rapport de performance de mon compte Google Ads principal sur les 7 derniers jours : coût total, conversions, valeur, CPA et ROAS, sous forme de tableau. Compare aux 7 jours précédents et indique la tendance (hausse/baisse). Conclus par les 2-3 points d''attention de la semaine.',
    'weekly', 1
  ),
  (
    'Chasse au gaspillage',
    'Chaque jeudi : les termes de recherche et groupes d''annonces qui dépensent sans convertir.',
    'Analyse les 30 derniers jours de mon compte Google Ads principal. Identifie les termes de recherche et les groupes d''annonces qui ont dépensé de l''argent SANS générer de conversion. Donne-moi la liste priorisée (du plus coûteux au moins coûteux) avec, pour chaque, le montant gaspillé et l''action recommandée (mot-clé négatif à ajouter, ad group à mettre en pause, etc.).',
    'weekly', 4
  )
) AS v(name, description, prompt, frequency, day_of_week)
WHERE NOT EXISTS (
  SELECT 1 FROM public.agent_tasks a WHERE a.name = v.name
);
