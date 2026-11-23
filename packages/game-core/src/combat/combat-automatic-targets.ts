import type { CombatEncounterState } from './actions'
import type { AbilityTargeting } from './combat-definition'
import { combatTargetUnitCategoryAllowed } from './combat-targeting-shapes'

export const AUTOMATIC_ABILITY_TARGET_SELECTORS = [
  'nearest-enemy',
  'nearest-ally',
  'lowest-hp-enemy',
  'lowest-hp-ally',
] as const
export type AutomaticAbilityTargetSelector = (typeof AUTOMATIC_ABILITY_TARGET_SELECTORS)[number]
export function isAutomaticAbilityTargetSelector(
  value: unknown,
): value is AutomaticAbilityTargetSelector {
  return AUTOMATIC_ABILITY_TARGET_SELECTORS.includes(value as AutomaticAbilityTargetSelector)
}

/** Selectors choose an anchor, without broadening its authored delivery or recipients. */
export function automaticAbilityTargetSelectorSubjects(
  target: AbilityTargeting | null,
): readonly AutomaticAbilityTargetSelector[] {
  if (
    !target ||
    (target.categories !== undefined && !Array.isArray(target.categories)) ||
    !['unit', 'ground-tile'].includes(target.kind) ||
    !['single', 'line'].includes(target.shape?.kind)
  )
    return []
  const owner = { id: 'owner', teamId: 'owner-team' }
  return AUTOMATIC_ABILITY_TARGET_SELECTORS.filter((rule) => {
    if (target.kind === 'ground-tile')
      return target.geometryVersion !== 3 || target.categories?.includes('ground') === true
    const ally = rule.endsWith('ally')
    return combatTargetUnitCategoryAllowed(target, owner, {
      id: 'anchor',
      teamId: ally ? owner.teamId : 'enemy-team',
    })
  })
}

/** Stable ordering only; canonical command admission must still approve each candidate. */
export function automaticAbilityTargetCandidates(
  state: CombatEncounterState,
  ownerId: string,
  rule: AutomaticAbilityTargetSelector,
): readonly string[] {
  const owner = state.tactical.battle.combatants.find((unit) => unit.id === ownerId)
  const origin = state.tactical.placements.find((row) => row.combatantId === ownerId)?.position
  if (!owner || !origin) return []
  const ally = rule.endsWith('ally')
  return state.tactical.battle.combatants
    .flatMap((unit) => {
      const position = state.tactical.placements.find(
        (row) => row.combatantId === unit.id,
      )?.position
      return unit.id !== ownerId &&
        unit.hp > 0 &&
        (unit.teamId === owner.teamId) === ally &&
        position
        ? [
            {
              id: unit.id,
              hp: unit.hp,
              distance: Math.abs(position.x - origin.x) + Math.abs(position.y - origin.y),
            },
          ]
        : []
    })
    .sort(
      (a, b) =>
        (rule.startsWith('lowest-hp') ? a.hp - b.hp : 0) ||
        a.distance - b.distance ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .map((unit) => unit.id)
}
