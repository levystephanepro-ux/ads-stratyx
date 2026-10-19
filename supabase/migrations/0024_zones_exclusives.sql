-- =====================================================================
-- ads-stratyx : zones d'exclusivité par rayon autour de l'établissement.
-- Centre de zone = adresse de l'établissement (fiche Google Business).
-- Écrit uniquement par le serveur (service_role) : RLS sans policy,
-- comme 0021. L'adresse d'un client n'est jamais exposée publiquement.
-- =====================================================================

create table if not exists public.zones_exclusives (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  activite text not null,
  adresse text not null,
  commune text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  source_coordonnees text not null default 'ban'
    check (source_coordonnees in ('ban', 'fiche_google', 'manuel')),
  lien_fiche_google text,
  rayon_km numeric(5,1) not null check (rayon_km > 0 and rayon_km <= 100),
  statut text not null default 'gardee'
    check (statut in ('gardee', 'reserve', 'actif', 'liberation', 'libere')),
  -- gardee : fin des 7 jours ; liberation : fin des 30 jours ; sinon null
  expire_le timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists zones_exclusives_activite_statut
  on public.zones_exclusives (activite, statut);
create index if not exists zones_exclusives_client
  on public.zones_exclusives (client_id);
create index if not exists zones_exclusives_expire
  on public.zones_exclusives (expire_le)
  where statut in ('gardee', 'liberation');

alter table public.zones_exclusives enable row level security;

-- Liste d'attente : un prospect veut une zone aujourd'hui prise.
create table if not exists public.zones_attente (
  id uuid primary key default gen_random_uuid(),
  activite text not null,
  adresse text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  rayon_km numeric(5,1) not null check (rayon_km > 0 and rayon_km <= 100),
  client_id uuid references public.clients(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists zones_attente_activite
  on public.zones_attente (activite);

alter table public.zones_attente enable row level security;
