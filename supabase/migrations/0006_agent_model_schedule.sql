-- Migration 0006 : modèle IA + heure d'exécution + fréquence mensuelle par agent
ALTER TABLE agent_tasks
  ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  ADD COLUMN IF NOT EXISTS run_hour_utc INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS day_of_month INTEGER;
