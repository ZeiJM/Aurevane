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

function fixture(limits: AbilityBehavior['activationLimits'], current = true) {
  const captured = captureCombatAbilitySource(source({ costs: [], activationLimits: limits }))
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
