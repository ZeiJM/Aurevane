begin;

create table app_private.master_panel_navigation (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 1 check (revision > 0),
  tab_order jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default clock_timestamp()
);
alter table app_private.master_panel_navigation enable row level security;
revoke all on table app_private.master_panel_navigation from public, anon, authenticated, service_role;
insert into app_private.master_panel_navigation(tab_order) values
  ('["combat","combat-timing","events","moderation","players","staff","music","world-environment","activity"]');

create table app_private.master_panel_navigation_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id),
  actor_character_id uuid references public.characters(id),
  revision bigint not null unique,
  before_order jsonb not null,
  after_order jsonb not null,
  occurred_at timestamptz not null default clock_timestamp()
);
alter table app_private.master_panel_navigation_audit enable row level security;
revoke all on table app_private.master_panel_navigation_audit from public,anon,authenticated,service_role;
revoke all on sequence app_private.master_panel_navigation_audit_id_seq from public,anon,authenticated,service_role;

create function public.read_master_panel_navigation_v1(p_actor_user_id uuid,p_actor_character_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'master.access');
  return (select jsonb_build_object('revision',revision,'order',tab_order) from app_private.master_panel_navigation where singleton);
end; $$;

create function public.save_master_panel_navigation_v1(p_actor_user_id uuid,p_expected_revision bigint,p_order jsonb,p_actor_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_revision bigint; current_order jsonb;
begin
  perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'staff.manage');
  if p_expected_revision is null or p_expected_revision<1 or jsonb_typeof(p_order) is distinct from 'array' then
    raise exception using errcode='22023',message='MASTER_NAVIGATION_INVALID';
  end if;
  if jsonb_array_length(p_order)<>9 or exists(
    select 1 from jsonb_array_elements(p_order) p where jsonb_typeof(p)<>'string'
      or p #>> '{}' not in ('combat','combat-timing','events','moderation','players','staff','music','world-environment','activity')
  ) or (select count(distinct p) from jsonb_array_elements(p_order) p)<>9 then
    raise exception using errcode='22023',message='MASTER_NAVIGATION_INVALID';
  end if;
  select revision,tab_order into current_revision,current_order from app_private.master_panel_navigation where singleton for update;
  if current_revision<>p_expected_revision then raise exception using errcode='PT409',message='MASTER_NAVIGATION_VERSION_CONFLICT'; end if;
  if current_order<>p_order then
    update app_private.master_panel_navigation set revision=revision+1,tab_order=p_order,updated_by=p_actor_user_id,updated_at=clock_timestamp() where singleton;
    insert into app_private.master_panel_navigation_audit(actor_user_id,actor_character_id,revision,before_order,after_order)
      values(p_actor_user_id,p_actor_character_id,current_revision+1,current_order,p_order);
    insert into app_private.master_panel_activity(actor,action,subject)
      values(app_private.master_activity_actor_v1(p_actor_user_id,p_actor_character_id),'Reordered tabs','Master Panel');
  end if;
  return public.read_master_panel_navigation_v1(p_actor_user_id,p_actor_character_id);
end; $$;

revoke all on function public.read_master_panel_navigation_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_master_panel_navigation_v1(uuid,bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.read_master_panel_navigation_v1(uuid,uuid) to service_role;
grant execute on function public.save_master_panel_navigation_v1(uuid,bigint,jsonb,uuid) to service_role;
commit;
