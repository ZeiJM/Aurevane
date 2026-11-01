import type { CombatGroundAreaDefinition } from '@aurevane/game-core/combat/combat-ground-areas'
import { retireAuthoredFrozenGround, hasSharedGroundAim } from './combat-effect-dependencies'
interface EntryEffect {
  readonly type: string
  readonly authoringLink?: string
  readonly statusId?: string
}
/** Retain entry references across insertions, moves and removals in the native editor. */
export function withRemappedGroundEntries<
  T extends {
    readonly effects: readonly EntryEffect[]
    readonly groundArea?: CombatGroundAreaDefinition
    readonly target?: unknown
  },
>(previous: T, next: T): T {
  if (
    !previous.groundArea ||
    next.groundArea !== previous.groundArea ||
    next.effects === previous.effects
  )
    return next
  const retired = retireAuthoredFrozenGround(previous.effects, {
    inheritedGround: hasSharedGroundAim(previous.target),
  })
  const replacements = retired.replacements
  const entryEffectOrdinals = [
    ...new Set(
      previous.groundArea.entryEffectOrdinals.flatMap((ordinal) => {
        const source = previous.effects[ordinal]
        if (!source) return []
        const replacement = replacements.get(source)
        let index = next.effects.findIndex(
          (row) =>
            row === source ||
            row === replacement ||
            (replacement &&
              row.type === replacement.type &&
              row.authoringLink === replacement.authoringLink &&
              (replacement.authoringLink !== undefined || next.effects[ordinal] === row)) ||
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
        const projected = retired.effects.indexOf(replacement ?? source)
        if (
          index < 0 &&
          projected >= 0 &&
          next.effects.length === retired.effects.length &&
          next.effects[projected]?.type === (replacement ?? source).type
        )
          index = projected
        return index < 0 ? [] : [index]
      }),
    ),
  ]
  if (entryEffectOrdinals.length)
    return {
      ...next,
      groundArea: {
        ...previous.groundArea,
        entryEffectOrdinals,
        ...(replacements.size ? { contactPolicyVersion: 1 as const } : {}),
      },
    }
  const { groundArea: removed, ...rest } = next
  void removed
  return rest as T
}
