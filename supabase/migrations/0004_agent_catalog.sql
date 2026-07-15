-- =====================================================================
-- ads-stratyx — Catalogue d'agents
-- Peuple agent_tasks à partir de la bibliothèque de templates : chaque template
-- devient un agent « à la demande » (enabled = false → ne s'exécute PAS tout seul,
-- pas d'email automatique tant que tu ne l'actives pas).
-- Idempotent : n'ajoute que les agents dont le nom n'existe pas encore.
-- Les 3 agents programmés d'origine ne sont pas touchés.
-- =====================================================================

insert into public.agent_tasks (name, description, prompt, frequency, day_of_week, enabled, allow_write)
select t.name, t.description, t.prompt, 'daily', null::int, false, false
from public.templates t
where not exists (
  select 1 from public.agent_tasks a where a.name = t.name
);
