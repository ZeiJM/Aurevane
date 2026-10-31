import type { CombatGroundAreaDefinition } from '@aurevane/game-core/combat/combat-ground-areas'
interface EntryEffect {
  readonly type: string
  readonly authoringLink?: string
}
/** Retain entry references across insertions, moves and removals in the native editor. */
export function withRemappedGroundEntries<
  T extends {
    readonly effects: readonly EntryEffect[]
    readonly groundArea?: CombatGroundAreaDefinition
  },
>(previous: T, next: T): T {
  if (
    !previous.groundArea ||
    next.groundArea !== previous.groundArea ||
    next.effects === previous.effects
  )
    return next
  const entryEffectOrdinals = previous.groundArea.entryEffectOrdinals.flatMap((ordinal) => {
    const source = previous.effects[ordinal]
    if (!source) return []
    let index = next.effects.findIndex(
      (row) =>
        row === source ||
        (source.authoringLink &&
          row.authoringLink === source.authoringLink &&
          row.type === source.type),
    )
    if (
      index < 0 &&
      previous.effects.length === next.effects.length &&
      next.effects[ordinal]?.type === source.type
    )
      index = ordinal
    return index < 0 ? [] : [index]
  })
  if (entryEffectOrdinals.length)
    return { ...next, groundArea: { ...previous.groundArea, entryEffectOrdinals } }
  const { groundArea: removed, ...rest } = next
  void removed
  return rest as T
}
