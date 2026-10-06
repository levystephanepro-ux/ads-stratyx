-- =====================================================================
-- ads-stratyx — Rapports clients : dossiers (un par client) et rapports.
-- Écrits uniquement par le serveur (clé service_role) : RLS activée sans
-- policy. Le lien public d'un rapport passe par share_token (aléatoire).
-- =====================================================================
create table if not exists public.report_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  customer_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.client_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  folder_id uuid references public.report_folders(id) on delete set null,
  customer_id text not null,
  account_name text,
  title text,
  template text not null default 'mensuel',
  mode text not null default 'leadgen',
  theme text not null default 'clair',
  period text not null default '30',
  compare boolean not null default true,
  client_period boolean not null default true,
  intro text,
  analysis text,
  optimisations text,
  sections jsonb not null default '[]'::jsonb,
  share_token text not null unique,
  author text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_reports_folder on public.client_reports (folder_id);

alter table public.report_folders enable row level security;
alter table public.client_reports enable row level security;
