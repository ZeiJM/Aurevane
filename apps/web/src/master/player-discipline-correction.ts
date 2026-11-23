import type { MasterPlayerFacts, PlayerCorrection } from './players'

/** Build the exact change flags consumed by the authoritative Discipline command. */
export function disciplineCorrectionFromForm(
  build: MasterPlayerFacts['build'],
  data: { get(name: string): unknown },
): Extract<PlayerCorrection, { kind: 'disciplines' }> {
  const primary = String(data.get('primary'))
  const secondary = String(data.get('secondary')) || null
  const changePrimary = primary !== build.primary.disciplineId
  const changeSecondary = secondary !== (build.secondary?.disciplineId ?? null)
  if (!changePrimary && !changeSecondary)
    throw new Error('Choose a different Primary or Secondary.')
  return {
    kind: 'disciplines',
    ...(changePrimary ? { primary } : {}),
    ...(changeSecondary ? { secondary } : {}),
  }
}
