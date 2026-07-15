-- =====================================================================
-- ads-stratyx — Réglages applicatifs (clé/valeur)
-- Sert notamment à mémoriser le compte Google Ads « par défaut » ciblé par le
-- Copilote et les Agents (parmi les comptes du MCC).
-- RLS activée sans policy : seul le serveur (service_role) y accède.
-- =====================================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
