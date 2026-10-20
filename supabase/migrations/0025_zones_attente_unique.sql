-- =====================================================================
-- ads-stratyx : une seule inscription par client, activité et adresse sur la liste d'attente.
-- À lancer dans Supabase. Le code fonctionne aussi sans (contrôle avant insertion) : cet index referme
-- seulement la fenêtre de deux clics simultanés.
-- =====================================================================

-- Doublons éventuels : on garde la plus ancienne inscription.
delete from public.zones_attente a
using public.zones_attente b
where a.client_id = b.client_id
  and a.activite = b.activite
  and lower(btrim(a.adresse)) = lower(btrim(b.adresse))
  and (a.created_at, a.id) > (b.created_at, b.id);

create unique index if not exists zones_attente_client_activite_adresse
  on public.zones_attente (client_id, activite, lower(btrim(adresse)));
