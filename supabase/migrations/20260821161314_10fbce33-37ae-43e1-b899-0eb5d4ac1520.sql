-- 1) Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.sync_review_votes() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.primary_admin_id() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.is_primary_admin(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
-- RLS policies evaluate these as the calling role, so keep the minimum grants required
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_primary_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.primary_admin_id() TO authenticated;

-- 2) game_tags: only admins may attach tags
DROP POLICY IF EXISTS game_tags_insert ON public.game_tags;
CREATE POLICY game_tags_admin_insert ON public.game_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id)
    AND EXISTS (SELECT 1 FROM public.tags t WHERE t.id = tag_id AND t.status = 'approved')
  );

-- 3) posters bucket: owners and admins only (signed URLs still work for public display)
DROP POLICY IF EXISTS posters_auth_read ON storage.objects;
CREATE POLICY posters_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'posters'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );