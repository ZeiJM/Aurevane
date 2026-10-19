import { describe, expect, it } from 'vitest'
import { parseAbilityDefinition, validateAbilityDefinition } from './combat-definition'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import * as runtime from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import { validateCombatAbilityState } from './combat-ability-state'
import { preparePv1fTurnEconomy, finishPv1fTurn, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'
import { validateBattleState } from './battle-state'

function setup(
  cooldown: { key: string; ownerTurns: number } | null = { key: 'controlled-test', ownerTurns: 2 },
) {
  const captured = captureCombatAbilitySource(
    source({
      cooldown,
      effects: [
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
        {
          id: 'heal',
          timing: 'instant',
          payload: { type: 'healing', recipient: 'actor', amount: 5 },
        },
      ],
    }),
  )
  const initial = preparePv1fTurnEconomy(percentageDotEncounter())
  const state = runtime.reconcileCombatAbilitySources(initial, [captured])
  return { captured, state }
}

function command(
  state: ReturnType<typeof setup>['state'],
  captured: ReturnType<typeof setup>['captured'],
) {
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: runtime.combatAbilityCommandContext(state, captured),
  }
}

function prime(state: ReturnType<typeof setup>['state']) {
  return runtime.primeCombatControlledAbility({
    state,
    actorId: 'actor',
    sourceInstanceId: 'source-a',
    behaviorId: 'strike',
  })
}

