-- =====================================================================
-- ads-stratyx — offre multi-clients viable
-- 1) app_settings : la PK était sur `key` seul → deux workspaces qui
--    enregistrent la même clé (ex. default_customer_id) s'écrasaient.
--    On passe à une unicité (key, workspace_id), NULL compris.
-- =====================================================================

-- Retire la PK sur key et la remplace par un id technique.
alter table public.app_settings drop constraint if exists app_settings_pkey;
alter table public.app_settings add column if not exists id uuid default gen_random_uuid();
update public.app_settings set id = gen_random_uuid() where id is null;
alter table public.app_settings alter column id set not null;
alter table public.app_settings add primary key (id);

-- Unicité par (key, workspace_id) — NULLS NOT DISTINCT pour que la ligne
-- "globale" (workspace_id null) soit elle aussi unique. Requiert Postgres 15+.
create unique index if not exists app_settings_key_ws_uniq
  on public.app_settings (key, workspace_id) nulls not distinct;
