begin;

-- Current selections retire Guard. Immutable encounters, content versions and
-- operation receipts retain their captured identities and are never rewritten.
create table if not exists app_private.character_support_loadout_retirement_audit (
  character_id uuid not null references public.characters(id) on delete cascade,
  slot_index smallint not null check (slot_index between 1 and 8),
  before_support_action_id text not null check (before_support_action_id = 'basic.guard'),
  before_updated_at timestamptz not null,
  source_build_version bigint not null check (source_build_version > 0),
  replacement_support_action_id text not null check (replacement_support_action_id = 'basic.recover'),
  changed_at timestamptz not null,
  primary key (character_id, slot_index)
);
alter table app_private.character_support_loadout_retirement_audit enable row level security;
revoke all on table app_private.character_support_loadout_retirement_audit from public, anon, authenticated, service_role;
grant select on table app_private.character_support_loadout_retirement_audit to service_role;

alter table app_private.character_active_builds
  alter column support_action_id set default 'basic.recover',
  drop constraint character_active_build_support_action_allowed;
alter table app_private.character_saved_build_loadouts
  alter column support_action_id set default 'basic.recover',
  drop constraint character_saved_build_support_action_allowed;

-- Preserve each historical receipt, including Guard, while admitting new writes.
-- Discover the installed column check rather than guessing its generated name.
do $receipt_constraint$
declare installed text; matches integer;
begin
  select count(*), min(c.conname) into matches, installed
  from pg_constraint c join pg_attribute a
    on a.attrelid=c.conrelid and a.attname='support_action_id'
  where c.conrelid='app_private.character_support_action_idempotency'::regclass
    and c.contype='c' and c.conkey=array[a.attnum]::smallint[];
  if matches <> 1 then raise exception 'SUPPORT_RECEIPT_CONSTRAINT_PREDECESSOR_CONFLICT'; end if;
  execute format('alter table app_private.character_support_action_idempotency drop constraint %I',installed);
end;
$receipt_constraint$;
alter table app_private.character_support_action_idempotency
  add constraint character_support_action_receipt_allowed check (support_action_id in (
    'basic.guard','basic.recover','basic.recover.mp','basic.pilfer','basic.fleetstep','basic.invocation'
  ));

-- This is a system migration, not a fabricated player operation. Bumping the
-- active version invalidates old build CAS/preparation while retaining all fields.
with changed as (
  update app_private.character_active_builds
  set support_action_id='basic.recover',build_version=build_version+1,updated_at=clock_timestamp()
  where support_action_id='basic.guard'
  returning character_id,user_id,build_version,updated_at
)
insert into app_private.character_support_action_change_audit (
  id,character_id,user_id,build_version_before,build_version_after,
  before_support_action_id,after_support_action_id,request_fingerprint,changed_at
)
select gen_random_uuid(),character_id,user_id,build_version-1,build_version,
  'basic.guard','basic.recover','migration:universal-support-actions:v1',updated_at
from changed;

-- Saved slots are current intent. Keep their original source-build provenance
-- and record only the retired selection/timestamp, not an unchanged build copy.
insert into app_private.character_support_loadout_retirement_audit (
  character_id,slot_index,before_support_action_id,before_updated_at,source_build_version,
  replacement_support_action_id,changed_at
)
select character_id,slot_index,support_action_id,updated_at,source_build_version,
  'basic.recover',transaction_timestamp()
from app_private.character_saved_build_loadouts where support_action_id='basic.guard'
on conflict (character_id,slot_index) do nothing;
update app_private.character_saved_build_loadouts
set support_action_id='basic.recover',updated_at=transaction_timestamp()
where support_action_id='basic.guard';

alter table app_private.character_active_builds
  add constraint character_active_build_support_action_allowed check (support_action_id in (
    'basic.recover','basic.recover.mp','basic.pilfer','basic.fleetstep','basic.invocation'
  ));
alter table app_private.character_saved_build_loadouts
  add constraint character_saved_build_support_action_allowed check (support_action_id in (
    'basic.recover','basic.recover.mp','basic.pilfer','basic.fleetstep','basic.invocation'
  ));

-- Extend only the installed vocabulary and preserve its full current authority,
-- locking, idempotency, CAS, audit and ACL contract. A literal old receipt can be
-- replayed; a new Guard operation is rejected before any mutation.
do $support_writer$
declare
  definition text;
  old_vocabulary constant text := $old$p_support_action_id not in ('basic.guard','basic.recover','basic.recover.mp')$old$;
  vocabulary constant text := $new$p_support_action_id not in ('basic.guard','basic.recover','basic.recover.mp','basic.pilfer','basic.fleetstep','basic.invocation')$new$;
  cas_anchor constant text := '  if v_build.build_version <> p_expected_build_version then';
  current_guard constant text := $guard$  if p_support_action_id='basic.guard' then
    raise exception using errcode='22023',message='SUPPORT_ACTION_INVALID';
  end if;