describe('Controlled whole Manual actions', () => {
  it('allows repeated cancellation under global timing while cooldown blocks new preparation', () => {
    const initial = setup()
    const state = {
      ...initial.state,
      effectTimingPolicy: {
        version: 8,
        tagAuthority: 'global' as const,
        modes: { damage: 'controlled' as const, healing: 'instant' as const },
      },
    }
    const primed = prime(state).state
    const reprime = primed
    expect(runtime.combatAbilitySubject(reprime, 'actor')!.primeAbilityIds).toEqual([
      'test.ability',
    ])
    expect(prepareCombatAbilityCommand(command(reprime, initial.captured)).evaluation.legal).toBe(
      true,
    )
    expect(validateCombatAbilityState(reprime)).toEqual([])
    const cancelled = runtime.cancelCombatControlledAbility({
      state: reprime,
      actorId: 'actor',
      sourceInstanceId: 'source-a',
      behaviorId: 'strike',
    }).state
    const thirdPrime = prime(cancelled).state
    expect(validateCombatAbilityState(thirdPrime)).toEqual([])
    expect(thirdPrime.abilityRuntime!.controlled!.used).toHaveLength(1)
    expect(thirdPrime.abilityRuntime!.controlled!.primes).toHaveLength(1)
    const released = commitCombatAbilityCommand(command(thirdPrime, initial.captured)).state
    expect(() => prime(released)).toThrow('controlled-cooldown-active')
  })
  it('allows another free prime immediately after a global Controlled action without a cooldown', () => {
    const initial = setup(null)
    const state = {
      ...initial.state,
      effectTimingPolicy: {
        version: 8,
        tagAuthority: 'global' as const,
        modes: { damage: 'controlled' as const, healing: 'instant' as const },
      },
    }
    const released = commitCombatAbilityCommand(command(prime(state).state, initial.captured)).state
    expect(
      runtime.combatControlledAbilityAvailability({
        state: released,
        actorId: 'actor',
        sourceInstanceId: 'source-a',
        behaviorId: 'strike',
      })!.canPrime,
    ).toBe(true)
    const again = prime(released)
    expect(again.events).toEqual([])
    expect(again.state.tactical).toEqual(released.tactical)
    expect(again.state.abilityRuntime!.controlled!.primes).toHaveLength(1)
  })
  it('releases again after its cooldown rather than imposing an extra once-per-battle limit', () => {
    const initial = setup()
    const captured = captureCombatAbilitySource({
      ...initial.captured,
      definition: {
        ...initial.captured.definition,
        behaviors: initial.captured.definition.behaviors.map((behavior) => ({
          ...behavior,
          activationLimits: ['once-per-battle' as const],
        })),
      },
    })
    const state = runtime.reconcileCombatAbilitySources(
      {
        ...preparePv1fTurnEconomy(percentageDotEncounter()),
        effectTimingPolicy: {
          version: 8,
          tagAuthority: 'global' as const,
          modes: { damage: 'controlled' as const, healing: 'instant' as const },
        },
      },
      [captured],
    )
    let next = commitCombatAbilityCommand(command(prime(state).state, captured)).state
    const bridge = percentageDotEncounter().statBridge
    for (let index = 0; index < 16; index++) {
      if (next.tactical.battle.currentTurn?.combatantId === 'actor' && index >= 12) break
      next = finishPv1fTurn(reattachStatDrivenCombatBridge(next, bridge), 'west').state
    }
    next = prime(next).state
    expect(prepareCombatAbilityCommand(command(next, captured)).evaluation.issues).toEqual([])
    const released = commitCombatAbilityCommand(command(next, captured))
    expect(released.events.filter((event) => event.event === 'combat_action_used')).toHaveLength(1)
    expect(runtime.combatAbilitySubject(released.state, 'actor')!.primeAbilityIds).toEqual([])
    expect(validateCombatAbilityState(released.state)).toEqual([])
  })
  it('admits Controlled only for compatible Manual action effects', () => {
    const value = source({
      effects: [
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
      ],
    }).definition
    expect(parseAbilityDefinition(value)).toEqual(value)
    for (const activation of ['automatic', 'ongoing']) {
      expect(
        validateAbilityDefinition({
          ...value,
          behaviors: value.behaviors.map((behavior) => ({ ...behavior, activation })),
        }),
      ).toContainEqual(expect.objectContaining({ code: 'unsupported-combination' }))
    }
    expect(
      validateAbilityDefinition({
        ...value,
        behaviors: value.behaviors.map((behavior) => ({ ...behavior, mode: 'modifier' })),
      }),
    ).toContainEqual(expect.objectContaining({ code: 'unsupported-combination' }))
  })

  it('free_prime_whole_group changes no resources, action activity, cooldown, effects or paid usage', () => {
    const { state } = setup()
    const result = prime(state)
    expect(result.events).toEqual([])
    expect(result.state.tactical).toEqual(state.tactical)
    expect(result.state.statusState).toEqual(state.statusState)
    expect(result.state.abilityRuntime!.usage).toEqual([])
    expect(runtime.combatAbilitySubject(result.state, 'actor')!.primeAbilityIds).toEqual([
      'test.ability',
    ])
    expect(validateCombatAbilityState(result.state)).toEqual([])
    expect(runtime.combatAbilitySubject(state, 'actor')!.primeAbilityIds).toEqual([])
  })

  it('rejects direct activation without a prime and release_pays_once consumes it before settlement', () => {
    const { state, captured } = setup()
    expect(prepareCombatAbilityCommand(command(state, captured)).evaluation.issues).toContainEqual(
      expect.objectContaining({ code: 'requirement-not-met' }),
    )
    const primed = prime(state).state
    const released = commitCombatAbilityCommand(command(primed, captured))
    expect(released.events.filter((event) => event.event === 'combat_action_used')).toHaveLength(1)
    expect(released.events.filter((event) => event.event === 'ap_spent')).toMatchObject([
      { amount: 11, remaining: 89 },
    ])
    expect(released.events.filter((event) => event.event === 'mp_spent')).toMatchObject([
      { amount: 2, remaining: 18 },
    ])
    expect(released.events.filter((event) => event.event === 'hp_spent')).toMatchObject([
      { amount: 1 },
    ])
    expect(runtime.combatAbilitySubject(released.state, 'actor')!.primeAbilityIds).toEqual([])
    expect(validateCombatAbilityState(released.state)).toEqual([])
    expect(() => prime(released.state)).toThrow('controlled-prime-used')
    expect(() => commitCombatAbilityCommand(command(released.state, captured))).toThrow()
  })

  it('invalid_release_retains the prime without paying or mutating its snapshot', () => {
    const { state, captured } = setup()
    const primed = prime(state).state
    const before = JSON.stringify(primed)
    const invalid = {
      ...command(primed, captured),
      selection: { kind: 'unit' as const, combatantId: 'ally' },
    }
    expect(prepareCombatAbilityCommand(invalid).evaluation.legal).toBe(false)
    expect(() => commitCombatAbilityCommand(invalid)).toThrow()
    expect(JSON.stringify(primed)).toBe(before)
    expect(runtime.combatAbilitySubject(primed, 'actor')!.primeAbilityIds).toEqual(['test.ability'])
  })

  it('reconnect_prime retains exact identity and rejects duplicate free primes', () => {
    const { state, captured } = setup()
    const saved = JSON.parse(JSON.stringify(prime(state).state))
    expect(validateCombatAbilityState(saved)).toEqual([])
    expect(runtime.combatAbilitySubject(saved, 'actor')!.primeAbilityIds).toEqual(['test.ability'])
    expect(prepareCombatAbilityCommand(command(saved, captured)).evaluation.legal).toBe(true)
    expect(() => prime(saved)).toThrow('controlled-prime-used')
  })

  it('cancel discards only the prime, retains the per-battle bound, and cannot execute effects', () => {
    const { state } = setup()
    const primed = prime(state).state
    const cancelled = runtime.cancelCombatControlledAbility({
      state: primed,
      actorId: 'actor',
      sourceInstanceId: 'source-a',
      behaviorId: 'strike',
    })
    expect(cancelled.events).toEqual([])
    expect(cancelled.state.tactical).toEqual(primed.tactical)
    expect(runtime.combatAbilitySubject(cancelled.state, 'actor')!.primeAbilityIds).toEqual([])
    expect(() => prime(cancelled.state)).toThrow('controlled-prime-used')
    expect(validateCombatAbilityState(cancelled.state)).toEqual([])
  })

  it('source removal and terminal cleanup remove primes while retaining their historical admission bound', () => {
    const { state, captured } = setup()
    const primed = prime(state).state
    const removed = runtime.reconcileCombatAbilitySources(primed, [])
    expect(runtime.combatAbilitySubject(removed, 'actor')!.primeAbilityIds).toEqual([])
    expect(() => prime(runtime.reconcileCombatAbilitySources(removed, [captured]))).toThrow(
      'controlled-prime-used',
    )
    const dead = {
      ...primed,
      tactical: {
        ...primed.tactical,
        battle: {
          ...primed.tactical.battle,
          combatants: primed.tactical.battle.combatants.map((unit) =>
            unit.id === 'actor' ? { ...unit, hp: 0 } : unit,
          ),
        },
      },
    }
    expect(
      runtime.combatAbilitySubject(
        runtime.reconcileCombatAbilitySources(dead, [captured]),
        'actor',
      )!.primeAbilityIds,
    ).toEqual([])
  })

  it('free priming reserves no unaffordable resources, while a blocked release retains it', () => {
    const { state, captured } = setup()
    const exhausted = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) =>
            unit.id === 'actor'
              ? {
                  ...unit,
                  hp: 1,
                  mp: 0,
                  temporaryResources: unit.temporaryResources.map((row) =>
                    row.key === 'pv1f.action-economy' ? { ...row, current: 0 } : row,
                  ),
                }
              : unit,
          ),
        },
      },
    }
    const primed = prime(exhausted).state
    expect(primed.tactical).toEqual(exhausted.tactical)
    expect(prepareCombatAbilityCommand(command(primed, captured)).evaluation.legal).toBe(false)
    expect(() => commitCombatAbilityCommand(command(primed, captured))).toThrow()
    expect(runtime.combatAbilitySubject(primed, 'actor')!.primeAbilityIds).toEqual(['test.ability'])
  })

  it('one prime binds an exact Manual group and prevents another group or source from bypassing the ability bound', () => {
    const { captured } = setup()
    const first = captured.definition.behaviors[0]!
    const choices = captureCombatAbilitySource({
      ...captured,
      definition: { ...captured.definition, behaviors: [first, { ...first, id: 'second' }] },
    })
    const duplicate = captureCombatAbilitySource({ ...choices, sourceInstanceId: 'second-source' })
    const state = runtime.reconcileCombatAbilitySources(
      preparePv1fTurnEconomy(percentageDotEncounter()),
      [choices, duplicate],
    )
    const primed = prime(state).state
    expect(
      prepareCombatAbilityCommand({
        ...command(primed, choices),
        root: { kind: 'canonical', source: choices, behaviorId: 'strike' },
      }).evaluation.legal,
    ).toBe(true)
    expect(
      prepareCombatAbilityCommand({
        ...command(primed, choices),
        root: { kind: 'canonical', source: choices, behaviorId: 'second' },
      }).evaluation.legal,
    ).toBe(false)
    expect(() =>
      runtime.primeCombatControlledAbility({
        state: primed,
        actorId: 'actor',
        sourceInstanceId: 'second-source',
        behaviorId: 'second',
      }),
    ).toThrow('controlled-prime-used')
  })

  it('prime-dependent Ongoing maintenance is added on prime and removed on cancellation', () => {
    const { captured } = setup()
    const aura = captureCombatAbilitySource({
      ...source(
        {
          id: 'aura',
          activation: 'ongoing',
          mode: 'modifier',
          classification: 'utility',
          attackFamily: undefined,
          costs: [{ resource: 'ap', amount: 0 }],
          targeting: null,
          requirements: {
            kind: 'prime-presence',
            subject: 'owner',
            abilityId: 'test.ability',
            present: true,
          },
          effects: [
            {
              id: 'bonus',
              payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11250 },
            },
          ],
        },
        'aura-source',
      ),
      abilityId: 'test.aura',
    })
    const state = runtime.reconcileCombatAbilitySources(
      preparePv1fTurnEconomy(percentageDotEncounter()),
      [captured, aura],
    )
    expect(state.abilityRuntime!.maintained).toEqual([])
    const primed = prime(state).state
    expect(primed.abilityRuntime!.maintained).toMatchObject([
      { sourceInstanceId: 'aura-source', multiplierBasisPoints: 11250 },
    ])
    const cancelled = runtime.cancelCombatControlledAbility({
      state: primed,
      actorId: 'actor',
      sourceInstanceId: 'source-a',
      behaviorId: 'strike',
    })
    expect(cancelled.state.abilityRuntime!.maintained).toEqual([])
  })

  it('no input across actual round boundaries neither expires nor auto-releases a prime', () => {
    const { state } = setup()
    let next = prime(state).state
    const bridge = percentageDotEncounter().statBridge
    for (let index = 0; index < 8; index++)
      next = finishPv1fTurn(reattachStatDrivenCombatBridge(next, bridge), 'west').state
    expect(next.tactical.battle.round).toBeGreaterThan(state.tactical.battle.round)
    expect(next.tactical.battle.combatants.map((unit) => [unit.id, unit.hp, unit.mp])).toEqual(
      state.tactical.battle.combatants.map((unit) => [unit.id, unit.hp, unit.mp]),
    )
    expect(runtime.combatAbilitySubject(next, 'actor')!.primeAbilityIds).toEqual(['test.ability'])
    expect(next.abilityRuntime!.usage).toEqual([])
  })

  it('consumes the prime before a before-use reaction; a paid interruption cannot restore it', () => {
    const { state: initial, captured } = setup()
    const counter = captureCombatAbilitySource({
      ...source(
        {
          id: 'counter',
          activation: 'automatic',
          costs: [{ resource: 'mp', amount: 1 }],
          activationLimits: ['once-per-action'],
          automaticTarget: { subject: 'triggering' },
          requirements: {
            kind: 'all',
            children: [
              { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
              {
                kind: 'prime-presence',
                subject: 'triggering',
                abilityId: 'test.ability',
                present: false,
              },
            ],
          },
          effects: [
            {
              id: 'counter-hit',
              payload: { type: 'damage', recipient: 'primary-unit', amount: 20 },
            },
          ],
        },
        'counter-source',
      ),
      ownerCombatantId: 'enemy',
      abilityId: 'test.counter',
    })
    const state = runtime.reconcileCombatAbilitySources(
      {
        ...initial,
        tactical: {
          ...initial.tactical,
          battle: {
            ...initial.tactical.battle,
            combatants: initial.tactical.battle.combatants.map((unit) =>
              unit.id === 'actor' ? { ...unit, hp: 2 } : unit,
            ),
          },
        },
      },
      [captured, counter],
    )
    const primed = prime(state).state
    const released = commitCombatAbilityCommand(command(primed, captured))
    expect(released.events).toContainEqual(
      expect.objectContaining({
        event: 'combat_action_interrupted',
        actionId: 'test.ability',
        reason: 'actor-unavailable',
      }),
    )
    expect(released.events.filter((event) => event.event === 'ap_spent')).toMatchObject([
      { amount: 11 },
    ])
    expect(released.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp).toBe(
      0,
    )
    expect(released.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(
      1000,
    )
    expect(runtime.combatAbilitySubject(released.state, 'actor')!.primeAbilityIds).toEqual([])
    expect(released.state.abilityRuntime!.controlled!.used).toHaveLength(1)
  })

  it.each(['version', 'cross-battle', 'unbound', 'duplicate', 'unknown-key'] as const)(
    'strict private restore rejects %s tampering',
    (kind) => {
      const { state } = setup()
      const saved = JSON.parse(JSON.stringify(prime(state).state))
      const controlled = saved.abilityRuntime.controlled
      if (kind === 'version') controlled.primes[0].contentVersion++
      if (kind === 'cross-battle') controlled.used[0].battleId = 'another-battle'
      if (kind === 'unbound') controlled.used = []
      if (kind === 'duplicate') controlled.primes.push({ ...controlled.primes[0] })
      if (kind === 'unknown-key') controlled.used[0].payload = { type: 'damage', amount: 999 }
      expect(validateCombatAbilityState(saved)).toContainEqual(
        expect.objectContaining({ field: 'abilityRuntime.controlled' }),
      )
    },
  )

  it('rejects a prime with a missing known key replaced by an undefined extra key', () => {
    const { state } = setup()
    const saved = JSON.parse(JSON.stringify(prime(state).state))
    delete saved.abilityRuntime.controlled.primes[0].contentVersion
    saved.abilityRuntime.controlled.primes[0].extra = undefined
    expect(validateCombatAbilityState(saved)).toContainEqual(
      expect.objectContaining({ field: 'abilityRuntime.controlled' }),
    )
  })

  it('terminal cleanup removes all encounter primes without resetting their admission history', () => {
    const { state, captured } = setup()
    const primed = prime(state).state
    const ended = {
      ...primed,
      tactical: {
        ...primed.tactical,
        battle: { ...primed.tactical.battle, lifecycle: 'abandoned' as const, currentTurn: null },
      },
    }
    expect(validateBattleState(ended.tactical.battle)).toEqual([])
    const cleaned = runtime.reconcileCombatAbilitySources(ended, [captured])
    expect(cleaned.abilityRuntime!.controlled!.primes).toEqual([])
    expect(cleaned.abilityRuntime!.controlled!.used).toEqual(
      primed.abilityRuntime!.controlled!.used,
    )
    expect(validateCombatAbilityState(cleaned)).toEqual([])
  })

  it('releasing one ability leaves other primes intact and invalidates pre-prime command contexts', () => {
    const { captured } = setup()
    const other = captureCombatAbilitySource({
      ...captured,
      sourceInstanceId: 'other-source',
      abilityId: 'test.other',
    })
    const state = runtime.reconcileCombatAbilitySources(
      preparePv1fTurnEconomy(percentageDotEncounter()),
      [captured, other],
    )
    const oldContext = runtime.combatAbilityCommandContext(state, captured)
    const first = prime(state).state
    const both = runtime.primeCombatControlledAbility({
      state: first,
      actorId: 'actor',
      sourceInstanceId: 'other-source',
      behaviorId: 'strike',
    }).state
    expect(
      prepareCombatAbilityCommand({ ...command(both, captured), context: oldContext }).evaluation
        .issues,
    ).toContainEqual(expect.objectContaining({ code: 'duplicate-command' }))
    const released = commitCombatAbilityCommand(command(both, captured))
    expect(runtime.combatAbilitySubject(released.state, 'actor')!.primeAbilityIds).toEqual([
      'test.other',
    ])
    expect(released.state.abilityRuntime!.controlled!.used).toHaveLength(2)
    expect(validateCombatAbilityState(released.state)).toEqual([])
  })
})
