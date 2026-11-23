begin;

-- This disposable, bounded display feed is separate from immutable provenance.
-- Only its rows are expired. Existing audits, versions and battle captures remain.
create table app_private.master_panel_activity (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor text not null check (char_length(actor) between 1 and 120),
  action text not null check (char_length(action) between 1 and 80),
  subject text not null check (char_length(subject) between 1 and 160),
  detail text not null default '' check (char_length(detail)<=400)
);
create index master_panel_activity_week_idx on app_private.master_panel_activity(occurred_at desc,id desc);
alter table app_private.master_panel_activity enable row level security;
revoke all on table app_private.master_panel_activity from public,anon,authenticated,service_role;
revoke all on sequence app_private.master_panel_activity_id_seq from public,anon,authenticated,service_role;

create function app_private.master_activity_actor_v1(p_user_id uuid,p_character_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select left(coalesce(
    (select c.name from public.characters c where c.id=p_character_id and c.user_id=p_user_id),
    (select 'Game Owner' from app_private.master_panel_role_assignments a where a.user_id=p_user_id and a.role='game-owner' and a.enabled limit 1),
    -- Most source audits identify an account rather than its selected character.
    -- Show its linked Staff identities together; never guess a selected character.
    (select string_agg(n.name,' / ' order by n.name) from (
      select c.name from app_private.master_panel_character_access a join public.characters c on c.id=a.character_id and c.user_id=a.user_id where a.user_id=p_user_id order by c.name limit 3
    ) n),
    'Staff member'),120);
$$;

create function app_private.master_activity_changed_v1(p_before jsonb,p_after jsonb)
returns text language sql immutable set search_path='' as $$
  select coalesce('Changed: '||string_agg(case k
    when 'xp' then 'Experience' when 'attributes' then 'Core attributes' when 'build' then 'Build' when 'level' then 'Level' when 'cycle' then 'Rekindling Cycle' when 'personal' then 'Personal points'
    when 'roles' then 'Roles' when 'special_capabilities' then 'Special permissions'
    when 'enabled' then 'Availability' when 'expires_at' then 'Expiry'
    when 'moderator' then 'Moderator' when 'content-staff' then 'Content Staff' when 'event-staff' then 'Event Staff'
    when 'default_track' then 'Default song' when 'route_overrides' then 'Page assignments' when 'song_library' then 'Song library' when 'tracks' then 'Song library' when 'library' then 'Song library'
    when 'weatherOverride' then 'Weather override' when 'weatherOverrideUntilMs' then 'Weather override expiry'
    when 'weatherRollMinutes' then 'Weather roll interval' when 'dayLengthMinutes' then 'Day length' when 'timeOffsetMinutes' then 'Time offset' when 'frozenMinuteOfDay' then 'Frozen time'
    else left(replace(k,'_',' '),32) end,', ' order by k),'') from (
    select k from jsonb_object_keys((case when jsonb_typeof(p_before)='object' then p_before else '{}'::jsonb end)||(case when jsonb_typeof(p_after)='object' then p_after else '{}'::jsonb end)) k
    where p_before->k is distinct from p_after->k and k~'^[a-zA-Z][a-zA-Z_-]{0,31}$'
      and k not in ('character_id','user_id','updated_at','updated_by','access_version','revision') order by k limit 10
  ) changed;
$$;

create function app_private.capture_master_panel_activity_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  n jsonb:=to_jsonb(new); b jsonb; v_user uuid; v_character uuid;
  v_action text; v_subject text; v_detail text:=''; v_definition jsonb; v_event_key text;
begin
  if tg_op='UPDATE' then b:=to_jsonb(old); end if;
  v_user:=coalesce(n->>'actor_user_id',n->>'updated_by',n->>'published_by')::uuid;
  if v_user is null then return new; end if;
  v_character:=(n->>'actor_character_id')::uuid;
  case tg_table_name
    when 'combat_content_publications' then
      if tg_op='UPDATE' and n->>'version_id'=b->>'version_id' then return new; end if;
      select definition into v_definition from app_private.combat_content_versions where id=(n->>'version_id')::uuid;
      v_action:='Published content'; v_subject:=coalesce(v_definition->>'name',v_definition->>'displayName',n->>'content_key');
    when 'master_panel_access_audit' then
      v_action:='Changed Staff access';
      select name into v_subject from public.characters where id=(n->>'target_character_id')::uuid;
      v_subject:=coalesce(v_subject,'Staff account');
      v_detail:=app_private.master_activity_changed_v1(n->'before_state',n->'after_state');
    when 'master_panel_role_defaults' then
      if n->'roles' is not distinct from b->'roles' then return new; end if;
      v_action:='Changed role defaults'; v_subject:='Staff & Access';
      v_detail:=app_private.master_activity_changed_v1(b->'roles',n->'roles');
    when 'player_support_audit' then
      v_action:=case n->>'action' when 'battle.no-contest' then 'Recovered battle' else 'Corrected player' end;
      select name into v_subject from public.characters where id=(n->>'character_id')::uuid;
      v_subject:=coalesce(v_subject,'Player');
      if n->>'action'='player.edit' then v_detail:=app_private.master_activity_changed_v1(n->'before_facts',n->'after_facts'); end if;
    when 'world_environment_audit' then
      v_action:='Changed World settings'; v_subject:='World Environment';
      v_detail:=app_private.master_activity_changed_v1(n->'before_settings',n->'after_settings');
    when 'combat_effect_timing_policy_versions' then
      v_action:='Changed Combat Rules'; v_subject:='Effect timing';
    when 'battlefield_elevation_policy_versions' then
      v_action:='Changed Combat Rules'; v_subject:='Elevation chances';
    when 'site_music_configuration' then
      v_detail:=app_private.master_activity_changed_v1(b-array['updated_at','updated_by','revision'],n-array['updated_at','updated_by','revision']);
      if v_detail='' then return new; end if;
      v_action:='Changed music'; v_subject:='Music library & assignments';
    when 'event_authoring_audit' then
      v_action:=case n->>'action' when 'publish' then 'Published event' when 'schedule' then 'Scheduled event' else 'Cancelled event schedule' end;
      v_event_key:=n->>'event_key';
      select definition into v_definition from app_private.event_definition_versions where event_key=v_event_key order by published_at desc limit 1;
      v_subject:=coalesce(v_definition->>'name',v_definition->>'title',v_event_key);
    when 'event_operations_audit' then
      v_action:=case n->>'action' when 'phase-advance' then 'Advanced event phase' when 'cleanup' then 'Completed event cleanup' else 'Changed live event' end;
      select d.definition into v_definition from app_private.event_runs r join app_private.event_definition_versions d on d.id=r.definition_version_id where r.id=(n->>'run_id')::uuid;
      v_subject:=coalesce(v_definition->>'name',v_definition->>'title','Live event');
      v_detail:=case n->>'command' when 'start' then 'Started' when 'pause' then 'Paused' when 'resume' then 'Resumed' when 'end' then 'Ended' when 'archive' then 'Archived' when 'emergency-stop' then 'Emergency stopped' else '' end;
    else return new;
  end case;
  insert into app_private.master_panel_activity(actor,action,subject,detail)
    values(app_private.master_activity_actor_v1(v_user,v_character),v_action,left(coalesce(nullif(v_subject,''),'Panel settings'),160),left(v_detail,400));
  return new;
end;
$$;

create trigger master_activity_content after insert or update on app_private.combat_content_publications for each row execute function app_private.capture_master_panel_activity_v1();
create trigger master_activity_staff after insert on app_private.master_panel_access_audit for each row execute function app_private.capture_master_panel_activity_v1();
create trigger master_activity_defaults after update on app_private.master_panel_role_defaults for each row execute function app_private.capture_master_panel_activity_v1();
create trigger master_activity_players after insert on app_private.player_support_audit for each row execute function app_private.capture_master_panel_activity_v1();
create trigger master_activity_world after insert on app_private.world_environment_audit for each row execute function app_private.capture_master_panel_activity_v1();
create trigger master_activity_timing after insert on app_private.combat_effect_timing_policy_versions for each row execute function app_private.capture_master_panel_activity_v1();
create trigger master_activity_elevation after insert on app_private.battlefield_elevation_policy_versions for each row execute function app_private.capture_master_panel_activity_v1();
create trigger master_activity_music after update on public.site_music_configuration for each row execute function app_private.capture_master_panel_activity_v1();
create trigger master_activity_event_authoring after insert on app_private.event_authoring_audit for each row execute function app_private.capture_master_panel_activity_v1();
create trigger master_activity_event_operations after insert on app_private.event_operations_audit for each row execute function app_private.capture_master_panel_activity_v1();

create function public.read_master_panel_activity_v1(p_actor_user_id uuid,p_limit integer default 100,p_before_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_week timestamptz:=date_trunc('week',statement_timestamp() at time zone 'UTC') at time zone 'UTC'; v_result jsonb;
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);
  if p_limit is null or p_limit<1 or p_limit>100 or p_before_id<1 then raise exception using errcode='22023',message='INVALID_ACTIVITY_PAGE'; end if;
  -- Filtering by the UTC epoch makes the reset visible even if cron is delayed.
  with page as (
    select * from app_private.master_panel_activity where occurred_at>=v_week and (p_before_id is null or id<p_before_id) order by id desc limit p_limit+1
  ), shown as (select * from page order by id desc limit p_limit)
  select jsonb_build_object('entries',coalesce((select jsonb_agg(jsonb_build_object('id',id::text,'occurredAt',occurred_at,'actor',actor,'action',action,'subject',subject,'detail',detail) order by id desc) from shown),'[]'::jsonb),
    'weekStartsAt',v_week,'resetsAt',v_week+interval '7 days','nextCursor',case when (select count(*) from page)>p_limit then (select min(id)::text from shown) else null end) into v_result;
  return v_result;
end;
$$;

create function app_private.clear_master_panel_activity_v1()
returns void language sql security definer set search_path='' as $$
  delete from app_private.master_panel_activity where occurred_at<(date_trunc('week',statement_timestamp() at time zone 'UTC') at time zone 'UTC');
$$;

revoke all on function app_private.master_activity_actor_v1(uuid,uuid),app_private.master_activity_changed_v1(jsonb,jsonb),app_private.capture_master_panel_activity_v1(),app_private.clear_master_panel_activity_v1(),public.read_master_panel_activity_v1(uuid,integer,bigint) from public,anon,authenticated,service_role;
grant execute on function public.read_master_panel_activity_v1(uuid,integer,bigint) to service_role;
-- Supabase pg_cron schedules use UTC. The cleanup also computes its boundary in UTC.
select cron.schedule('aurevane-master-activity-weekly-v1','0 0 * * 1','select app_private.clear_master_panel_activity_v1();');
comment on table app_private.master_panel_activity is 'Owner-only weekly display feed. Automatically clears each Monday 00:00 UTC; no payload JSON. Immutable source audits and captured history are retained.';

commit;
