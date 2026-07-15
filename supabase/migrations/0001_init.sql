-- =====================================================================
-- ads-stratyx — schéma initial
-- workspaces  : un espace par utilisateur (extensible en multi-sièges plus tard)
-- google_ads_connections : comptes Google Ads reliés (tokens OAuth)
-- mcp_tokens  : jetons que Claude présente pour s'authentifier au serveur MCP
-- Isolation par workspace via RLS (chaque user ne voit que ses données).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- workspaces ----------
create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null default 'Mon espace',
  created_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

create policy "workspaces: owner rw"
  on public.workspaces for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Crée automatiquement un workspace à la première connexion d'un utilisateur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.workspaces (owner_id, name)
  values (new.id, 'Mon espace');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- google_ads_connections ----------
create table if not exists public.google_ads_connections (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  customer_id      text not null,
  descriptive_name text,
  currency_code    text,
  time_zone        text,
  refresh_token    text,          -- à chiffrer avant la prod (Vault / KMS)
  is_default       boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (workspace_id, customer_id)
);

alter table public.google_ads_connections enable row level security;

create policy "ads connections: member rw"
  on public.google_ads_connections for all
  using (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  )
  with check (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );

-- ---------- mcp_tokens ----------
create table if not exists public.mcp_tokens (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token        text not null unique,
  label        text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.mcp_tokens enable row level security;

create policy "mcp tokens: member rw"
  on public.mcp_tokens for all
  using (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  )
  with check (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );

-- Note : le serveur MCP lit mcp_tokens avec la clé service_role (hors RLS),
-- car la requête vient de Claude et n'a pas de session utilisateur.
