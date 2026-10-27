begin;

-- Facts are collected only for server-admitted production battles. No historical
-- backfill: older snapshots do not prove whether an encounter was a test.
create table app_private.usage_balance_sessions (
 battle_session_id uuid primary key references app_private.battle_sessions(id) on delete cascade,
 source text not null check(source in ('pvp','pve-recruit')),
 combatants jsonb not null,
 completed_at timestamptz,
 winner_team_id text,
 collected_at timestamptz not null default clock_timestamp()
);
create index usage_balance_completed_idx on app_private.usage_balance_sessions(completed_at desc,battle_session_id) where completed_at is not null;
create index usage_balance_collected_idx on app_private.usage_balance_sessions(collected_at);
create table app_private.usage_balance_actions (
 battle_session_id uuid not null references app_private.usage_balance_sessions(battle_session_id) on delete cascade,
 combatant_id text not null,
 skill_id text not null,
 uses bigint not null check(uses>0),
 primary key(battle_session_id,combatant_id,skill_id)
);
alter table app_private.usage_balance_sessions enable row level security;
alter table app_private.usage_balance_actions enable row level security;
revoke all on app_private.usage_balance_sessions,app_private.usage_balance_actions from public,anon,authenticated,service_role;

create function app_private.capture_usage_balance_start_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_combatants jsonb;
begin
 if new.current_snapshot #> '{usageBalance,version}' is distinct from '1'::jsonb
 or new.current_snapshot #> '{usageBalance,eligible}' is distinct from 'true'::jsonb
 or coalesce(new.current_snapshot #>> '{usageBalance,source}','') not in ('pvp','pve-recruit')
 or jsonb_typeof(new.current_snapshot #> '{buildAuthority,combatants}') is distinct from 'array'
 or jsonb_array_length(new.current_snapshot #> '{buildAuthority,combatants}') not between 1 and 24
 then return new; end if;
 select jsonb_agg(jsonb_build_object(
  'combatantId',b->>'combatantId','primary',b#>>'{primary,disciplineId}',
  'secondary',b#>>'{secondary,disciplineId}','skills',coalesce(b->'disciplineSkills','[]'::jsonb),
  'teamId',c->>'teamId')) into v_combatants
 from jsonb_array_elements(new.current_snapshot #> '{buildAuthority,combatants}') b
 join lateral jsonb_array_elements(new.current_snapshot #> '{tactical,battle,combatants}') c on c->>'id'=b->>'combatantId'
 where b->>'characterId' is not null and b#>>'{primary,disciplineId}' is not null;
 if v_combatants is not null then
  insert into app_private.usage_balance_sessions(battle_session_id,source,combatants)
   values(new.id,new.current_snapshot#>>'{usageBalance,source}',v_combatants);
 end if;
 return new;
end; $$;
revoke all on function app_private.capture_usage_balance_start_v1() from public,anon,authenticated,service_role;
create trigger usage_balance_start after insert on app_private.battle_sessions for each row execute function app_private.capture_usage_balance_start_v1();

-- Constant-size receipt updates; never scan battle history on a gameplay command.
-- Committed event uniqueness supplies retry deduplication before these AFTER triggers.
create function app_private.capture_usage_balance_event_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.event->>'event'='combat_action_used' then
  insert into app_private.usage_balance_actions(battle_session_id,combatant_id,skill_id,uses)
   select new.battle_session_id,new.event->>'actorId',new.event->>'actionId',1
   from app_private.usage_balance_sessions s
   where s.battle_session_id=new.battle_session_id and s.completed_at is null
   and exists(select 1 from jsonb_array_elements(s.combatants) c,
    lateral jsonb_array_elements(c->'skills') skill
    where c->>'combatantId'=new.event->>'actorId' and skill->>'skillId'=new.event->>'actionId')
   on conflict(battle_session_id,combatant_id,skill_id) do update set uses=app_private.usage_balance_actions.uses+1;
 elsif new.event->>'event'='battle_completed' and new.event ? 'winningTeamId'
 and jsonb_typeof(new.event->'winningTeamId') in ('string','null') then
  update app_private.usage_balance_sessions set completed_at=new.created_at,winner_team_id=new.event->>'winningTeamId'
   where battle_session_id=new.battle_session_id and completed_at is null
   and exists(select 1 from app_private.battle_sessions b where b.id=new.battle_session_id and b.lifecycle='completed');
 end if;
 return new;
end; $$;
revoke all on function app_private.capture_usage_balance_event_v1() from public,anon,authenticated,service_role;
create trigger usage_balance_event after insert on app_private.battle_events for each row
 when(new.event->>'event' in ('combat_action_used','battle_completed')) execute function app_private.capture_usage_balance_event_v1();

create function public.read_master_usage_balance_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_content_key text)
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
declare v_now timestamptz:=statement_timestamp(); v_week timestamptz; v_result jsonb;
begin
 if not coalesce(app_private.has_master_capability_v2(p_actor_user_id,p_actor_character_id,'content.combat.author'),false) then
  raise exception using errcode='42501',message='MASTER_PANEL_OPERATOR_REQUIRED';
 end if;
 if p_content_key is null or length(p_content_key)>160 or p_content_key !~ '^[a-z0-9]+([._-][a-z0-9]+)*$' then
  raise exception using errcode='22023',message='USAGE_BALANCE_INVALID_CONTENT';
 end if;
 v_week:=date_trunc('week',v_now at time zone 'UTC') at time zone 'UTC';
 with selected_discipline as materialized (
  select v.definition from app_private.combat_content_publications p
  join app_private.combat_content_versions v on v.id=p.version_id
  join app_private.combat_content_records r on r.content_key=p.content_key
  where p.content_key=p_content_key and r.content_kind='discipline'
 ), roster as materialized (
  select b.* from app_private.character_active_builds b join public.characters c on c.id=b.character_id and c.user_id=b.user_id
  where not exists(select 1 from app_private.character_deletion_requests d where d.character_id=b.character_id)
  and not exists(select 1 from app_private.account_deletion_requests d where d.user_id=b.user_id)
  order by b.character_id limit 50001
 ), bounded_roster as materialized(select * from roster order by character_id limit 50000),
 sessions as materialized (
  select s.* from app_private.usage_balance_sessions s
  where s.completed_at>=v_week and s.completed_at<least(v_week+interval '7 days',v_now)
  order by s.completed_at desc,s.battle_session_id limit 10001
 ), bounded_sessions as materialized(select * from sessions order by completed_at desc,battle_session_id limit 10000),
 units as materialized (
  select s.battle_session_id,s.source,s.winner_team_id,c.* from bounded_sessions s
  cross join lateral jsonb_to_recordset(s.combatants) c("combatantId" text,"primary" text,"secondary" text,"teamId" text,skills jsonb)
 ), selected_units as materialized(select * from units u where u."primary"=p_content_key or u."secondary"=p_content_key
   or exists(select 1 from jsonb_array_elements(u.skills) k where k->>'skillId'=p_content_key)),
 skill_catalog as (
  select linked.skill_id from selected_discipline d cross join lateral jsonb_array_elements_text(coalesce(d.definition->'linkedSkills','[]'::jsonb)) linked(skill_id) where d.definition->'enabled'='true'::jsonb
  union select skill_id from app_private.phase4_skill_catalog k where ((discipline_id=p_content_key and not exists(select 1 from selected_discipline)) or skill_id=p_content_key) and not exists(select 1 from app_private.combat_content_records r where r.content_key=k.skill_id and r.lifecycle='archived')
  union select r.content_key from app_private.combat_content_records r left join app_private.combat_content_publications p using(content_key)
   left join app_private.combat_content_versions v on v.id=p.version_id
   where r.content_kind='skill' and r.lifecycle<>'archived' and coalesce(v.definition->>'sourceDisciplineId',r.builtin_source_discipline_id) is not null and
    r.content_key=p_content_key
  union select k.skill_id from app_private.character_build_discipline_skills k join bounded_roster b using(character_id)
   where k.source_discipline_id=p_content_key or k.skill_id=p_content_key
 ), equipped_counts as (
  select e.skill_id,count(distinct b.user_id) players,count(*) characters
  from app_private.character_build_discipline_skills e join bounded_roster b using(character_id)
  group by e.skill_id
 ), used_counts as (
  select a.skill_id,sum(a.uses) uses,count(distinct a.battle_session_id) battles
  from app_private.usage_balance_actions a join bounded_sessions s using(battle_session_id)
  group by a.skill_id
 ), skills as (
  select k.skill_id,coalesce(v.definition->>'name',r.builtin_name,k.skill_id) skill_name,coalesce(e.players,0) equipped_players,coalesce(e.characters,0) equipped_characters,
   coalesce(u.uses,0) actual_uses,coalesce(u.battles,0) used_battles
  from skill_catalog k left join equipped_counts e using(skill_id) left join used_counts u using(skill_id)
  left join app_private.combat_content_records r on r.content_key=k.skill_id
  left join app_private.combat_content_publications p on p.content_key=k.skill_id
  left join app_private.combat_content_versions v on v.id=p.version_id
  order by k.skill_id limit 200
 ), weekly as (
  select sources.source,count(u.battle_session_id) appearances,
   count(*) filter(where u.winner_team_id=u."teamId") wins,
   count(*) filter(where u.winner_team_id is not null and u.winner_team_id<>u."teamId") losses,
   count(*) filter(where u.battle_session_id is not null and u.winner_team_id is null) draws
  from (values('pvp'),('pve-recruit')) sources(source) left join selected_units u on u.source=sources.source group by sources.source
 ), pairs as (
  select b.primary_discipline_id,b.secondary_discipline_id,count(*) characters,count(distinct b.user_id) players from bounded_roster b
  where b.primary_discipline_id=p_content_key or b.secondary_discipline_id=p_content_key
  group by b.primary_discipline_id,b.secondary_discipline_id order by count(*) desc,b.primary_discipline_id,b.secondary_discipline_id limit 10
 ), matchups as (
  select u.source,op."primary" opponent,count(*) appearances,
   count(*) filter(where u.winner_team_id=u."teamId") wins,
   count(*) filter(where u.winner_team_id is not null and u.winner_team_id<>u."teamId") losses,
   count(*) filter(where u.winner_team_id is null) draws
  from selected_units u join units op on op.battle_session_id=u.battle_session_id and op."teamId"<>u."teamId"
  group by u.source,op."primary" order by count(*) desc,u.source,op."primary" limit 10
 )
 select jsonb_build_object('contentKey',p_content_key,
 'subjectKind',case
 when exists(select 1 from app_private.combat_content_records where content_key=p_content_key and content_kind='discipline')
 or exists(select 1 from app_private.phase4_skill_catalog where discipline_id=p_content_key)
 or exists(select 1 from bounded_roster where primary_discipline_id=p_content_key or secondary_discipline_id=p_content_key) then 'discipline'
 when exists(select 1 from skill_catalog where skill_id=p_content_key) then 'skill' else 'unsupported' end,
 'asOf',v_now,'weekStartsAt',v_week,'weekEndsAt',v_week+interval '7 days',
 'current',jsonb_build_object(
  'primaryPlayers',(select count(distinct user_id) from bounded_roster where primary_discipline_id=p_content_key),
  'secondaryPlayers',(select count(distinct user_id) from bounded_roster where secondary_discipline_id=p_content_key),
  'primaryCharacters',(select count(*) from bounded_roster where primary_discipline_id=p_content_key),
  'secondaryCharacters',(select count(*) from bounded_roster where secondary_discipline_id=p_content_key),
  'totalPlayers',(select count(distinct user_id) from bounded_roster),'totalCharacters',(select count(*) from bounded_roster)),
 'skills',coalesce((select jsonb_agg(jsonb_build_object('skillId',s.skill_id,'name',s.skill_name,'equippedPlayers',s.equipped_players,'equippedCharacters',s.equipped_characters,'actualUses',s.actual_uses,'usedBattles',s.used_battles)) from skills s),'[]'::jsonb),
 'weekly',(select jsonb_agg(jsonb_build_object('source',w.source,'appearances',w.appearances,'wins',w.wins,'losses',w.losses,'draws',w.draws)) from weekly w),
 'pairs',coalesce((select jsonb_agg(jsonb_build_object('primary',p.primary_discipline_id,'secondary',p.secondary_discipline_id,'players',p.players,'characters',p.characters)) from pairs p),'[]'::jsonb),
 'matchups',coalesce((select jsonb_agg(jsonb_build_object('source',m.source,'opponent',m.opponent,'appearances',m.appearances,'wins',m.wins,'losses',m.losses,'draws',m.draws)) from matchups m),'[]'::jsonb),
 'coverage',jsonb_build_object('legacyHistoryAvailable',false,'rosterTruncated',(select count(*)>50000 from roster),'battlesTruncated',(select count(*)>10000 from sessions),'collectedBattles',(select count(*) from bounded_sessions),'collectionStartedAt',(select min(collected_at) from app_private.usage_balance_sessions))) into v_result;
 return v_result;
end; $$;
revoke all on function public.read_master_usage_balance_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.read_master_usage_balance_v1(uuid,uuid,text) to service_role;
commit;
