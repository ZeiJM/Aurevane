begin;

-- A new character has no Mastery or Rekindling. Account grants are checked
-- separately from progression, using the same policy for listing and creation.
create function app_private.character_creation_discipline_ids_v1(p_user_id uuid)
returns table(discipline_id text) language sql stable set search_path='' as $$
  select d.discipline_id
  from app_private.current_discipline_definitions_v1() d
  left join app_private.combat_content_publications pub
    on pub.content_kind='discipline' and pub.content_key=d.discipline_id
  left join app_private.combat_content_versions v on v.id=pub.version_id
  where d.enabled_for_primary
    and (
      (pub.version_id is null
        and not exists (select 1 from app_private.discipline_mastery_prerequisites r where r.discipline_id=d.discipline_id)
        and not exists (select 1 from app_private.discipline_rekindling_prerequisites r where r.discipline_id=d.discipline_id))
      or (v.definition #>> '{atlas,family}'='foundation' and (
        (v.definition #>> '{unlock,kind}' in ('always','all')
          and not jsonb_path_exists(v.definition->'unlock', '$.**.kind ? (@ != "always" && @ != "all")'))
        or (v.definition #>> '{unlock,kind}'='unavailable'
          and d.discipline_id=any(public.get_account_discipline_grants_v1(p_user_id)))
      ))
    );
$$;
revoke all on function app_private.character_creation_discipline_ids_v1(uuid) from public,anon,authenticated,service_role;

create function public.get_character_creation_catalog_v1(p_user_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(c.value order by c.ordinality),'[]'::jsonb)
  from jsonb_array_elements(public.get_current_discipline_catalog_v1()) with ordinality c(value,ordinality)
  join app_private.character_creation_discipline_ids_v1(p_user_id) eligible
    on eligible.discipline_id=c.value->>'discipline_id';
$$;
revoke all on function public.get_character_creation_catalog_v1(uuid) from public,anon,authenticated;
grant execute on function public.get_character_creation_catalog_v1(uuid) to service_role;

-- Retain successful replay and the Core version check in the existing transaction.
do $migration$
declare
  definition text;
  predecessor constant text := 'where definition.discipline_id=p_foundation_discipline_id and definition.enabled_for_primary;';
begin
  definition := pg_get_functiondef('public.create_character_v4(uuid,smallint,uuid,text,integer,text,text,text,text,text,text,text,integer,integer,integer,integer,integer,integer,integer)'::regprocedure);
  if strpos(definition,predecessor)=0 then
    raise exception 'FOUNDATION_CREATION_PREDECESSOR_CONFLICT';
  end if;
  execute replace(definition,predecessor,$predicate$
  where definition.discipline_id=p_foundation_discipline_id
    and exists (
      select 1 from app_private.character_creation_discipline_ids_v1(p_user_id) eligible
      where eligible.discipline_id=definition.discipline_id
    );
$predicate$);
end; $migration$;

commit;
