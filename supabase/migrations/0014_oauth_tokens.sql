create table if not exists public.oauth_tokens (
  id           uuid        primary key default gen_random_uuid(),
  workspace_token text     not null,
  service      text        not null,
  refresh_token text       not null,
  account_email text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_token, service)
);

alter table public.oauth_tokens enable row level security;
-- Seul le service_role peut accéder (accès admin uniquement, pas d'anon/authenticated).
