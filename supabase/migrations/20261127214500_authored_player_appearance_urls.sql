begin;

create function app_private.valid_authored_player_appearance_url_v1(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_url ~ '^/api/media/appearance/7/(human|elf|fae|mountain-orc)-[fm]-(000[1-9]|00[1-9][0-9]|0[12][0-9]{2}|03[0-6][0-9]|037[0-5])[.]v[12]/neutral[.]svg$',
    false
  );
$$;

revoke all on function app_private.valid_authored_player_appearance_url_v1(text)
from public, anon, authenticated;

do $$
declare
  definition text := pg_get_functiondef(
    'app_private.valid_painted_player_look_url_v1(text)'::regprocedure
  );
  validator text := E'begin\n  if p_url is null';
begin
  if strpos(definition, validator) = 0 then
    raise exception 'Unrecognized appearance URL validator';
  end if;
  execute replace(
    definition,
    validator,
    E'begin\n  if app_private.valid_authored_player_appearance_url_v1(p_url) then\n    return true;\n  end if;\n  if p_url is null'
  );
end;
$$;

commit;
