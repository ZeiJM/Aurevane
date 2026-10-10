import { PV1F_TURN_ACTIVITY_RESOURCE_KEY } from './pv1f-turn-activity'
import type { CombatEncounterState, CombatResolutionTransition } from './actions-legacy'
import { advanceSkillCooldownsAtOwnerTurnStart } from './skill-cooldowns'
import type { BattleTemporaryResource } from './battle-state'
export const PV1F_ACTION_ECONOMY_MAXIMUM = 100 as const
export const PV1F_ACTION_ECONOMY_RESOURCE_KEY = 'pv1f.action-economy' as const
export const PV1F_ACTION_ECONOMY_TURN_KEY = 'pv1f.action-economy-turn' as const
export function prepareNativePv1fTurn<T extends CombatEncounterState>(
  state: T,
  existingOnly = false,
): { state: T; events: CombatResolutionTransition['events'] } {
  const battle = state.tactical.battle
  const turn = battle.currentTurn
  if (battle.lifecycle !== 'active' || !turn) return { state, events: [] }

  const actor = battle.combatants.find((unit) => unit.id === turn.combatantId)!
  const marker = actor.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_TURN_KEY,
  )
  const economy = actor.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  )
  if (marker?.current === battle.turnNumber && economy) return { state, events: [] }

  if (
    existingOnly &&
    !battle.combatants.some((unit) =>
      unit.temporaryResources.some((resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY),
    )
  )
    return { state, events: [] }
  const placement = state.tactical.placements.find((unit) => unit.combatantId === actor.id)!
  state = {
    ...state,
    turnOrigin: {
      combatantId: actor.id,
      turnNumber: battle.turnNumber,
      position: { ...placement.position },
    },
  }
  const cooldownTransition = advanceSkillCooldownsAtOwnerTurnStart(actor)
  const resources = replaceResources(cooldownTransition.combatant.temporaryResources, [
    ...(state.abilityRuntime
      ? [
          {
            key: PV1F_TURN_ACTIVITY_RESOURCE_KEY,
            current: Math.max(0, battle.turnNumber - 1),
            maximum: Number.MAX_SAFE_INTEGER,
          },
        ]
      : []),
    {
      key: PV1F_ACTION_ECONOMY_RESOURCE_KEY,
      current: PV1F_ACTION_ECONOMY_MAXIMUM,
      maximum: PV1F_ACTION_ECONOMY_MAXIMUM,
    },
    {
      key: PV1F_ACTION_ECONOMY_TURN_KEY,
      current: battle.turnNumber,
      maximum: Number.MAX_SAFE_INTEGER,
    },
  ])

  return {
    state: {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...battle,
          combatants: battle.combatants.map((unit) =>
            unit.id === actor.id
              ? { ...cooldownTransition.combatant, temporaryResources: resources }
              : unit,
          ),
          currentTurn: { ...turn, actionState: 'ready' },
        },
      },
    },
    events: cooldownTransition.events,
  }
}

function replaceResources(
  current: readonly BattleTemporaryResource[],
  replacements: readonly BattleTemporaryResource[],
): readonly BattleTemporaryResource[] {
  const replacementKeys = new Set(replacements.map((resource) => resource.key))
  return [
    ...current
      .filter((resource) => !replacementKeys.has(resource.key))
      .map((resource) => ({ ...resource })),
    ...replacements.map((resource) => ({ ...resource })),
  ].sort((left, right) => left.key.localeCompare(right.key))
}
