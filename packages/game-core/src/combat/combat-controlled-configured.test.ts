import { evaluateCombatAction, executeCombatAction, type CombatEncounterState } from './actions'
import { materializeCombatAbilityAction } from './combat-behavior-runtime'
import { expect, it } from 'vitest'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import {
  primeCombatControlledAbility,
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import {
  parseCombatEffectTimingPolicy,
  parseStoredCombatEffectTimingPolicy,
  combatEffectTimingRoundOffset,
} from './combat-effect-timing'
import { validateCombatAbilityState } from './combat-ability-state'

it.each(['damage', 'healing', 'slow', 'return-to-turn-start'])(
  'accepts configured and stored Controlled %s timing',
  (tag) => {
    const policy = { version: 12, modes: { [tag]: 'controlled' } }
    expect(parseCombatEffectTimingPolicy(policy)).toEqual(policy)
    expect(parseStoredCombatEffectTimingPolicy(JSON.parse(JSON.stringify(policy)))).toEqual(policy)
  },
)

it('Controlled never becomes a native round offset', () => {
  expect(() => combatEffectTimingRoundOffset('controlled' as never)).toThrow('Controlled')
})

it('a pinned Controlled tag gates the whole captured action without changing the immutable definition', () => {
  const captured = captureCombatAbilitySource(source())
  const definition = JSON.stringify(captured.definition)
  const state = reconcileCombatAbilitySources(
    {
      ...preparePv1fTurnEconomy(percentageDotEncounter()),
      effectTimingPolicy: parseCombatEffectTimingPolicy({
        version: 12,
        modes: { damage: 'controlled' },
      }),
    },
    [captured],
  )
  const command = (state: CombatEncounterState) => ({
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  })
  expect(prepareCombatAbilityCommand(command(state)).evaluation.legal).toBe(false)
  const primed = primeCombatControlledAbility({
    state,
    actorId: 'actor',
    sourceInstanceId: captured.sourceInstanceId,
    behaviorId: 'strike',
  }).state
  expect(validateCombatAbilityState(JSON.parse(JSON.stringify(primed)))).toEqual([])
  const released = commitCombatAbilityCommand(command(primed))
  expect(released.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(
    990,
  )
  expect(released.state.pendingEffects ?? []).toEqual([])
  expect(released.state.abilityRuntime!.controlled!.primes).toEqual([])
  expect(JSON.stringify(captured.definition)).toBe(definition)
  expect(JSON.stringify(released.state.capturedAbilitySources![0]!.definition)).toBe(definition)
})

it('an explicit Instant wrapper overrides a Controlled tag default', () => {
  const captured = captureCombatAbilitySource(
    source({
      effects: [
        {
          id: 'hit',
          timing: 'instant',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
      ],
    }),
  )
  const state = reconcileCombatAbilitySources(
    {
      ...preparePv1fTurnEconomy(percentageDotEncounter()),
      effectTimingPolicy: parseCombatEffectTimingPolicy({
        version: 12,
        modes: { damage: 'controlled' },
      }),
    },
    [captured],
  )
  const input = {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }
  expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
  expect(commitCombatAbilityCommand(input).state.pendingEffects ?? []).toEqual([])
})

it('native execution without a captured Manual prime authority fails before costs or pending work', () => {
  const captured = captureCombatAbilitySource(source())
  const state = {
    ...preparePv1fTurnEconomy(percentageDotEncounter()),
    effectTimingPolicy: parseCombatEffectTimingPolicy({
      version: 12,
      modes: { damage: 'controlled' },
    }),
  }
  const action = materializeCombatAbilityAction(captured, captured.definition.behaviors[0]!)
  const selection = { kind: 'unit' as const, combatantId: 'enemy' }
  const before = JSON.stringify(state)
  expect(evaluateCombatAction(state, action, selection, PV1F_COMBAT_CONTENT).legal).toBe(false)
  expect(() => executeCombatAction(state, action, selection, PV1F_COMBAT_CONTENT)).toThrow()
  expect(JSON.stringify(state)).toBe(before)
})

it('a Controlled direct hit and its authored Instant percentage poison release together without an automatic Controlled timer', () => {
  const captured = captureCombatAbilitySource(
    source({
      effects: [
        { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
        {
          id: 'poison',
          timing: 'instant',
          payload: {
            type: 'poison',
            recipient: 'primary-unit',
            durationTurns: 4,
            damageProfile: { kind: 'attack-percentage', basisPoints: 1500 },
          },
        },
      ],
    }),
  )
  const state = reconcileCombatAbilitySources(
    {
      ...preparePv1fTurnEconomy(percentageDotEncounter()),
      effectTimingPolicy: parseCombatEffectTimingPolicy({
        version: 12,
        modes: { damage: 'controlled' },
      }),
      percentageDotPolicyVersion: 1 as const,
    },
    [captured],
  )
  const primed = primeCombatControlledAbility({
    state,
    actorId: 'actor',
    sourceInstanceId: captured.sourceInstanceId,
    behaviorId: 'strike',
  }).state
  const released = commitCombatAbilityCommand({
    state: primed,
    actorId: 'actor',
    root: { kind: 'canonical', source: captured },
    selection: { kind: 'unit', combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(primed, captured),
  })
  expect(released.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(
    980,
  )
  expect(released.state.pendingEffects ?? []).toEqual([])
  expect(released.events).toContainEqual(
    expect.objectContaining({ event: 'persistent_effect_applied', statusId: 'poison' }),
  )
})

it('inherited Controlled rejects unsupported Automatic groups while preserving an explicit Automatic Instant override', () => {
  const behavior = {
    activation: 'automatic' as const,
    activationLimits: ['once-per-action' as const],
    automaticTarget: { subject: 'triggering' as const },
    requirements: {
      kind: 'event' as const,
      eventType: 'combat_action_used' as const,
      phase: 'before' as const,
    },
  }
  const state = {
    ...preparePv1fTurnEconomy(percentageDotEncounter()),
    effectTimingPolicy: parseCombatEffectTimingPolicy({
      version: 12,
      modes: { damage: 'controlled' },
    }),
  }
  expect(() =>
    reconcileCombatAbilitySources(state, [captureCombatAbilitySource(source(behavior))]),
  ).toThrow('whole Manual action')
  const explicit = captureCombatAbilitySource(
    source({
      ...behavior,
      effects: [
        {
          id: 'hit',
          timing: 'instant',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
      ],
    }),
  )
  expect(
    reconcileCombatAbilitySources(state, [explicit]).capturedAbilitySources![0]!.definition,
  ).toEqual(explicit.definition)
})

it.each(['summon', 'ground-area'])(
  'does not configure Controlled %s without dedicated release authority',
  (tag) => {
    expect(() =>
      parseCombatEffectTimingPolicy({ version: 12, modes: { [tag]: 'controlled' } }),
    ).toThrow()
  },
)

it('restore rejects an inherited Controlled Automatic combination before it can execute', () => {
  const captured = captureCombatAbilitySource(
    source({
      activation: 'automatic',
      activationLimits: ['once-per-action'],
      automaticTarget: { subject: 'triggering' },
      requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
    }),
  )
  const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
    captured,
  ])
  const restored = JSON.parse(
    JSON.stringify({
      ...state,
      effectTimingPolicy: { version: 12, modes: { damage: 'controlled' } },
    }),
  )
  expect(validateCombatAbilityState(restored)).toContainEqual(
    expect.objectContaining({ field: 'capturedAbilitySources' }),
  )
})
