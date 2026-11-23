/** Legacy district art repeats independently of the absolute expedition phase. */
export function worldArtPhasePeriod(sectorId: string) {
  const extra: Record<string, number> = {
    'uncharted-verge': 12,
    'uncharted-cinders': 12,
    'uncharted-relic': 30,
    'uncharted-tarn': 66,
    'uncharted-mirrors': 114,
    'uncharted-orchard': 78,
    'uncharted-pale': 102,
    'uncharted-geodes': 42,
  }
  return extra[sectorId] ?? 6
}

/** Run only through atlas-world's loopback-only SQL helper. Choose a real
 * cadence whose current phase has the requested art, with room for capture.
 * Neither the database clock nor return/command admission is overridden. */
export function worldArtCadenceSql(sectorId: string, representativePhase: number) {
  const period = worldArtPhasePeriod(sectorId)
  if (!Number.isSafeInteger(representativePhase) || representativePhase < 0)
    throw new Error('Invalid art phase.')
  return `with at as materialized (
    select floor(extract(epoch from clock_timestamp()) * 1000)::bigint now_ms
  ), candidates as (
    select minutes, now_ms, now_ms / (minutes::bigint * 60000) phase
    from at cross join generate_series(1,10080) minutes
  )
  update app_private.world_environment_settings
  set warped_shift_minutes = (
    select minutes from candidates
    where phase % ${period} = ${representativePhase % period}
      and (phase + 1) * minutes::bigint * 60000 - 60000 - now_ms > 240000
    order by minutes desc limit 1
  ) where singleton;`
}
