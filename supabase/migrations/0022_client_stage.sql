-- ads-stratyx — Étape commerciale de chaque fiche client (pipeline).
alter table public.clients add column if not exists stage text not null default 'prospect';
