import { validateCombatActionDefinition } from './combat-authoring-validation'
import { expect, it } from 'vitest'
import {
  evaluateCombatAction,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEffectDefinition,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT } from './pv1f-combat-content'
import { createAuthorableEffectPayload } from './combat-effect-authoring'
import { nativeCombatTagPayload, validateCombatTagPayload } from './combat-tag-registry'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source } from './combat-behavior.test-utils'
import {
  activateCombatAbility,
  evaluateCombatAbility,
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'

function world() {
  const state = percentageDotEncounter()
  return {
    ...state,
    effectTimingPolicy: { version: 8, modes: { 'remove-status': 'instant' as const } },
    statusState: state.statusState.map((row) =>
      row.combatantId === 'enemy'
        ? {
            ...row,
            statuses: ['guarded', 'invisible'].map((statusId) => ({
              statusId,
              statusVersion: 1,
              stacks: 1,
              remainingOwnerTurnStarts: 2,
              sourceCombatantId: 'enemy',
            })),
          }
        : row,
    ),
  }
}
function action(effects: readonly CombatEffectDefinition[]): CombatActionDefinition {
  return {
    id: 'test.dispel-invisible',
    version: 1,
    sourceType: 'test',
    tags: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects,
  }
}
const target = { kind: 'unit' as const, combatantId: 'enemy' }
const dispel = () => nativeCombatTagPayload(createAuthorableEffectPayload('dispel')!)
it.each([0, 1])(
  'lets a current Dispel at ordinal %s select Invisible without granting other packets access',
  (ordinal) => {
    const state = world()
    const selected = { ...dispel(), statusIds: ['guarded'] } as CombatEffectDefinition
    const damage: CombatEffectDefinition = { type: 'damage', recipient: 'primary-unit', amount: 20 }
    const definition = action(ordinal === 0 ? [selected, damage] : [damage, selected])
    expect(evaluateCombatAction(state, definition, target, PV1F_COMBAT_CONTENT).issues).toEqual([])
    const result = executeCombatAction(state, definition, target, PV1F_COMBAT_CONTENT)
    expect(
      result.state.statusState
        .find((row) => row.combatantId === 'enemy')!
        .statuses.map((row) => row.statusId),
    ).toEqual(['invisible'])
    expect(result.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(1000)
    expect(result.events.some((event) => event.event === 'damage_applied')).toBe(false)
  },
)
it('removes Invisible through current All Buffs while ordinary trailing damage, Poison and debuffs stay blocked', () => {
  const state = world()
  const definition = action([
    dispel(),
    { type: 'damage', recipient: 'primary-unit', amount: 20 },
    { type: 'poison', recipient: 'primary-unit' },
    { type: 'apply-status', recipient: 'primary-unit', statusId: 'slow', stacks: 1 },
  ])
  const result = executeCombatAction(state, definition, target, PV1F_COMBAT_CONTENT)
  expect(result.state.statusState.find((row) => row.combatantId === 'enemy')!.statuses).toEqual([])
  expect(result.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(1000)
  expect(result.state.effectState?.poison ?? []).toEqual([])
})
it.each(['self', 'ally'] as const)(
  'does not admit an enemy Invisible target through a %s-only Dispel packet',
  (packetTarget) => {
    const effect = {
      ...dispel(),
      target: packetTarget,
      recipient: packetTarget === 'self' ? 'actor' : 'primary-unit',
    } as CombatEffectDefinition
    const definition = action([effect, { type: 'damage', recipient: 'primary-unit', amount: 20 }])
    expect(
      evaluateCombatAction(world(), definition, target, PV1F_COMBAT_CONTENT).issues,
    ).toContainEqual(expect.objectContaining({ code: 'target-invisible' }))
  },
)
it('keeps absent-policy historical Dispel blocked by Invisible', () => {
  const historical: CombatEffectDefinition = {
    type: 'remove-status',
    recipient: 'primary-unit',
    statusIds: ['invisible'],
    removalMode: 'specified',
    selectionKind: 'buffs',
  }
  expect(
    evaluateCombatAction(world(), action([historical]), target, PV1F_COMBAT_CONTENT).issues,
  ).toContainEqual(expect.objectContaining({ code: 'target-invisible' }))
})
it.each([0, 2, true, '1', null])(
  'rejects an invalid Dispel Invisible policy %s',
  (invisibleTargetPolicyVersion) => {
    expect(validateCombatTagPayload({ ...dispel(), invisibleTargetPolicyVersion })).not.toEqual([])
  },
)
it('rejects the Invisible selection marker on Cleanse', () => {
  expect(
    validateCombatTagPayload({
      type: 'remove-status',
      recipient: 'primary-unit',
      statusIds: ['slow'],
      removalMode: 'all-debuffs',
      invisibleTargetPolicyVersion: 1,
    }),
  ).not.toEqual([])
})
it.each(['discipline-skill', 'essence', 'resonance'] as const)(
  'preserves current Dispel admission through a JSON-restored canonical %s',
  (sourceKind) => {
    const captured = captureCombatAbilitySource({
      ...source({
        classification: 'utility',
        attackFamily: undefined,
        costs: [],
        effects: [{ id: 'dispel', payload: createAuthorableEffectPayload('dispel')! }],
      }),
      sourceKind,
    })
    const state = JSON.parse(
      JSON.stringify(reconcileCombatAbilitySources(world(), [captured])),
    ) as ReturnType<typeof world>
    const restored = captureCombatAbilitySource(state.capturedAbilitySources![0]!)
    const input = {
      state,
      actorId: 'actor',
      source: restored,
      selection: target,
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, restored),
    }
    expect(evaluateCombatAbility(input).issues).toEqual([])
    expect(
      activateCombatAbility(input).state.statusState.find((row) => row.combatantId === 'enemy')!
        .statuses,
    ).toEqual([])
  },
)

it('rejects the Dispel Invisible policy on a native damage packet', () => {
  const effect = {
    type: 'damage',
    recipient: 'primary-unit',
    amount: 20,
    invisibleTargetPolicyVersion: 1,
  } as unknown as CombatEffectDefinition
  expect(() => validateCombatActionDefinition(action([effect]))).toThrow(/Dispel|removal/)
})
it.each([0, 1])(
  'respects the marked Dispel ordinal %s recipient mask before admitting Invisible',
  (ordinal) => {
    const state = world()
    const ownMp: CombatEffectDefinition = {
      type: 'resource-change',
      recipient: 'actor',
      resource: 'mp',
      delta: 5,
    }
    const definition = {
      ...action(ordinal === 0 ? [dispel(), ownMp] : [ownMp, dispel()]),
      effectEligibleRecipientIds: ordinal === 0 ? [[], ['actor']] : [['actor'], []],
    }
    const before = JSON.stringify(state)
    const forecast = evaluateCombatAction(state, definition, target, PV1F_COMBAT_CONTENT)
    expect(forecast.issues).toContainEqual(expect.objectContaining({ code: 'target-invisible' }))
    expect(forecast.projectedEffects).toEqual([])
    expect(() => executeCombatAction(state, definition, target, PV1F_COMBAT_CONTENT)).toThrow(
      'target-invisible',
    )
    expect(JSON.stringify(state)).toBe(before)
  },
)
it('uses the matching Dispel ordinal recipient mask without borrowing a preceding Self mask', () => {
  const state = world()
  const definition = {
    ...action([
      { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 5 },
      dispel(),
    ]),
    effectEligibleRecipientIds: [[], ['enemy']],
  }
  expect(evaluateCombatAction(state, definition, target, PV1F_COMBAT_CONTENT).issues).toEqual([])
  expect(
    executeCombatAction(state, definition, target, PV1F_COMBAT_CONTENT).state.statusState.find(
      (row) => row.combatantId === 'enemy',
    )!.statuses,
  ).toEqual([])
})
