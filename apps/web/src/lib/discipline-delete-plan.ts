export interface DisciplineDeletePlan {
  readonly token: string
  readonly records: readonly {
    readonly contentKey: string
    readonly contentKind: 'discipline' | 'skill' | 'essence' | 'resonance'
    readonly name: string
    readonly revision: number
  }[]
  readonly blockers: readonly {
    readonly contentKey: string
    readonly kind: string
    readonly key: string
    readonly name: string
  }[]
  readonly blockerCount: number
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0
export function parseDisciplineDeletePlan(value: unknown): DisciplineDeletePlan {
  if (
    !object(value) ||
    typeof value.token !== 'string' ||
    !/^[a-f0-9]{32}$/.test(value.token) ||
    !Array.isArray(value.records) ||
    value.records.length < 1 ||
    value.records.length > 257 ||
    !value.records.every(
      (row) =>
        object(row) &&
        text(row.contentKey) &&
        text(row.name) &&
        ['discipline', 'skill', 'essence', 'resonance'].includes(String(row.contentKind)) &&
        Number.isSafeInteger(row.revision) &&
        (row.revision as number) > 0,
    ) ||
    !Array.isArray(value.blockers) ||
    value.blockers.length > 100 ||
    !value.blockers.every(
      (row) =>
        object(row) && text(row.contentKey) && text(row.kind) && text(row.key) && text(row.name),
    ) ||
    !Number.isSafeInteger(value.blockerCount) ||
    (value.blockerCount as number) < value.blockers.length
  ) {
    throw new Error('The deletion review is unavailable. Refresh and try again.')
  }
  return value as unknown as DisciplineDeletePlan
}

export function disciplineDeleteBlockerLink(
  blocker: DisciplineDeletePlan['blockers'][number],
): string {
  if (
    [
      'active-discipline',
      'personal-core-profile',
      'earned-skill',
      'equipped-skill',
      'saved-loadout',
      'discipline-skill-grant',
    ].includes(blocker.kind)
  )
    return `/master/players?characterId=${encodeURIComponent(blocker.key.split(':')[0]!)}`
  return `/master/combat-content?contentKey=${encodeURIComponent(blocker.kind === 'player-grant' ? blocker.contentKey : blocker.key)}`
}
