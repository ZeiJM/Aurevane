/** Disposable local-DB instrumentation: pause mutation RPCs after HTTP preparation,
 * before their unchanged authority/lock bodies. Always restore the original definitions. */
export const WORLD_MUTATION_GATE_SIGNATURES = [
  'public.start_world_encounter_v1(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb)',
  'public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text)',
] as const

export function gateWorldMutationDefinition(
  definition: string,
  application: string,
  characterIds: readonly string[],
): string {
  if (
    !/^atlas-gate-[a-f0-9-]+$/u.test(application) ||
    !characterIds.length ||
    characterIds.some((id) => !/^[a-f0-9-]{36}$/u.test(id))
  )
    throw new Error('Invalid disposable World gate identity.')
  const gate = ` if p_character_id=any(array[${characterIds.map((id) => `'${id}'::uuid`).join(',')}]) then
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('${application}',0));
 end if;\n`
  const result = definition.replace(/\nbegin\r?\n/i, (begin) => begin + gate)
  if (result === definition) throw new Error('World mutation gate predecessor changed.')
  return result
}

/** Diagnose only disposable fixture characters; preserve the original SQL failure. */
export function diagnoseWorldEquipmentDefinition(
  definition: string,
  application: string,
  characterIds: readonly string[],
): string {
  if (
    !/^atlas-gate-[a-f0-9-]+$/u.test(application) ||
    !characterIds.length ||
    characterIds.some((id) => !/^[a-f0-9-]{36}$/u.test(id))
  )
    throw new Error('Invalid disposable World diagnostic identity.')
  const handler = `exception when others then
 if p_character_id=any(array[${characterIds.map((id) => `'${id}'::uuid`).join(',')}]) then
 raise log 'AUREVANE_ATLAS_ITEM ${application} % %', SQLSTATE,
 case when SQLERRM in ('ITEM_ADMISSION_RETRY','ITEM_CATALOGUE_RETRY','ITEM_STALE_REVISION','ITEM_STALE_CATALOGUE','ITEM_BATTLE_ACTIVE') then SQLERRM else 'OTHER' end;
 raise log 'AUREVANE_ATLAS_LOCK ${application} %', (
 select coalesce(jsonb_agg(jsonb_build_object('lock',keys.name,'rpc',coalesce((
   select p.proname::text from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname::text ~ '^[a-z][a-z0-9_]{0,95}$'
   and strpos(activity.query,'"'||p.proname::text||'"')>0
   order by length(p.proname::text) desc,p.proname limit 1
 ),'other'))),'[]'::jsonb)
 from pg_catalog.pg_locks held join pg_catalog.pg_stat_activity activity on activity.pid=held.pid
 cross join (values ('catalogue',pg_catalog.hashtextextended('combat-catalogue-publication',0)),
 ('account0',pg_catalog.hashtextextended(p_user_id::text,0)),
 ('account1',pg_catalog.hashtextextended(p_user_id::text,1))) keys(name,key)
 where held.locktype='advisory' and held.granted and held.mode='ExclusiveLock'
 and held.database=(select oid from pg_catalog.pg_database where datname=pg_catalog.current_database())
 and held.pid<>pg_catalog.pg_backend_pid()
 and held.objsubid=1 and held.classid::bigint=((keys.key>>32)&4294967295)
 and held.objid::bigint=(keys.key&4294967295)
 );
 end if;
 raise;
`
  const result = definition.replace(
    /\nend;(?=\s*\$[a-z_]*\$)/i,
    (end) => '\n' + handler + end.trimStart(),
  )
  if (result === definition) throw new Error('World equipment diagnostic predecessor changed.')
  return result
}

export function parseWorldEquipmentErrors(logs: string, application: string) {
  if (!/^atlas-gate-[a-f0-9-]+$/u.test(application))
    throw new Error('Invalid disposable World diagnostic identity.')
  const pattern = new RegExp(
    `AUREVANE_ATLAS_ITEM ${application} ([0-9A-Z]{5}) (ITEM_ADMISSION_RETRY|ITEM_CATALOGUE_RETRY|ITEM_STALE_REVISION|ITEM_STALE_CATALOGUE|ITEM_BATTLE_ACTIVE|OTHER)$`,
  )
  return logs.split(/\r?\n/).flatMap((line) => {
    const match = pattern.exec(line)
    return match ? [{ sqlState: match[1]!, category: match[2]! }] : []
  })
}

export function parseWorldEquipmentLockHolders(logs: string, application: string) {
  if (!/^atlas-gate-[a-f0-9-]+$/u.test(application))
    throw new Error('Invalid disposable World diagnostic identity.')
  const pattern = new RegExp(`\\bLOG:\\s+AUREVANE_ATLAS_LOCK ${application} (.*)$`)
  return logs.split(/\r?\n/).flatMap((line) => {
    const match = pattern.exec(line)
    if (!match) return []
    const rows: unknown = JSON.parse(match[1]!)
    if (
      !Array.isArray(rows) ||
      rows.some(
        (row) =>
          !row ||
          Object.keys(row).sort().join(',') !== 'lock,rpc' ||
          !['catalogue', 'account0', 'account1'].includes(row.lock) ||
          typeof row.rpc !== 'string' ||
          !/^[a-z][a-z0-9_]{0,95}$/.test(row.rpc),
      )
    )
      throw new Error('Invalid disposable World lock diagnostic.')
    return [rows as { lock: string; rpc: string }[]]
  })
}
