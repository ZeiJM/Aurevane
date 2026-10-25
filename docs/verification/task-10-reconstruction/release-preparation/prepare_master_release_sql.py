"""Generate (never execute) a guarded original-identity migration batch."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


CAPTURE = """
create temporary table av_master_facts(
 name text primary key, relation_oid oid, file_oid oid, columns text[], types jsonb,
 logical boolean, rows bigint, digest text
) on commit drop;
do $av_capture$
declare t record; cols text[]; ty jsonb; n bigint; h text; logical boolean;
begin
 for t in select c.oid,c.relname,pg_relation_filenode(c.oid) file_oid
   from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
   where ns.nspname='app_private' and c.relkind='r' order by c.relname loop
  select array_agg(a.attname::text order by a.attnum),
   jsonb_object_agg(a.attname,jsonb_build_array(a.atttypid,a.atttypmod)) into cols,ty
   from pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped;
  logical:=t.relname=any(array['character_build_discipline_skills','world_environment_settings',
   'combat_content_versions','combat_content_publications','combat_content_drafts']);
  if logical then
   execute format('select count(*),encode(sha256(convert_to(coalesce(string_agg(h,%L order by h),%L),%L)),%L) from (select encode(sha256(convert_to(to_jsonb(r)::text,%L)),%L) h from app_private.%I r) s',
    '', '', 'UTF8', 'hex', 'UTF8', 'hex',t.relname) into n,h;
  else
   execute format('select count(*),encode(sha256(convert_to(coalesce(string_agg(ctid::text||%L||xmin::text,%L order by ctid),%L),%L)),%L) from app_private.%I',
    ':', '', '', 'UTF8', 'hex',t.relname) into n,h;
  end if;
  insert into av_master_facts values(t.relname,t.oid,t.file_oid,cols,ty,logical,n,h);
 end loop;
end; $av_capture$;
"""

COMPARE = """
do $av_compare$
declare t record; relation oid; file_oid oid; ty jsonb; extra text[]; n bigint; h text;
begin
 for t in select * from av_master_facts order by name loop
  relation:=to_regclass(format('app_private.%I',t.name));
  if relation is distinct from t.relation_oid then raise exception 'MASTER_TABLE_IDENTITY_CHANGED: %',t.name; end if;
  select jsonb_object_agg(a.attname,jsonb_build_array(a.atttypid,a.atttypmod)) into ty
   from pg_attribute a where a.attrelid=relation and a.attnum>0 and not a.attisdropped
   and a.attname=any(t.columns);
  if ty is distinct from t.types then raise exception 'MASTER_OLD_COLUMN_TYPE_CHANGED: %',t.name; end if;
  if t.logical then
   select coalesce(array_agg(a.attname::text),array[]::text[]) into extra from pg_attribute a
    where a.attrelid=relation and a.attnum>0 and not a.attisdropped and not(a.attname=any(t.columns));
   execute format('select count(*),encode(sha256(convert_to(coalesce(string_agg(h,%L order by h),%L),%L)),%L) from (select encode(sha256(convert_to((to_jsonb(r)-$1)::text,%L)),%L) h from app_private.%I r) s',
    '', '', 'UTF8', 'hex', 'UTF8', 'hex',t.name) into n,h using extra;
  else
   file_oid:=pg_relation_filenode(relation);
   if file_oid is distinct from t.file_oid then raise exception 'MASTER_PROTECTED_TABLE_REWRITTEN: %',t.name; end if;
   execute format('select count(*),encode(sha256(convert_to(coalesce(string_agg(ctid::text||%L||xmin::text,%L order by ctid),%L),%L)),%L) from app_private.%I',
    ':', '', '', 'UTF8', 'hex',t.name) into n,h;
  end if;
  if n is distinct from t.rows or h is distinct from t.digest then
   raise exception 'MASTER_PROTECTED_FACTS_CHANGED: %',t.name;
  end if;
 end loop;
