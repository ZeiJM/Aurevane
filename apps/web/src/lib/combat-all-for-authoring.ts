import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import {
  withCurrentAllTargetPolicy,
  type TargetedEffect,
} from '@aurevane/game-core/combat/combat-effect-target-authoring'

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Current detached drafts/requests only; immutable reads never adopt a targeting policy. */
export function combatAllForAuthoring<T>(definition: T): T {
  function visit(value: unknown, depth = 0): unknown {
    if (depth > 32 || !value || typeof value !== 'object') return value
    if (Array.isArray(value)) {
      const rows = value.map((row) => visit(row, depth + 1))
      return rows.some((row, index) => row !== value[index]) ? rows : value
    }
    if (!object(value)) return value
    let next = value
    for (const [key, child] of Object.entries(value)) {
      const current = visit(child, depth + 1)
      if (current !== child) next = { ...next, [key]: current }
    }
    if (Array.isArray(next.effects)) {
      const effects = next.effects.flatMap((effect) =>
        object(effect) ? [object(effect.payload) ? effect.payload : effect] : [],
      )
      for (const key of ['targeting', 'target']) {
        const target = next[key]
        if (!object(target) || typeof target.kind !== 'string') continue
        const current = withCurrentAllTargetPolicy(
          target as unknown as CombatTargetSpec,
          effects as unknown as TargetedEffect[],
        )
        if ((current as unknown) !== target) next = { ...next, [key]: current }
      }
    }
    return next
  }
  return visit(definition) as T
}
