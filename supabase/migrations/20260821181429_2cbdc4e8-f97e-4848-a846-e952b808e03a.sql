CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.primary_admin_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ur.user_id FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY p.created_at ASC, ur.user_id ASC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_primary_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND _user_id = private.primary_admin_id()
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.primary_admin_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_primary_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.primary_admin_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_primary_admin(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
  USING ((id = auth.uid()) OR private.has_role(auth.uid(), 'admin')) WITH CHECK (true);

DROP POLICY IF EXISTS roles_read_self ON public.user_roles;
CREATE POLICY roles_read_self ON public.user_roles FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS roles_read_all_admin ON public.user_roles;
CREATE POLICY roles_read_all_admin ON public.user_roles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS roles_primary_admin_insert ON public.user_roles;
CREATE POLICY roles_primary_admin_insert ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (private.is_primary_admin(auth.uid()));

DROP POLICY IF EXISTS roles_primary_admin_delete ON public.user_roles;
CREATE POLICY roles_primary_admin_delete ON public.user_roles FOR DELETE TO authenticated
  USING (private.is_primary_admin(auth.uid()) AND (user_id <> private.primary_admin_id()));

DROP POLICY IF EXISTS games_read ON public.games;
CREATE POLICY games_read ON public.games FOR SELECT
  USING ((status = 'active') OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS games_admin_write ON public.games;
CREATE POLICY games_admin_write ON public.games FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS tags_read ON public.tags;
CREATE POLICY tags_read ON public.tags FOR SELECT
  USING ((status = 'approved') OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS tags_admin ON public.tags;
CREATE POLICY tags_admin ON public.tags FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS game_tags_admin_del ON public.game_tags;
CREATE POLICY game_tags_admin_del ON public.game_tags FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS game_tags_admin_insert ON public.game_tags;
CREATE POLICY game_tags_admin_insert ON public.game_tags FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin') AND (created_by = auth.uid())
    AND EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_tags.game_id)
    AND EXISTS (SELECT 1 FROM public.tags t WHERE t.id = game_tags.tag_id AND t.status = 'approved'));

DROP POLICY IF EXISTS reviews_own ON public.reviews;
CREATE POLICY reviews_own ON public.reviews FOR ALL TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS sugg_own ON public.game_suggestions;
CREATE POLICY sugg_own ON public.game_suggestions FOR ALL TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS reports_admin ON public.review_reports;
CREATE POLICY reports_admin ON public.review_reports FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS settings_admin ON public.site_settings;
CREATE POLICY settings_admin ON public.site_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS feedback_read ON public.feedback;
CREATE POLICY feedback_read ON public.feedback FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS feedback_admin_update ON public.feedback;
CREATE POLICY feedback_admin_update ON public.feedback FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS feedback_admin_delete ON public.feedback;
CREATE POLICY feedback_admin_delete ON public.feedback FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS posters_admin_delete ON storage.objects;
CREATE POLICY posters_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'posters' AND private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS posters_admin_insert ON storage.objects;
CREATE POLICY posters_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posters' AND private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS posters_admin_update ON storage.objects;
CREATE POLICY posters_admin_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'posters' AND private.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'posters' AND private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS posters_owner_read ON storage.objects;
CREATE POLICY posters_owner_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'posters' AND (((storage.foldername(name))[1] = (auth.uid())::text) OR private.has_role(auth.uid(), 'admin')));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_primary_admin(uuid);
DROP FUNCTION IF EXISTS public.primary_admin_id();

CREATE OR REPLACE FUNCTION public.primary_admin_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.primary_admin_id()
$$;
REVOKE ALL ON FUNCTION public.primary_admin_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.primary_admin_id() TO authenticated, service_role;