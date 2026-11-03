import { expect, it } from 'vitest'
import { validateCombatEncounterState } from './actions'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import { PV1F_COMBAT_CONTENT, finishPv1fTurn } from './pv1f-action-economy'
import type { AbilityBehavior } from './combat-definition'

function fixture(
  limits: AbilityBehavior['activationLimits'],
  current = true,
  maximumUsesPerBattle?: number,
) {
  const captured = captureCombatAbilitySource(
    source({
      costs: [],
      activationLimits: limits,
      ...(maximumUsesPerBattle ? { maximumUsesPerBattle } : {}),
    }),
  )
  let state = reconcileCombatAbilitySources(
    {
      ...percentageDotEncounter(),
      ...(current ? { abilityUsageLimitPolicyVersion: 1 as const } : {}),
    },
    [captured],
  )
  const command = () => ({
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  })
  return {
    quote: () => prepareCombatAbilityCommand(command()).evaluation,
    use: () => {
      state = JSON.parse(JSON.stringify(commitCombatAbilityCommand(command()).state))
    },
    nextRound: () => {
      const round = state.tactical.battle.round
      do {
        state = finishPv1fTurn(state as never, 'east').state
      } while (
        state.tactical.battle.round === round ||
        state.tactical.battle.currentTurn?.combatantId !== 'actor'
      )
    },
    state: () => state,
  }
}

it.each([
  { limits: ['once-per-action'] },
  { limits: ['once-per-action', 'once-per-round'] },
] as const)(
  'allows one battle use with %j, even without a cooldown and after reload/round advancement',
  ({ limits }) => {
    const f = fixture([...limits])
    expect(f.quote().legal).toBe(true)
    f.use()
    expect(f.quote().issues).toContainEqual(expect.objectContaining({ code: 'activation-limit' }))
    f.nextRound()
    expect(f.quote().issues).toContainEqual(expect.objectContaining({ code: 'activation-limit' }))
    expect(validateCombatEncounterState(f.state())).toEqual([])
  },
)
it('resets once per round at the global round boundary', () => {
  const f = fixture(['once-per-round'])
  f.use()
  expect(f.quote().legal).toBe(false)
  f.nextRound()
  expect(f.quote().legal).toBe(true)
  f.use()
  expect(f.quote().legal).toBe(false)
})
it('allows unlimited fresh commands with no limits and no cooldown', () => {
  const f = fixture([])
  for (let i = 0; i < 4; i++) {
    expect(f.quote().legal).toBe(true)
    f.use()
  }
})
it('preserves historical once per root action semantics', () => {
  const f = fixture(['once-per-action'], false)
  f.use()
  expect(f.quote().legal).toBe(true)
})

it('counts only committed attempts against a finite battle allowance across reloads', () => {
  const f = fixture([], true, 3)
  for (let uses = 0; uses < 3; uses++) {
    expect(f.quote().legal).toBe(true)
    expect(f.quote().legal).toBe(true)
    expect(f.state().abilityRuntime?.usage[0]?.usageCount ?? 0).toBe(uses)
    f.use()
    expect(f.state().abilityRuntime?.usage[0]?.usageCount).toBe(uses + 1)
  }
  expect(f.quote().issues).toContainEqual(expect.objectContaining({ code: 'activation-limit' }))
  f.nextRound()
  expect(f.quote().legal).toBe(false)
  expect(validateCombatEncounterState(f.state())).toEqual([])
  expect(fixture([], true, 3).quote().legal).toBe(true)
})
it('retains narrower activation limits with a finite battle allowance', () => {
  const f = fixture(['once-per-round'], true, 3)
  f.use()
  expect(f.quote().legal).toBe(false)
  f.nextRound()
  expect(f.quote().legal).toBe(true)
})

