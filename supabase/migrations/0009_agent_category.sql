-- Ajoute la colonne category sur agent_tasks et la peuple depuis templates (match par nom).
ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';

UPDATE public.agent_tasks a
SET category = t.category
FROM public.templates t
WHERE a.name = t.name AND t.category IS NOT NULL AND t.category <> '';
