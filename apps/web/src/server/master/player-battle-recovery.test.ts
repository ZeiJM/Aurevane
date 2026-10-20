import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { resolveMasterBattleRecovery } from './player-battle-recovery'
import { validateStatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
it('no_refund_or_unrelated_reward_loss: validates terminal state while preserving resources and pinned historical rules', () => {
  const before = percentageDotEncounter()
  const terminal = resolveMasterBattleRecovery(before)
  expect(terminal.tactical.battle.lifecycle).toBe('abandoned')
  expect(terminal.administrativeOutcome).toBe('NoContest')
  expect(terminal.rewardOutcome).toBe('NoRewards')
  expect(terminal.tactical.battle.combatants).toEqual(before.tactical.battle.combatants)
  expect(terminal.statBridge).toEqual(before.statBridge)
  expect(terminal.effectTimingPolicy).toEqual(before.effectTimingPolicy)
  expect(validateStatDrivenCombatEncounterState(terminal)).toEqual([])
  expect(before.tactical.battle.lifecycle).toBe('active')
})
it('normal_completion_race: does not rewrite an already completed encounter', () => {
  const before = percentageDotEncounter()
  expect(() =>
    resolveMasterBattleRecovery({
      ...before,
      tactical: {
        ...before.tactical,
        battle: { ...before.tactical.battle, lifecycle: 'abandoned', currentTurn: null },
      },
    }),
  ).toThrow(/already ended/)
})
