create table if not exists public.personas (
  id              uuid primary key default gen_random_uuid(),
  user_token      text not null,

  -- Section 1 — Identité
  prenom          text,
  age             text,
  genre           text,
  localisation    text,

  -- Section 2 — Socio-pro
  situation_pro   text,
  revenu          text,

  -- Section 3 — Psychographie
  moteurs_achat   text[],
  frustrations    text,
  aspirations     text,
  valeur_cardinale text,

  -- Section 4 — Media
  plateformes     text[],
  type_contenu    text[],
  rapport_pub     text,

  -- Section 5 — Stratégie ads
  objectif_campagne text,
  tunnel          text,
  ton_creatif     text[],
  format_pub      text,

  -- Section 6 — Marque
  secteur_produit text,
  proposition_valeur text,
  a_eviter        text,

  -- Sortie IA
  persona_genere  jsonb,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists personas_user_token_idx on public.personas(user_token);
create index if not exists personas_created_at_idx on public.personas(created_at desc);

alter table public.personas enable row level security;

create policy "Users can read own personas"
  on public.personas for select
  using (user_token = current_setting('request.headers', true)::json->>'x-user-token');

create policy "Users can insert own personas"
  on public.personas for insert
  with check (true);

create policy "Users can update own personas"
  on public.personas for update
  using (user_token = current_setting('request.headers', true)::json->>'x-user-token');

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger personas_updated_at
  before update on public.personas
  for each row execute function update_updated_at();