it('does not spend finite uses on failed payment, quotes, stale retries or delayed packets', () => {
  const captured = captureCombatAbilitySource(
    source({
      maximumUsesPerBattle: 3,
      costs: [{ resource: 'mp', amount: 2 }],
      effects: [
        {
          id: 'later',
          timing: 'next-round',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
      ],
    }),
  )
  const state = reconcileCombatAbilitySources(percentageDotEncounter(), [captured])
  const input = {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }
  const unpaid = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor' ? { ...unit, mp: 0 } : unit,
        ),
      },
    },
  }
  expect(() => commitCombatAbilityCommand({ ...input, state: unpaid })).toThrow(/insufficient-mp/)
  expect(unpaid.abilityRuntime!.usage).toEqual([])
  const before = JSON.stringify(state)
  expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
  expect(JSON.stringify(state)).toBe(before)
  const committed = commitCombatAbilityCommand(input)
  expect(committed.state.abilityRuntime!.usage[0]!.usageCount).toBe(1)
  expect(committed.state.pendingEffects).toHaveLength(1)
  expect(() => commitCombatAbilityCommand({ ...input, state: committed.state })).toThrow(
    /duplicate-command|stale-command/,
  )
  expect(committed.state.abilityRuntime!.usage[0]!.usageCount).toBe(1)
  let restored = JSON.parse(JSON.stringify(committed.state)) as typeof state
  const events = []
  while (restored.tactical.battle.round === state.tactical.battle.round) {
    const next = finishPv1fTurn(restored as never, 'east')
    restored = next.state
    events.push(...(next.events as typeof committed.events))
  }
  expect(events.some((event) => event.event === 'damage_applied')).toBe(true)
  expect(restored.abilityRuntime!.usage[0]!.usageCount).toBe(1)
  expect(events.some((event) => event.event === 'mp_spent')).toBe(false)
  expect(validateCombatEncounterState(restored)).toEqual([])
})
it('counts finite Controlled uses on release, not prime or cancel, while preserving cooldown', async () => {
  const { primeCombatControlledAbility, cancelCombatControlledAbility } =
    await import('./combat-behavior-runtime')
  const captured = captureCombatAbilitySource(
    source({
      maximumUsesPerBattle: 3,
      costs: [],
      cooldown: { key: 'finite-clock', ownerTurns: 2 },
      effects: [
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
      ],
    }),
  )
  let state = reconcileCombatAbilitySources(
    {
      ...percentageDotEncounter(),
      abilityUsageLimitPolicyVersion: 1,
      effectTimingPolicy: { version: 1, tagAuthority: 'global', modes: { damage: 'controlled' } },
    },
    [captured],
  )
  const control = () => ({
    state,
    actorId: 'actor',
    sourceInstanceId: captured.sourceInstanceId,
    behaviorId: 'strike',
  })
  state = primeCombatControlledAbility(control()).state
  expect(state.abilityRuntime!.usage).toEqual([])
  state = cancelCombatControlledAbility(control()).state
  expect(state.abilityRuntime!.usage).toEqual([])
  do {
    state = finishPv1fTurn(state as never, 'east').state
  } while (state.tactical.battle.currentTurn?.combatantId !== 'actor')
  state = primeCombatControlledAbility(control()).state
  const input = {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }
  state = commitCombatAbilityCommand(input).state
  expect(state.abilityRuntime!.usage[0]!.usageCount).toBe(1)
  expect(() => primeCombatControlledAbility(control())).toThrow(/cooldown/)
  expect(state.abilityRuntime!.usage[0]!.usageCount).toBe(1)
})
it.each([0, -1, 1.5, 100, Number.NaN])(
  'rejects invalid finite-use bound %s',
  (maximumUsesPerBattle) => {
    expect(() => captureCombatAbilitySource(source({ maximumUsesPerBattle }))).toThrow(
      /maximumUsesPerBattle/,
    )
  },
)
it.each(['automatic', 'ongoing'] as const)('rejects finite uses on %s behaviors', (activation) => {
  expect(() => captureCombatAbilitySource(source({ maximumUsesPerBattle: 3, activation }))).toThrow(
    /maximumUsesPerBattle/,
  )
})
it('rejects a persisted finite count beyond its captured behavior bound', () => {
  const f = fixture([], true, 3)
  f.use()
  const state = f.state()
  const corrupted = {
    ...state,
    abilityRuntime: {
      ...state.abilityRuntime!,
      usage: state.abilityRuntime!.usage.map((row) => ({ ...row, usageCount: 4 })),
    },
  }
  expect(validateCombatEncounterState(corrupted)).toContainEqual(
    expect.objectContaining({ field: 'abilityRuntime.usage' }),
  )
})
