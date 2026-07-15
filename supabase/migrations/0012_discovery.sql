-- Module Discovery Client : sessions de découverte client (media buyer → artisan/TPE).
-- Stocke la session complète : réponses, personas générés, config campagne, outputs duaux.

CREATE TABLE IF NOT EXISTS public.discovery_sessions (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name   TEXT        NOT NULL DEFAULT '',
  client_city   TEXT        NOT NULL DEFAULT '',
  segment       TEXT,                              -- 'artisan' | 'commercant' | 'tpe'
  answers       JSONB       NOT NULL DEFAULT '{}', -- réponses aux questions
  preflight     JSONB,                             -- analyse pré-vol IA
  artisan_view  TEXT,                              -- texte simple généré pour le client
  personas      JSONB,                             -- PersonaData[]
  score         INTEGER,                           -- /100
  qualification TEXT,                              -- 'green' | 'yellow' | 'red'
  red_flags     JSONB,                             -- string[]
  campaign_config JSONB,
  roi_projection  JSONB,
  status        TEXT        NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'complete'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS discovery_sessions_status_idx ON public.discovery_sessions (status);
CREATE INDEX IF NOT EXISTS discovery_sessions_created_idx ON public.discovery_sessions (created_at DESC);
