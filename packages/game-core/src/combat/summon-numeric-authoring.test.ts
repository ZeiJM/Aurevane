import { expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { resolveMatureSkillVersion } from './mature-skills'
import { spawnCombatSummon } from './combat-summons'
import { endTurn, selectFinalFacing } from './battle-state'
import {
  evaluatePv1fSummonAbility,
  executePv1fSummonAbility,
  preparePv1fTurnEconomy,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import {
  createCurrentStatDrivenCombatEncounterState,
  validateStatDrivenCombatEncounterState,
} from './stat-driven-combat'

function prepared(apCost: number) {
  const original = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
  const ability = {
    ...original.abilities[0]!,
    apCost,
    mpCost: 100,
    cooldownOwnerTurns: 100,
    tags: ['heal', 'support', 'mystic'],
    target: {
      kind: 'self' as const,
      teamPolicy: 'self' as const,
      friendlyFire: 'allies-only' as const,
      shape: { kind: 'single' as const },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    effects: [{ type: 'healing' as const, recipient: 'actor' as const, amount: 4 }],
  }
  const base = percentageDotEncounter()
  const initial = createCurrentStatDrivenCombatEncounterState(
    base,
    base.statBridge.combatants.map((row) => ({
      ...row,
      level: 1,
      criticalChance: 0,
      physicalPower: 20,
      mysticPower: 20,
    })),
  )
  const spawned = spawnCombatSummon(initial, {
    ownerCombatantId: 'actor',
    sourceSkillId: 'test.call',
    sourceSkillVersion: 1,
    profile: { ...original, lifetimeTurns: 100, maxMp: 200, abilities: [ability] },
    position: { x: 0, y: 1 },
    facing: 'east',
  })
  const summon = spawned.state.effectState!.summons![0]!
  let state = spawned.state
  for (
    let index = 0;
    index < 8 && state.tactical.battle.currentTurn?.combatantId !== summon.combatantId;
    index++
  ) {
    const battle = endTurn(selectFinalFacing(state.tactical.battle, 'east').state).state
    state = { ...state, tactical: { ...state.tactical, battle } }
  }
  return { state: preparePv1fTurnEconomy(state), summon, ability }
}

it('quotes and executes zero AP Summon recovery with large MP costs and cooldowns', () => {
  const { state, summon, ability } = prepared(0)
  const quote = evaluatePv1fSummonAbility(state, summon, ability.id, { kind: 'self' })
  expect(quote.cost).toBe(0)
  expect(quote.evaluation.legal).toBe(true)
  expect(quote.action.effects[0]).toMatchObject({ type: 'healing', amount: 4 })
  const result = executePv1fSummonAbility(state, summon, ability.id, { kind: 'self' })
  expect(readPv1fActionEconomy(result.state, summon.combatantId)?.current).toBe(
    readPv1fActionEconomy(state, summon.combatantId)?.current,
  )
  expect(result.events).toContainEqual(
    expect.objectContaining({
      event: 'skill_cooldown_started',
      ownerTurns: 100,
      ticksRemaining: 101,
    }),
  )
  expect(validateStatDrivenCombatEncounterState(JSON.parse(JSON.stringify(result.state)))).toEqual(
    [],
  )
})

it.each([101, 401, Number.MAX_SAFE_INTEGER])(
  'quotes exact Summon AP cost %i without throwing or granting affordability',
  (apCost) => {
    const { state, summon, ability } = prepared(apCost)
    const before = JSON.stringify(state)
    const quote = evaluatePv1fSummonAbility(state, summon, ability.id, { kind: 'self' })
    expect(quote.cost).toBe(apCost)
    expect(quote.action.effects[0]).toMatchObject({
      type: 'healing',
      amount:
        4 + Math.floor((summon.profile.stats.mysticPower * Math.min(apCost * 50, 20000)) / 10000),
    })
    expect(() => executePv1fSummonAbility(state, summon, ability.id, { kind: 'self' })).toThrow(
      'Not enough Action Economy',
    )
    expect(JSON.stringify(state)).toBe(before)
  },
)
