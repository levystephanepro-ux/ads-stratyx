-- ads-stratyx — Nom et téléphone du contact sur la fiche client.
alter table public.clients add column if not exists contact_name text;
alter table public.clients add column if not exists contact_phone text;
