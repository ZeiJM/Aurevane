begin;

-- Supabase may install this public SECURITY DEFINER event-trigger helper outside
-- AUREVANE's own migration history. It must never be callable by browser roles.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

commit;
