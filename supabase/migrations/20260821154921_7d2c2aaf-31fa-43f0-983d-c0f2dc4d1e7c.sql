REVOKE EXECUTE ON FUNCTION public.primary_admin_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_primary_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.primary_admin_id() FROM public;
REVOKE EXECUTE ON FUNCTION public.is_primary_admin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.primary_admin_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_primary_admin(uuid) TO authenticated;