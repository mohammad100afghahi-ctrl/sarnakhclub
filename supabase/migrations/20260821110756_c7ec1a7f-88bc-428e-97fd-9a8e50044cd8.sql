ALTER TABLE public.game_suggestions
  ADD COLUMN IF NOT EXISTS min_players integer,
  ADD COLUMN IF NOT EXISTS max_players integer,
  ADD COLUMN IF NOT EXISTS age_rating text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer;