import { expect, it } from 'vitest'
import { endCombatTurn, executeCombatAction, validateCombatEncounterState } from './actions'
import type { CombatEncounterState } from './actions'
import type { AbilityBehavior } from './combat-definition'
import { selectCurrentFinalFacing } from './board'
import { currentBarrierAmount, grantBarrier } from './combat-barrier'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { applyCurrentPoisonState } from './combat-dots'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import {
  createCombatNativeAbilityRuntime,
  commitCombatAbilityCommand,
} from './combat-ability-command'
import {
  combatAbilityCommandContext,
  materializeCombatAbilityAction,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'

function fixture(
  barrier: number,
  current = true,
  trigger: AbilityBehavior['automaticTrigger'] = 'damage-taken',
  amount = 10,
) {
  const root = captureCombatAbilitySource(
    source({
      costs: [],
      effects: [
        {
          id: 'hit',
          timing: 'instant',
          payload: { type: 'damage', recipient: 'primary-unit', amount },
        },
      ],
    }),
  )
  const owner =
    trigger === 'damage-dealt' ? 'actor' : trigger === 'ally-damage-taken' ? 'other' : 'enemy'
  const reaction = captureCombatAbilitySource({
    ...source(
      {
        id: 'reaction',
        activation: 'automatic',
        classification: 'recovery',
        attackFamily: undefined,
        requirementMode: 'simple',
        automaticTrigger: trigger,
        automaticTarget: { subject: 'owner' },
        costs: [{ resource: 'mp', amount: 1 }],
        cooldown: null,
        requirements: null,
        targeting: {
          kind: 'self',
          teamPolicy: 'self',
          friendlyFire: 'allies-only',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 0,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          maximumSelections: 1,
        },
        effects: [
          {
            id: 'heal',
            timing: 'instant',
            payload: { type: 'healing', recipient: 'actor', amount: 1 },
          },
        ],
      },
      'barrier-reaction',
    ),
    ownerCombatantId: owner,
  })
  let state: CombatEncounterState = {
    ...percentageDotEncounter(),
    modularSkillPolicyVersion: 1,
    ...(current ? { barrierDamageEventPolicyVersion: 1 as const } : {}),
  }
  state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) => ({
    ...unit,
    hp: 500,
  }))
  if (barrier) state = grantBarrier(state, 'enemy', 'enemy', 'test.shield', barrier).state
  state = reconcileCombatAbilitySources(state, [root, reaction])
  return { state, root, reaction, owner }
}
function shoot(input: ReturnType<typeof fixture>, native = false) {
  const { state, root } = input
  return commitCombatAbilityCommand({
    state,
    actorId: 'actor',
    root: native
      ? {
          kind: 'native',
          sourceInstanceId: 'native-strike',
          classification: 'attack',
          attackFamily: 'physical',
          action: materializeCombatAbilityAction(root, root.definition.behaviors[0]!, state),
          costs: [],
        }
      : { kind: 'canonical', source: root },
    selection: { kind: 'unit', combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, root),
  })
}

it.each([false, true])(
  'counts fully absorbed hostile damage through native=%s after reload',
  (native) => {
    const input = fixture(100)
    input.state = JSON.parse(JSON.stringify(input.state))
    const before = JSON.stringify(input.state)
    const out = shoot(input, native)
    expect(out.events.filter((event) => event.event === 'healing_applied')).toHaveLength(1)
    expect(out.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')).toMatchObject({
      hp: 501,
      mp: 19,
    })
    expect(currentBarrierAmount(out.state, 'enemy')).toBe(90)
    expect(out.events).toContainEqual(
      expect.objectContaining({ event: 'damage_applied', amount: 0, hpBefore: 500, hpAfter: 500 }),
    )
    expect(out.state.effectState?.damageHistory.some((row) => row.combatantId === 'enemy')).toBe(
      false,
    )
    expect(JSON.stringify(input.state)).toBe(before)
  },
)

it.each([0, 5, 100])(
  'fires once per hit with %s Barrier, without an authored activation limit',
  (barrier) => {
    const out = shoot(fixture(barrier))
    expect(out.events.filter((event) => event.event === 'healing_applied')).toHaveLength(1)
    expect(out.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')).toMatchObject({
      hp: 500 - Math.max(0, 10 - barrier) + 1,
      mp: 19,
    })
  },
)

it.each(['damage-dealt', 'ally-damage-taken', 'barrier-hit'] as const)(
  'retains causal binding for %s on an absorbed hit',
  (trigger) => {
    const input = fixture(100, true, trigger)
    const out = shoot(input)
    expect(out.events.filter((event) => event.event === 'healing_applied')).toHaveLength(1)
    expect(
      out.state.tactical.battle.combatants.find((unit) => unit.id === input.owner),
    ).toMatchObject({ hp: 501, mp: 19 })
  },
)

it('preserves the HP-only trigger rule for historical captures', () => {
  const out = shoot(fixture(100, false))
  expect(out.events.filter((event) => event.event === 'healing_applied')).toEqual([])
  expect(currentBarrierAmount(out.state, 'enemy')).toBe(90)
})

it('does not treat a genuine zero-damage packet as damage taken', () => {
  const input = fixture(100)
  const action = materializeCombatAbilityAction(
    input.root,
    input.root.definition.behaviors[0]!,
    input.state,
  )
  const out = executeCombatAction(
    input.state,
    { ...action, effects: [{ type: 'damage', recipient: 'primary-unit', amount: 0 }] },
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  )
  expect(out.events.filter((event) => event.event === 'healing_applied')).toEqual([])
  expect(currentBarrierAmount(out.state, 'enemy')).toBe(100)
})

it('counts absorbed periodic damage through the native turn boundary', () => {
  const input = fixture(100)
  // Advance through the actual turn boundary before the defender's Poison tick.
  input.state = endCombatTurn(
    { ...input.state, tactical: selectCurrentFinalFacing(input.state.tactical, 'west').state },
    PV1F_COMBAT_CONTENT,
  ).state
  const poisoned = applyCurrentPoisonState(
    input.state,
    'actor',
    'enemy',
    'test.poison',
    true,
    10,
    2,
  )
  const out = endCombatTurn(
    { ...poisoned, tactical: selectCurrentFinalFacing(poisoned.tactical, 'west').state },
    PV1F_COMBAT_CONTENT,
    false,
    createCombatNativeAbilityRuntime(poisoned, PV1F_COMBAT_CONTENT),
  )
  expect(out.events.filter((event) => event.event === 'healing_applied')).toHaveLength(1)
  expect(currentBarrierAmount(out.state, 'enemy')).toBe(90)
})

it('rejects unknown Barrier damage-event policies', () => {
  expect(
    validateCombatEncounterState({
      ...fixture(100).state,
      barrierDamageEventPolicyVersion: 2,
    } as never),
  ).toContainEqual(expect.objectContaining({ field: 'barrierDamageEventPolicyVersion' }))
})
