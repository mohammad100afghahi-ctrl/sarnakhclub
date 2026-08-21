CREATE OR REPLACE FUNCTION public.primary_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY p.created_at ASC, ur.user_id ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_primary_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND _user_id = public.primary_admin_id()
$$;

GRANT EXECUTE ON FUNCTION public.primary_admin_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_primary_admin(uuid) TO anon, authenticated;

GRANT INSERT, DELETE ON public.user_roles TO authenticated;

DROP POLICY IF EXISTS roles_read_all_admin ON public.user_roles;
CREATE POLICY roles_read_all_admin ON public.user_roles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS roles_primary_admin_insert ON public.user_roles;
CREATE POLICY roles_primary_admin_insert ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.is_primary_admin(auth.uid()));

DROP POLICY IF EXISTS roles_primary_admin_delete ON public.user_roles;
CREATE POLICY roles_primary_admin_delete ON public.user_roles
FOR DELETE TO authenticated
USING (public.is_primary_admin(auth.uid()) AND user_id <> public.primary_admin_id());