end; $av_compare$;
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--git-dir', required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    source = manifest['source']
    git = lambda *a: subprocess.check_output(['git', '--git-dir=' + args.git_dir, *a])
    if git('rev-parse', source + '^{tree}').decode().strip() != manifest['tree']:
        raise ValueError('Manifest tree does not match source')
    history_sha = manifest['observedHostedHistorySha256']
    if not re.fullmatch(r'[0-9a-f]{64}', history_sha):
        raise ValueError('Missing exact hosted-history baseline')
    originals = manifest['pendingOriginals']
    versions = [m['version'] for m in originals]
    if not versions or versions != sorted(set(versions)):
        raise ValueError('Originals must be ordered and unique')
    bodies, history = [], []
    for item in originals:
        raw = git('show', source + ':' + item['path'])
        if len(raw) != item['bytes'] or hashlib.sha256(raw).hexdigest() != item['sha256']:
            raise ValueError('Source digest mismatch: ' + item['path'])
        sql = raw.decode('utf-8')
        lines = sql.splitlines(keepends=True)
        starts = [i for i, s in enumerate(lines) if re.fullmatch(r'begin;\s*', s, re.I)]
        last = max(i for i, s in enumerate(lines) if s.strip())
        if len(starts) != 1 or starts[0] > 10 or not re.fullmatch(r'commit;\s*', lines[last], re.I):
            raise ValueError('Unexpected outer transaction: ' + item['path'])
        tag = '$av_source_' + item['version'] + '$'
        if tag in sql:
            raise ValueError('Source delimiter collision')
        bodies.append('-- Original ' + item['version'] + ' SHA256 ' + item['sha256'] + '\n' +
                      ''.join(s for i, s in enumerate(lines) if i not in (starts[0], last)))
        history.append('(' + literal(item['version']) + ',' + literal(item['name']) +
                       ',array[' + tag + sql + tag + ']::text[])')
    count = int(manifest['observedHostedHistoryRows'])
    array = 'array[' + ','.join(literal(v) for v in versions) + ']::text[]'
    aliases = []
    for alias in manifest['priorAliasesExactBytesAndSHA']:
        aliases.append("if not exists(select 1 from supabase_migrations.schema_migrations where version=" +
                       literal(alias['hostedVersion']) + ' and name=' + literal(alias['name']) +
                       ' and cardinality(statements)=1 and octet_length(statements[1])=' + str(alias['bytes']) +
                       " and encode(sha256(convert_to(statements[1],'UTF8')),'hex')=" + literal(alias['sha256']) +
                       ") then raise exception 'MASTER_LEGACY_ALIAS_CHANGED'; end if;")
    accepted = manifest.get('status') == 'accepted-for-release'
    banner = 'REVIEWED RELEASE' if accepted else 'PROVISIONAL: DO NOT EXECUTE BEFORE FINAL ACCEPTANCE'
    preamble = f"""-- {banner}; source {source}
-- Exact source/history identities; no roster publication or historical repair.
begin isolation level repeatable read;
set local lock_timeout='5s';
set local statement_timeout='120s';
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $av_preflight$
begin
 if (select count(*) from supabase_migrations.schema_migrations)<>{count} then raise exception 'MASTER_HISTORY_COUNT_CHANGED'; end if;
 if (select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(m) order by version),'[]'::jsonb)::text,'UTF8')),'hex') from supabase_migrations.schema_migrations m)<>{literal(history_sha)} then raise exception 'MASTER_HISTORY_CONTENT_CHANGED'; end if;
 if exists(select 1 from supabase_migrations.schema_migrations where version=any({array})) then raise exception 'MASTER_ORIGINAL_ALREADY_PRESENT_REFRESH_MANIFEST'; end if;
 {chr(10).join(aliases)}
end; $av_preflight$;
"""
    post = f"""
insert into supabase_migrations.schema_migrations(version,name,statements) values
{','.join(history)};
{COMPARE}
do $av_history_check$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>{count + len(versions)} then raise exception 'MASTER_HISTORY_POSTFLIGHT_CHANGED'; end if;
end; $av_history_check$;
select jsonb_build_object('source',{literal(source)},'originalsApplied',{len(versions)},
 'privateTablesProtected',(select count(*) from av_master_facts)) as verified_release_transaction;
commit;
"""
    text = preamble + CAPTURE + '\n'.join(bodies) + post
    args.output.write_text(text)
    print(json.dumps({'source': source, 'originals': len(versions), 'bytes': len(text.encode()),
                      'sha256': hashlib.sha256(text.encode()).hexdigest(), 'executed': False}))


if __name__ == '__main__':
    main()
