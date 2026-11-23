begin;

-- Category is authoring metadata, independent of family, scope, and occurrence status.
-- Preserve historic captures and permit legacy clients to omit the field.
alter table app_private.event_definition_drafts
  add constraint event_draft_category_valid check (
    not (definition ? 'category') or
    coalesce(definition->>'category' in (
      'world-events', 'story-campaigns', 'repeatable-activities', 'hidden-discoveries'
    ), false)
  ) not valid;

alter table app_private.event_definition_versions
  add constraint event_version_category_valid check (
    not (definition ? 'category') or
    coalesce(definition->>'category' in (
      'world-events', 'story-campaigns', 'repeatable-activities', 'hidden-discoveries'
    ), false)
  ) not valid;


-- A Hidden Discovery needs an eligibility projection before it can place a public marker.
-- Existing public navigation remains available for the other categories.
create function app_private.event_definition_is_hidden_v1(p_definition jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_definition->>'category' = 'hidden-discoveries',
    p_definition->>'family' = 'lore-revelation', false);
$$;
revoke all on function app_private.event_definition_is_hidden_v1(jsonb)
  from public, anon, authenticated, service_role;

do $migration$
declare
  body text;
  anchor constant text := '    for objective in select value from jsonb_array_elements(coalesce(phase->''objectives'',''[]'')) loop';
begin
  body := pg_get_functiondef('app_private.assert_event_runtime_supported_v1(jsonb)'::regprocedure);
  if strpos(body, anchor) = 0 then
    raise exception 'EVENT_RUNTIME_GUARD_PREDECESSOR_MISSING';
  end if;
  body := replace(body, anchor, anchor || $guard$
      if app_private.event_definition_is_hidden_v1(p_definition)
        and jsonb_typeof(objective->'worldNavigation') = 'object' then
        raise exception using errcode = '22023', message = 'EVENT_HIDDEN_NAVIGATION_UNAVAILABLE';
      end if;
$guard$);
  execute body;
end; $migration$;

create or replace function public.read_event_workspace_catalogue_v1(
  p_actor_user_id uuid, p_actor_character_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id, p_actor_character_id);
  return jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(entry.row order by entry.row->>'title', entry.row->>'eventKey')
      from (
        select jsonb_build_object(
          'eventKey', coalesce(d.event_key, p.event_key),
          'title', coalesce(d.definition, v.definition)->>'title',
          'scope', coalesce(d.definition, v.definition)->'scope',
          'category', coalesce(d.definition, v.definition)->'category',
          'family', coalesce(d.definition, v.definition)->'family',
          'draftVersion', d.draft_version,
          'publishedVersion', v.definition_version
        ) row
        from app_private.event_definition_drafts d
        full join app_private.event_publications p on p.event_key = d.event_key
        left join app_private.event_definition_versions v on v.id = p.version_id
        order by coalesce(d.updated_at, p.updated_at) desc, coalesce(d.event_key, p.event_key)
        limit 200
      ) entry
    ), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', p.reward_package_ref,
        'label', p.amount::text || ' Character XP · v' || p.package_version::text,
        'budget', p.budget_ref
      ) order by p.reward_package_ref)
      from (select * from app_private.event_reward_packages order by reward_package_ref limit 200) p
    ), '[]'::jsonb)
  );
end; $$;

create or replace function public.list_event_workspace_runs_v1(
  p_actor_user_id uuid, p_actor_character_id uuid
)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(summary) || jsonb_build_object(
    'title', definition.definition->>'title',
    'category', definition.definition->'category',
    'family', definition.definition->'family',
    'participant_count', (
      select count(*) from app_private.event_participants participant
      where participant.run_id = summary.run_id
    )
  ) order by case when summary.lifecycle_status = 'archived' then 1 else 0 end,
    summary.updated_at desc, summary.run_id), '[]'::jsonb)
  from public.list_event_operation_runs_v1(p_actor_user_id, p_actor_character_id) summary
  join app_private.event_runs run on run.id = summary.run_id
  join app_private.event_definition_versions definition on definition.id = run.definition_version_id;
$$;

commit;
