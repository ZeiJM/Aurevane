begin;

-- Align clean installs with the existing server-only public identity projection.
-- EXP and the public portrait are read-only; browser grants, RLS and write authority stay intact.
grant select (xp, portrait_ref) on public.characters to service_role;

commit;
