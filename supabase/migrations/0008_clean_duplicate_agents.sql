-- Supprime les agents qui doublonnent les templates pro ajoutés en 0003.
-- "Suggestions de mots-clés négatifs" → couvert par "Mots-clés négatifs prioritaires" + "Requêtes hors-cible"
-- "Opportunités de budget"             → couvert par "Rééquilibrage des budgets" + "Où réinvestir en priorité" + "Où couper les dépenses"
DELETE FROM public.agent_tasks WHERE name = 'Suggestions de mots-clés négatifs';
DELETE FROM public.agent_tasks WHERE name = 'Opportunités de budget';
