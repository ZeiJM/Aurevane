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
it('clears a real Controlled prime without refunding costs or losing captured definitions/usage', async () => {
  const { source } =
    await import('../../../../../packages/game-core/src/combat/combat-behavior.test-utils')
  const { captureCombatAbilitySource } =
    await import('@aurevane/game-core/combat/combat-behavior-capture')
  const { reconcileCombatAbilitySources, primeCombatControlledAbility } =
    await import('@aurevane/game-core/combat/combat-behavior-runtime')
  const { preparePv1fTurnEconomy } = await import('@aurevane/game-core/combat/pv1f-action-economy')
  const captured = captureCombatAbilitySource(
    source({
      cooldown: { key: 'recovery-test', ownerTurns: 2 },
      effects: [
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
      ],
    }),
  )
  const base = preparePv1fTurnEconomy(percentageDotEncounter())
  const primed = primeCombatControlledAbility({
    state: reconcileCombatAbilitySources(base, [captured]),
    actorId: 'actor',
    sourceInstanceId: 'source-a',
    behaviorId: 'strike',
  }).state
  expect(primed.abilityRuntime?.controlled?.primes).toHaveLength(1)
  const terminal = resolveMasterBattleRecovery({ ...primed, statBridge: base.statBridge })
  expect(terminal.abilityRuntime?.controlled?.primes).toEqual([])
  expect(terminal.abilityRuntime?.controlled?.used).toEqual(primed.abilityRuntime?.controlled?.used)
  expect(terminal.abilityRuntime?.activeSourceIds).toEqual([])
  expect(terminal.abilityRuntime?.maintained).toEqual([])
  expect(terminal.capturedAbilitySources).toEqual(primed.capturedAbilitySources)
  expect(terminal.tactical.battle.combatants).toEqual(primed.tactical.battle.combatants)
  expect(validateStatDrivenCombatEncounterState(terminal)).toEqual([])
})
