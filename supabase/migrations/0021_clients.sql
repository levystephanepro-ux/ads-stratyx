-- =====================================================================
-- ads-stratyx — Fiches clients + questionnaire de découverte.
-- Écrit uniquement par le serveur (service_role) : RLS sans policy.
-- Le lien public du questionnaire passe par share_token (aléatoire).
-- =====================================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  customer_id text,
  website text,
  contact_email text,
  notes text,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'a_envoyer',
  submitted_at timestamptz,
  share_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_customer on public.clients (customer_id);
alter table public.clients enable row level security;
