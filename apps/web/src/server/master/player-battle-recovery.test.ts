import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { resolveMasterBattleRecovery } from './player-battle-recovery'
import {
  createCurrentStatDrivenCombatEncounterState,
  validateStatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
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

it('clears actual spawned summons and deferred execution while retaining human resources', async () => {
  const { spawnCombatSummon } = await import('@aurevane/game-core/combat/combat-summons')
  const { resolveMatureSkillVersion } = await import('@aurevane/game-core/combat/mature-skills')
  const base = percentageDotEncounter()
  const before = spawnCombatSummon(
    createCurrentStatDrivenCombatEncounterState(
      base,
      base.statBridge.combatants.map((profile) => ({
        ...profile,
        level: 1,
        criticalChance: 0,
        physicalPower: 20,
        mysticPower: 20,
      })),
    ),
    {
      ownerCombatantId: 'enemy',
      sourceSkillId: 'wildwarden.renewing-herbs',
      sourceSkillVersion: 6,
      profile: resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!,
      position: { x: 0, y: 1 },
      facing: 'east',
    },
  ).state
  expect(before.effectState?.summons).toHaveLength(1)
  const terminal = resolveMasterBattleRecovery(before)
  expect(terminal.tactical.battle.combatants.some((unit) => unit.kind === 'summon')).toBe(false)
  expect(terminal.effectState).toBeUndefined()
  expect(terminal.statBridge.combatants).toHaveLength(before.statBridge.combatants.length - 1)
  expect(validateStatDrivenCombatEncounterState(terminal)).toEqual([])
})