$guard$;
begin
  definition:=pg_get_functiondef('public.save_character_support_action_v1(uuid,uuid,bigint,text,uuid,text)'::regprocedure);
  if strpos(definition,old_vocabulary)>0 then
    if length(definition)-length(replace(definition,old_vocabulary,''))<>length(old_vocabulary) then
      raise exception 'SUPPORT_WRITER_VOCABULARY_PREDECESSOR_CONFLICT';
    end if;
    definition:=replace(definition,old_vocabulary,vocabulary);
  elsif strpos(definition,vocabulary)=0 then
    raise exception 'SUPPORT_WRITER_VOCABULARY_PREDECESSOR_CONFLICT';
  end if;
  if strpos(definition,current_guard)=0 then
    if length(definition)-length(replace(definition,cas_anchor,''))<>length(cas_anchor) then
      raise exception 'SUPPORT_WRITER_CAS_PREDECESSOR_CONFLICT';
    end if;
    definition:=replace(definition,cas_anchor,current_guard||cas_anchor);
  end if;
  execute definition;
end;
$support_writer$;

-- Register identities only. Normal reviewed Commit owns the first authored
-- publication; an existing Owner record, draft, floor or name wins unchanged.
insert into app_private.combat_content_records (
  content_key,content_kind,lifecycle,version_floor,builtin_version,builtin_name,
  builtin_source_discipline_id
)
values
  ('basic.pilfer','skill','active',1,1,'Pilfer',null),
  ('basic.fleetstep','skill','active',1,1,'Fleetstep',null),
  ('basic.invocation','skill','active',1,1,'Invocation',null)
on conflict (content_key) do nothing;

-- Loot is an inert effect, with ordinary editable wording. Register only its
-- metadata and append the installed finite vocabulary; no payload is published.
insert into app_private.combat_content_records (
  content_key,content_kind,lifecycle,version_floor,builtin_version,builtin_name,
  builtin_source_discipline_id
)
values ('tag.loot','tag','active',1,1,'Loot',null)
on conflict (content_key) do nothing;
do $loot_tag_identity$
declare ids text[];
begin
  ids:=app_private.content_presentation_tag_ids_v1();
  if not ('loot'=any(ids)) then
    execute format(
      'create or replace function app_private.content_presentation_tag_ids_v1() returns text[] language sql immutable set search_path='''' as %L',
      'select '||quote_literal(array_append(ids,'loot'))||'::text[]'
    );
  end if;
end;
$loot_tag_identity$;

-- Patch the latest installed closed Basic boundaries and sorted metadata reader.
-- Guard keeps its reserved historical identity but leaves the current Basic list.
do $basic_identities$
declare
  patch record;
  definition text;
  old_keys constant text := '(''basic.move'',''unarmed.basic'',''basic.guard'',''basic.recover'',''basic.recover.mp'')';
  historical_keys constant text := '(''basic.move'',''unarmed.basic'',''basic.guard'',''basic.recover'',''basic.recover.mp'',''basic.pilfer'',''basic.fleetstep'',''basic.invocation'')';
  current_keys constant text := '(''basic.move'',''unarmed.basic'',''basic.recover'',''basic.recover.mp'',''basic.pilfer'',''basic.fleetstep'',''basic.invocation'')';
begin
  for patch in select * from (values
    ('app_private.validate_content_record_identity_v1(text,text,jsonb)', 'p_key in '||old_keys, 'p_key in '||historical_keys),
    ('public.write_combat_content_record_v1(uuid,uuid,text,jsonb)', 'p_content_key in '||old_keys, 'p_content_key in '||historical_keys),
    ('public.write_combat_content_record_v1(uuid,uuid,text,jsonb)', 'source.content_key in '||old_keys, 'source.content_key in '||historical_keys),
    ('public.list_combat_content_records_v1(uuid,uuid,text,text,text,text,integer)', 'r.content_key in '||old_keys, '(r.content_key in '||current_keys||' or (p_lifecycle=''archived'' and r.content_key=''basic.guard''))'),
    ('public.list_combat_content_records_v1(uuid,uuid,text,text,text,text,integer)', 'r.content_key not in '||old_keys, 'r.content_key not in '||historical_keys),
    ('app_private.combat_content_record_json_v1(text)', 'where p.content_key=r.content_key),', 'where p.content_key=r.content_key and r.lifecycle<>''archived''),')
  ) as patches(signature,predecessor,replacement)
  loop
    definition:=pg_get_functiondef(patch.signature::regprocedure);
    if strpos(definition,patch.predecessor)>0 then
      if length(definition)-length(replace(definition,patch.predecessor,''))<>length(patch.predecessor) then
        raise exception 'BASIC_IDENTITY_PREDECESSOR_CONFLICT: %',patch.signature;
      end if;
      execute replace(definition,patch.predecessor,patch.replacement);
    elsif strpos(definition,patch.replacement)=0 then
      raise exception 'BASIC_IDENTITY_PREDECESSOR_CONFLICT: %',patch.signature;
    end if;
  end loop;
end;
$basic_identities$;

-- A system retirement, not an Owner edit: retain drafts, exact versions and the
-- physical publication pointer for provenance. Archived record/current readers
-- cannot expose it as current gameplay. Do not misattribute the archive activity
-- to the last author, or fabricate a player request receipt.
update app_private.combat_content_records
set lifecycle='archived',revision=revision+1,restore_pending=false,
  updated_by=null,updated_at=clock_timestamp()
where content_key='basic.guard' and content_kind='skill' and lifecycle<>'archived';

commit;
