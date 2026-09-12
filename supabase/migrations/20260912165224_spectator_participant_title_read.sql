-- Spectator identity decoration reads this projection through the server client.
-- Do not depend on provider bootstrap defaults or broaden browser-role access.
grant select (id, personal_title) on public.characters to service_role;
