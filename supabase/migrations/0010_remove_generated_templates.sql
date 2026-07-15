-- Supprime les 47 templates générés automatiquement (migrations 0002 + 0003).
-- Garde uniquement les templates ajoutés manuellement via l'interface.

DELETE FROM public.templates WHERE name IN (
  -- 0002 : 6 templates de démarrage
  'Audit quotidien',
  'Rapport de performance hebdo',
  'Chasse au gaspillage',
  'Suggestions de mots-clés négatifs',
  'Opportunités de budget',
  'Bilan tous comptes',

  -- 0003 Reporting (6)
  'Rapport quotidien express',
  'Rapport mensuel complet',
  'Comparatif semaine A / B',
  'Top & flop du mois',
  'Synthèse pour le client',
  'Tableau de bord KPI',

  -- 0003 Audit (8)
  'Audit express (5 min)',
  'Audit complet du compte',
  'Analyse du ROAS',
  'Analyse du CPA',
  'Analyse du CTR',
  'Santé des campagnes actives',
  'Analyse de la structure du compte',
  'Analyse des taux de conversion',

  -- 0003 Optimisation (7)
  'Campagnes à mettre en pause',
  'Ad groups sous-performants',
  'Nettoyage des campagnes inactives',
  'Rééquilibrage des budgets',
  'Réduction du CPA',
  'Quick wins de la semaine',
  'Revue des campagnes coûteuses',

  -- 0003 Mots-clés (6)
  'Mots-clés négatifs prioritaires',
  'Requêtes qui convertissent le mieux',
  'Requêtes hors-cible',
  'Nouvelles idées de mots-clés',
  'Termes de recherche les plus coûteux',
  'Analyse d''intention des requêtes',

  -- 0003 Budget (5)
  'Campagnes limitées par le budget',
  'Où réinvestir en priorité',
  'Où couper les dépenses',
  'Projection de dépense mensuelle',
  'Répartition du budget par type',

  -- 0003 Alertes (5)
  'Alerte : dépense sans conversion',
  'Alerte : chute de conversions',
  'Alerte : explosion du coût',
  'Alerte : ROAS en baisse',
  'Surveillance quotidienne',

  -- 0003 Stratégie (4)
  'Plan d''action 30 jours',
  'Recommandations de croissance',
  'Idées de nouvelles campagnes',
  'Bilan et cap du trimestre'
);

-- Supprime les agent_tasks "à la demande" copiés depuis ces templates (0004).
-- "Chasse au gaspillage" exclu : c'est aussi le nom d'un agent programmé actif.
DELETE FROM public.agent_tasks WHERE enabled = false AND name IN (
  'Audit quotidien',
  'Rapport de performance hebdo',
  'Suggestions de mots-clés négatifs',
  'Opportunités de budget',
  'Bilan tous comptes',
  'Rapport quotidien express',
  'Rapport mensuel complet',
  'Comparatif semaine A / B',
  'Top & flop du mois',
  'Synthèse pour le client',
  'Tableau de bord KPI',
  'Audit express (5 min)',
  'Audit complet du compte',
  'Analyse du ROAS',
  'Analyse du CPA',
  'Analyse du CTR',
  'Santé des campagnes actives',
  'Analyse de la structure du compte',
  'Analyse des taux de conversion',
  'Campagnes à mettre en pause',
  'Ad groups sous-performants',
  'Nettoyage des campagnes inactives',
  'Rééquilibrage des budgets',
  'Réduction du CPA',
  'Quick wins de la semaine',
  'Revue des campagnes coûteuses',
  'Mots-clés négatifs prioritaires',
  'Requêtes qui convertissent le mieux',
  'Requêtes hors-cible',
  'Nouvelles idées de mots-clés',
  'Termes de recherche les plus coûteux',
  'Analyse d''intention des requêtes',
  'Campagnes limitées par le budget',
  'Où réinvestir en priorité',
  'Où couper les dépenses',
  'Projection de dépense mensuelle',
  'Répartition du budget par type',
  'Alerte : dépense sans conversion',
  'Alerte : chute de conversions',
  'Alerte : explosion du coût',
  'Alerte : ROAS en baisse',
  'Surveillance quotidienne',
  'Plan d''action 30 jours',
  'Recommandations de croissance',
  'Idées de nouvelles campagnes',
  'Bilan et cap du trimestre'
);
