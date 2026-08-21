CREATE TABLE public.played_games (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.played_games TO authenticated;
GRANT SELECT ON public.played_games TO anon;
GRANT ALL ON public.played_games TO service_role;
ALTER TABLE public.played_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY played_read ON public.played_games FOR SELECT USING (true);
CREATE POLICY played_own ON public.played_games FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());