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
