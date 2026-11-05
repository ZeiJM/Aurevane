import { expect, it } from 'vitest'
import { endCombatTurn, validateCombatEncounterState } from './actions'
import { selectCurrentFinalFacing } from './board'
import { combatItemStock } from './combat-item-consumption'
import type { AbilityBehavior } from './combat-definition'
import { itemFixture } from '../content/items-test-fixtures'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { captureEquipmentAbilitySource } from './combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
  primeCombatControlledAbility,
  cancelCombatControlledAbility,
} from './combat-behavior-runtime'
import { commitCombatAbilityCommand, prepareCombatAbilityCommand } from './combat-ability-command'
import { PV1F_COMBAT_CONTENT } from './pv1f-combat-content'
import type { BattleEquipmentCapture } from './combat-equipment'

function consumableScenario(quantity = 2, current = true, behavior: Partial<AbilityBehavior> = {}) {
  const definition = source({ costs: [], maximumUsesPerBattle: 3, ...behavior }).definition
  const item = itemFixture({
    itemClass: 'battle-item',
    inventoryCategory: 'battle-items',
    equipment: { slot: 'hand', hands: 1 },
    maximumStack: 99,
    ability: definition,
    actions: { use: { behaviorId: 'strike', name: 'Use' } },
    battleUses: 3,
  })
  const capture = {
    schemaVersion: 2,
    inventoryRevision: 0,
    selectedSupport: { kind: 'basic', actionId: 'basic.pilfer' },
    ...(current ? { consumptionPolicyVersion: 1 } : {}),
    equipment: [
      {
        position: 'consumable-1',
        ownedStackId: 'owned-potion',
        item,
        ...(current ? { ownedQuantity: quantity } : {}),
      },
    ],
  } as BattleEquipmentCapture
  const captured = captureEquipmentAbilitySource(capture, capture.equipment[0]!, 'actor')!
  const state = reconcileCombatAbilitySources(
    { ...percentageDotEncounter(), effectTimingPolicy: { version: 1, modes: {} } },
    [captured],
  )
  const command = (next = state) => ({
    state: next,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(next, captured),
  })
  return { state, captured, capture, command }
}
it('consumes one exact owned unit on each accepted Item use and rejects exhausted stock before costs', () => {
  const f = consumableScenario()
  const before = JSON.stringify(f.state)
  const first = commitCombatAbilityCommand(f.command())
  expect(first.state.itemConsumptionState).toEqual({
    version: 1,
    consumed: [{ sourceInstanceId: f.captured.sourceInstanceId, count: 1 }],
  })
  const second = commitCombatAbilityCommand(f.command(JSON.parse(JSON.stringify(first.state))))
  expect(second.state.itemConsumptionState?.consumed[0]?.count).toBe(2)
  expect(prepareCombatAbilityCommand(f.command(second.state)).evaluation.legal).toBe(false)
  expect(() => commitCombatAbilityCommand(f.command(second.state))).toThrow()
  expect(JSON.stringify(f.state)).toBe(before)
})
it('charges stock for an accepted miss and rejects a duplicate accepted command without a second charge', () => {
  const f = consumableScenario(2, true, { accuracy: { kind: 'fixed', chanceBasisPoints: 0 } })
  const input = f.command(),
    out = commitCombatAbilityCommand(input)
  expect(out.events.filter((event) => event.event === 'damage_applied')).toEqual([])
  expect(combatItemStock(out.state, f.captured)).toBe(1)
  expect(() => commitCombatAbilityCommand({ ...input, state: out.state })).toThrow()
  expect(combatItemStock(out.state, f.captured)).toBe(1)
})
it('consumes once at delayed activation and never for the later queued damage', () => {
  const f = consumableScenario(2, true, {
    effects: [
      {
        id: 'hit',
        timing: 'next-round',
        payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
      },
    ],
  })
  let state = commitCombatAbilityCommand(f.command()).state
  expect(state.pendingEffects).toHaveLength(1)
  for (let i = 0; i < 4; i++)
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      PV1F_COMBAT_CONTENT,
    ).state
  expect(state.pendingEffects ?? []).toHaveLength(0)
  expect(combatItemStock(state, f.captured)).toBe(1)
})
it('keeps Controlled preparation and cancellation free, then consumes at accepted release', () => {
  const f = consumableScenario(2, true, {
    effects: [
      {
        id: 'hit',
        timing: 'controlled',
        payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
      },
    ],
  })
  const input = {
    state: f.state,
    actorId: 'actor',
    sourceInstanceId: f.captured.sourceInstanceId,
    behaviorId: 'strike',
    content: PV1F_COMBAT_CONTENT,
  }
  const prime = primeCombatControlledAbility(input)
  expect(prime.state.itemConsumptionState).toBeUndefined()
  const cancel = cancelCombatControlledAbility({ ...input, state: prime.state })
  expect(cancel.state.itemConsumptionState).toBeUndefined()
  const used = commitCombatAbilityCommand(f.command(prime.state))
  expect(combatItemStock(used.state, f.captured)).toBe(1)
})
it('retains independent battle use caps and rejects malformed restored consumption receipts', () => {
  const f = consumableScenario(7)
  let state = f.state
  for (let i = 0; i < 3; i++) state = commitCombatAbilityCommand(f.command(state)).state
  expect(combatItemStock(state, f.captured)).toBe(4)
  expect(prepareCombatAbilityCommand(f.command(state)).evaluation.legal).toBe(false)
  const fresh = consumableScenario(4)
  expect(prepareCombatAbilityCommand(fresh.command()).evaluation.legal).toBe(true)
  for (const count of [0, -1, 8, 1.1])
    expect(
      validateCombatEncounterState({
        ...state,
        itemConsumptionState: {
          version: 1,
          consumed: [{ sourceInstanceId: f.captured.sourceInstanceId, count }],
        },
      }).some((issue) => issue.field === 'itemConsumptionState'),
    ).toBe(true)
})
it('does not consume stock for previews, rejected targets or retained historical captures', () => {
  const current = consumableScenario()
  expect(prepareCombatAbilityCommand(current.command()).evaluation.legal).toBe(true)
  expect(current.state.itemConsumptionState).toBeUndefined()
  expect(() =>
    commitCombatAbilityCommand({
      ...current.command(),
      selection: { kind: 'unit', combatantId: 'missing' },
    }),
  ).toThrow()
  expect(current.state.itemConsumptionState).toBeUndefined()
  const old = consumableScenario(1, false)
  const once = commitCombatAbilityCommand(old.command())
  const twice = commitCombatAbilityCommand(old.command(once.state))
  expect(twice.state.itemConsumptionState).toBeUndefined()
})
