DROP VIEW IF EXISTS public.game_rankings;
CREATE VIEW public.game_rankings
WITH (security_invoker = true) AS
WITH agg AS (
  SELECT g.id, COALESCE(avg(r.score),0)::numeric AS raw_avg, count(r.id)::int AS votes
  FROM public.games g LEFT JOIN public.ratings r ON r.game_id = g.id
  WHERE g.status = 'active'
  GROUP BY g.id
), consts AS (
  SELECT (SELECT COALESCE(avg(score), 7) FROM public.ratings) AS c,
         (SELECT value FROM public.site_settings WHERE key='min_votes') AS m
)
SELECT g.*, a.raw_avg, a.votes, consts.m AS min_votes,
  ROUND((a.votes / (a.votes + consts.m)::numeric) * a.raw_avg
      + (consts.m / (a.votes + consts.m)::numeric) * consts.c, 2) AS weighted_score
FROM public.games g
JOIN agg a ON a.id = g.id
CROSS JOIN consts;
GRANT SELECT ON public.game_rankings TO anon, authenticated, service_role;