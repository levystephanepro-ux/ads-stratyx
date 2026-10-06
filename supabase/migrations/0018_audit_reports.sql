-- =====================================================================
-- ads-stratyx — Diagnostic quotidien : un rapport par compte et par jour.
-- Écrit uniquement par le serveur (clé service_role) : RLS activée sans
-- policy = aucun accès direct depuis le navigateur.
-- =====================================================================
create table if not exists public.audit_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  customer_id text not null,
  account_name text,
  run_date date not null default current_date,
  health_score int,
  total_cost numeric,
  conversions numeric,
  waste_proven numeric,
  waste_watch numeric,
  constats jsonb not null default '[]'::jsonb,
  skipped jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists audit_reports_uniq
  on public.audit_reports (workspace_id, customer_id, run_date) nulls not distinct;

create index if not exists audit_reports_recent
  on public.audit_reports (customer_id, run_date desc);

alter table public.audit_reports enable row level security;
