GRANT SELECT ON public.game_rankings TO anon, authenticated;
GRANT ALL ON public.game_rankings TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;