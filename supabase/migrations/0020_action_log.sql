-- =====================================================================
-- ads-stratyx — Journal des corrections en un clic (phase 2).
-- Chaque action appliquée dans Google Ads est tracée avec de quoi l'annuler
-- (30 jours). Écrit uniquement par le serveur : RLS activée sans policy.
-- =====================================================================
create table if not exists public.action_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  customer_id text not null,
  account_name text,
  constat_id text,
  title text not null,
  summary text not null,
  fix jsonb not null,
  undo jsonb,
  status text not null default 'done',   -- done | undone | failed
  error text,
  author text,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

create index if not exists action_log_customer on public.action_log (customer_id, created_at desc);
alter table public.action_log enable row level security;
