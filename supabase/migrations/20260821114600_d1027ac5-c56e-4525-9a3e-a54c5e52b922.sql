ALTER TABLE public.games ADD COLUMN IF NOT EXISTS duration_max_minutes integer;
ALTER TABLE public.game_suggestions ADD COLUMN IF NOT EXISTS duration_max_minutes integer;