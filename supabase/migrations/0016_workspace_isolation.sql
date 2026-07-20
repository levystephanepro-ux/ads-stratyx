-- Isole les agent_tasks et app_settings par workspace.
-- Les templates restent globaux (bibliothèque partagée).

ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Index pour les requêtes filtrées par workspace
CREATE INDEX IF NOT EXISTS idx_agent_tasks_workspace ON public.agent_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_workspace ON public.app_settings(workspace_id);
