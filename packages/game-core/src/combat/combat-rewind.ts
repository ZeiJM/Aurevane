import type {
  CombatActionDefinition,
  CombatActionEvaluation,
  CombatEncounterState,
} from './actions'
import type { GridPosition } from './board'
import { combatEvaluatedEffectRecipientIds } from './combat-effect-recipients'

/** Engine-owned positions captured before any paid command reactions or effect settlement. */
export type CombatRewindAnchors = Readonly<Record<string, GridPosition>>
export function copyCombatRewindAnchors(anchors: CombatRewindAnchors): CombatRewindAnchors {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(anchors).map(([id, position]) => [id, Object.freeze({ ...position })]),
    ),
  )
}
export function captureCombatRewindAnchors(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation,
  positionsState: CombatEncounterState = state,
): CombatRewindAnchors | undefined {
  const ids = [
    ...new Set(
      action.effects.flatMap((effect, ordinal) =>
        effect.type === 'return-to-turn-start' &&
        effect.target !== undefined &&
        effect.anchorMode === 'cast-position'
          ? combatEvaluatedEffectRecipientIds(state, action, evaluation, ordinal)
          : [],
      ),
    ),
  ]
  return ids.length
    ? copyCombatRewindAnchors(
        Object.fromEntries(
          ids.map((id) => [
            id,
            positionsState.tactical.placements.find((row) => row.combatantId === id)!.position,
          ]),
        ),
      )
    : undefined
}
export function validCombatRewindAnchors(
  state: CombatEncounterState,
  anchors: CombatRewindAnchors,
  recipients?: readonly string[],
): boolean {
  if (!anchors || typeof anchors !== 'object' || Array.isArray(anchors)) return false
  const ids = Object.keys(anchors)
  if (
    !ids.length ||
    (recipients &&
      (ids.length !== recipients.length || recipients.some((id) => !Object.hasOwn(anchors, id))))
  )
    return false
  return ids.every((id) => {
    const point = anchors[id]
    return (
      state.tactical.placements.some((row) => row.combatantId === id) &&
      !!point &&
      typeof point === 'object' &&
      !Array.isArray(point) &&
      Object.keys(point).length === 2 &&
      Object.keys(point).every((key) => key === 'x' || key === 'y') &&
      Number.isSafeInteger(point.x) &&
      Number.isSafeInteger(point.y) &&
      state.tactical.tiles.some(
        (tile) => tile.position.x === point.x && tile.position.y === point.y,
      )
    )
  })
}
