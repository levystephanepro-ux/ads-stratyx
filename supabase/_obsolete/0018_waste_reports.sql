-- =====================================================================
-- ads-stratyx — Waste Detector : un rapport par compte et par jour.
-- Écrit uniquement par le serveur (clé service_role) : RLS activée sans
-- policy = aucun accès direct depuis le navigateur.
-- =====================================================================
create table if not exists public.waste_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  customer_id text not null,
  account_name text,
  run_date date not null default current_date,
  account_cvr numeric,
  cpa_ref numeric,
  total_cost numeric,
  waste_proven numeric,
  waste_watch numeric,
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists waste_reports_uniq
  on public.waste_reports (workspace_id, customer_id, run_date) nulls not distinct;

create index if not exists waste_reports_recent
  on public.waste_reports (customer_id, run_date desc);

alter table public.waste_reports enable row level security;
