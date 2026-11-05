import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { starterItemDefinitions } from '../content/starter-items'
import { parseRuntimeItemDefinition, type RuntimeItemDefinition } from '../content/items'
import { captureEquipmentAbilitySource } from './combat-behavior-capture'
import { type BattleEquipmentCapture } from './combat-equipment'
import { activateCombatAbilitySources, commitCombatAbilityCommand } from './combat-ability-command'
import {
  combatAbilityCommandContext,
  materializeCombatAbilityAction,
} from './combat-behavior-runtime'
import { executeCombatAction, endCombatTurn, type CombatEncounterState } from './actions'
import { selectCurrentFinalFacing } from './board'
import { PV1F_COMBAT_CONTENT, preparePv1fTurnEconomy } from './pv1f-action-economy'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { source } from './combat-behavior.test-utils'

const packets = [
  { element: 'fire' as const },
  { element: 'water' as const },
  { element: 'ice' as const },
  { element: 'storm' as const },
  {},
  { piercing: true },
  { piercing: true, element: 'fire' as const },
]
function attack(
  effects: readonly object[] = packets.map((packet) => ({
    type: 'damage',
    recipient: 'primary-unit',
    amount: 100,
    ...packet,
  })),
) {
  const root = source({ costs: [] })
  return {
    ...materializeCombatAbilityAction(root, root.definition.behaviors[0]!),
    effectTimingModes: undefined,
    effectOrigins: undefined,
    effects,
  } as ReturnType<typeof materializeCombatAbilityAction>
}
function ready(item: RuntimeItemDefinition) {
  const capture: BattleEquipmentCapture = {
    schemaVersion: 2,
    inventoryRevision: 1,
    selectedSupport: {
      kind: 'equipment',
      position: 'main-hand',
      itemId: item.id,
      behaviorId: 'kindle',
    },
    equipment: [{ position: 'main-hand', ownedStackId: 'private-emberbrand', item }],
  }
  const captured = captureEquipmentAbilitySource(capture, capture.equipment[0]!, 'actor')!
  const state = activateCombatAbilitySources(
    preparePv1fTurnEconomy(percentageDotEncounter()),
    [captured],
    PV1F_COMBAT_CONTENT,
    true,
  ).state
  return commitCombatAbilityCommand({
    state,
    actorId: 'actor',
    root: { kind: 'canonical', source: captured, behaviorId: 'kindle' },
    selection: { kind: 'self' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }).state
}
function damage(state: CombatEncounterState, effects?: readonly object[]) {
  return executeCombatAction(
    state,
    attack(effects),
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  )
    .events.filter((event) => event.event === 'damage_applied')
    .map((event) => event.amount)
}
const emberbrand = () => starterItemDefinitions().find((item) => item.id === 'emberbrand')!

it('casts actual equipped Kindle as Fire-only Damage Up, has no held passive and retains scope after reload', () => {
  const state = ready(emberbrand())
  const buff = state.statusState
    .find((row) => row.combatantId === 'actor')!
    .statuses.find((row) => row.statusId === 'inspired')!
  expect(buff.damageTypes).toEqual(['fire'])
  expect(damage(state)).toEqual([110, 100, 100, 100, 100, 100, 110])
  expect(damage(JSON.parse(JSON.stringify(state)))).toEqual([110, 100, 100, 100, 100, 100, 110])
})

it('retains All Damage for an already captured absent-scope Kindle version', () => {
  const current = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/verification/2026-11-05-item-description-successors.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ).candidates.find((row: { itemId: string }) => row.itemId === 'emberbrand')
    .reviewedSourceDefinition as RuntimeItemDefinition
  const old = parseRuntimeItemDefinition({
    ...current,
    contentVersion: 3,
    ability: {
      ...current.ability!,
      behaviors: current.ability!.behaviors.map((group) => ({
        ...group,
        effects: group.effects.map((effect) => {
          if (group.id !== 'kindle') return effect
          const payload = Object.fromEntries(
            Object.entries(effect.payload).filter(([key]) => key !== 'damageTypes'),
          )
          return { ...effect, payload }
        }),
      })),
    },
  })
  const state = ready(old)
  expect(damage(JSON.parse(JSON.stringify(state)))).toEqual([121, 110, 110, 110, 110, 110, 121])
})

it('removes only Kindle boost through ordinary Dispel and two-turn expiry without leaving an equipped Fire passive', () => {
  const state = ready(emberbrand())
  const removed = executeCombatAction(
    state,
    attack([
      {
        type: 'remove-status',
        recipient: 'actor',
        selectionKind: 'buffs',
        removalMode: 'specified',
        statusIds: ['inspired'],
      },
    ]),
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  ).state
  expect(damage(removed)).toEqual([100, 100, 100, 100, 100, 100, 100])
  let expired = state
  for (let index = 0; index < 12; index++)
    expired = endCombatTurn(
      { ...expired, tactical: selectCurrentFinalFacing(expired.tactical, 'west').state },
      PV1F_COMBAT_CONTENT,
    ).state
  expect(damage(expired)).toEqual([100, 100, 100, 100, 100, 100, 100])
})
