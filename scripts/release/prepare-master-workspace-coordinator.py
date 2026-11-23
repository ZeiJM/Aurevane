import pathlib,json,hashlib,base64,argparse
parser=argparse.ArgumentParser(description='Generate the reviewed atomic October 27 Master workspace coordinator; does not execute SQL.')
parser.add_argument('--output',type=pathlib.Path,default=pathlib.Path('/tmp/aurevane-master-workspace-coordinator.sql'))
args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[2]
contracts=json.loads((root/'docs/verification/master-panel-20261027/migration-contracts.json').read_text())
paths=sorted((root/'supabase/migrations').glob('2026102712*.sql'))
manifest=contracts['predecessors']
expected={r['signature']:r['hash'] for r in manifest}
snapshot={'changed':contracts['after']}
changed={r['signature']:r for r in snapshot['changed']}
q=lambda x:"'"+x.replace("'","''")+"'"
preamble=f"""set transaction isolation level repeatable read;
set local lock_timeout='10s';
set local statement_timeout='120s';
do $panel_workspace_coordinator$
declare r record; observed text; expected_hash text; baseline_functions jsonb; baseline_data jsonb:='{{}}'; after_hash text; before_defaults jsonb; after_defaults jsonb; sources jsonb;
begin
 sources:={q(json.dumps([{'version':p.name.split('_')[0],'name':p.stem.split('_',1)[1],'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'md5':hashlib.md5(p.read_bytes()).hexdigest()} for p in paths]))}::jsonb;
 if exists(select 1 from supabase_migrations.schema_migrations h join jsonb_array_elements(sources) s on h.version=s->>'version') then raise exception 'MASTER_WORKSPACE_CANONICAL_ALREADY_PRESENT'; end if;
 for r in select key signature,value expected from jsonb_each_text({q(json.dumps(expected))}::jsonb) loop
  select md5(pg_get_functiondef(to_regprocedure(r.signature))) into observed;
  if observed is distinct from r.expected then raise exception 'MASTER_WORKSPACE_FUNCTION_PREDECESSOR_CONFLICT: %',r.signature; end if;
 end loop;
 select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object('hash',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',p.proowner::text)) into baseline_functions
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prokind='f';
 -- This transaction's consistent snapshot includes every existing durable game,
 -- authoring, policy and access row. Runtime lease/presence/travel tables are not
 -- part of authored preservation; gameplay can continue against the old snapshot.
 for r in select n.nspname schema,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where c.relkind='r' and ((n.nspname='public' and c.relname in ('characters','character_profile_display','site_music_configuration'))
 or (n.nspname='auth' and c.relname='users')
 or (n.nspname='app_private' and (c.relname like 'combat_content_%' or c.relname like 'discipline_%' or c.relname like 'character_%' or c.relname like 'master_panel_%' or c.relname in ('world_environment_settings','world_environment_audit','battlefield_elevation_policy_versions','combat_effect_timing_policy_versions'))
 and c.relname not in ('master_panel_role_defaults','master_panel_activity','character_world_state','character_active_game_sessions','character_presence','character_live_presence'))) order by 1,2 loop
  execute format('select md5(coalesce(string_agg(to_jsonb(t)::text,E''\\n'' order by to_jsonb(t)::text),'''')) from %I.%I t',r.schema,r.name) into observed;
  baseline_data:=baseline_data||jsonb_build_object(r.schema||'.'||r.name,observed);
 end loop;
 select to_jsonb(d) into before_defaults from app_private.master_panel_role_defaults d where singleton;
"""
chunks=[preamble]
for i,p in enumerate(paths):
 source=p.read_text(); body=source.strip()
 assert body.startswith('begin;') and body.endswith('commit;'),p
 body=body[len('begin;'): -len('commit;')]
 assert "errcode='40001'" not in body, 'Unsafe custom retry code remains: '+str(p)
 b64=base64.b64encode(body.encode()).decode(); full=base64.b64encode(source.encode()).decode()
 version,name=p.stem.split('_',1)
 chunks += [f"\n execute convert_from(decode({q(b64)},'base64'),'UTF8');\n insert into supabase_migrations.schema_migrations(version,name,statements) values({q(version)},{q(name)},array[convert_from(decode({q(full)},'base64'),'UTF8')]);\n"]
chunks += [f"""
 for r in select key signature,value receipt from jsonb_each(baseline_functions) where key<>all(array[{','.join(q(s) for s in changed)}]::text[]) loop
  if to_regprocedure(r.signature) is null then raise exception 'MASTER_WORKSPACE_UNRELATED_FUNCTION_MISSING: %',r.signature; end if;
  select md5(pg_get_functiondef(p.oid)),p.proacl::text, p.proowner::text into observed,after_hash,expected_hash from pg_proc p where p.oid=to_regprocedure(r.signature);
  if observed is distinct from r.receipt->>'hash' or after_hash is distinct from r.receipt->>'acl' or expected_hash is distinct from r.receipt->>'owner' then raise exception 'MASTER_WORKSPACE_UNRELATED_FUNCTION_CHANGED: %',r.signature; end if;
 end loop;
 for r in select key table_name,value hash from jsonb_each_text(baseline_data) loop
  execute format('select md5(coalesce(string_agg(to_jsonb(t)::text,E''\\n'' order by to_jsonb(t)::text),'''')) from %s t',r.table_name) into observed;
  if observed is distinct from r.hash then raise exception 'MASTER_WORKSPACE_DURABLE_DATA_CHANGED: %',r.table_name; end if;
 end loop;
 select to_jsonb(d) into after_defaults from app_private.master_panel_role_defaults d where singleton;
 if (after_defaults->>'revision')::bigint<>(before_defaults->>'revision')::bigint+1 then raise exception 'MASTER_WORKSPACE_ROLE_CONVERSION_REVISION'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prosrc ~* 'errcode[[:space:]]*=[[:space:]]*''40001''') then raise exception 'MASTER_WORKSPACE_UNSAFE_DOMAIN_RETRY_CODE'; end if;
 for r in select * from jsonb_to_recordset({q(json.dumps([{'signature':r['signature'],'hash':r['hash'],'acl':r['acl']} for r in changed.values()]))}::jsonb) as expected(signature text,hash text,acl text) loop
  select md5(pg_get_functiondef(p.oid)),coalesce(p.proacl::text,'DEFAULT') into observed,after_hash from pg_proc p where p.oid=to_regprocedure(r.signature);
  if observed is distinct from r.hash or after_hash is distinct from r.acl then raise exception 'MASTER_WORKSPACE_POST_FUNCTION_CONFLICT: %',r.signature; end if;
 end loop;
 for r in select value source from jsonb_array_elements(sources) loop
  select md5(array_to_string(statements,'')) into observed from supabase_migrations.schema_migrations where version=r.source->>'version' and name=r.source->>'name';
  if observed is distinct from r.source->>'md5' then raise exception 'MASTER_WORKSPACE_CANONICAL_SOURCE_CONFLICT'; end if;
 end loop;
 raise notice 'Master workspace canonical sources=4, protected data sets=%, predecessor functions=30, checked changed/new functions={len(changed)}',(select count(*) from jsonb_object_keys(baseline_data));
end;
$panel_workspace_coordinator$;
"""]
output=''.join(chunks)
args.output.write_text(output)
print(json.dumps({'bytes':len(output.encode()),'sha256':hashlib.sha256(output.encode()).hexdigest(),'canonical':[p.name for p in paths]}))
