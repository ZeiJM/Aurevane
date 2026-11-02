import { expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { resolveMatureSkillVersion } from './mature-skills'
import { validateSummonProfileDefinition } from './summon-content'
import { validateCombatTagPayload } from './combat-tag-registry'
import { spawnCombatSummon } from './combat-summons'
import { endTurn, selectFinalFacing } from './battle-state'
import {
  evaluatePv1fSummonAbility,
  executePv1fSummonAbility,
  preparePv1fTurnEconomy,
} from './pv1f-action-economy'
import {
  createCurrentStatDrivenCombatEncounterState,
  validateStatDrivenCombatEncounterState,
} from './stat-driven-combat'

function groundProfile() {
  const original = resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!
  return {
    ...original,
    abilities: [
      {
        ...original.abilities[0]!,
        target: {
          geometryVersion: 3 as const,
          kind: 'ground-tile' as const,
          categories: ['ground' as const],
          teamPolicy: 'any' as const,
          shape: { kind: 'single' as const },
          minimumRange: 0,
          maximumRange: 3,
          requiresLineOfSight: false,
          maximumElevationDifference: 2,
          friendlyFire: 'all-units' as const,
        },
        effects: [
          {
            type: 'apply-status' as const,
            recipient: 'affected-units' as const,
            target: 'ground' as const,
            statusId: 'guarded',
            stacks: 1,
            durationTurns: 2,
          },
        ],
        groundArea: {
          durationRounds: 4,
          visualPresetId: 'arcane-pulse' as const,
          entryEffectOrdinals: [0],
          timing: 'instant' as const,
        },
      },
    ],
  }
}
it('validates optional Summon Ground metadata and rejects malformed or actor-only entries', () => {
  const profile = groundProfile()
  expect(validateSummonProfileDefinition(profile)).toEqual([])
  expect(validateCombatTagPayload({ type: 'summon', recipient: 'selected-tile', profile })).toEqual(
    [],
  )
  for (const groundArea of [
    { ...profile.abilities[0]!.groundArea, durationRounds: 0 },
    { ...profile.abilities[0]!.groundArea, entryEffectOrdinals: [3] },
    { ...profile.abilities[0]!.groundArea, entryEffectOrdinals: [0, 0] },
  ])
    expect(
      validateSummonProfileDefinition({
        ...profile,
        abilities: [{ ...profile.abilities[0]!, groundArea }],
      }),
    ).not.toEqual([])
  const actor = {
    ...profile,
    abilities: [
      {
        ...profile.abilities[0]!,
        effects: [
          {
            type: 'apply-status' as const,
            recipient: 'actor' as const,
            target: 'self' as const,
            statusId: 'guarded',
            stacks: 1,
          },
        ],
      },
    ],
  }
  expect(validateSummonProfileDefinition(actor)).not.toEqual([])
})
it('quotes, commits and reloads a Summon Ground field without changing captured profile or ordinals', () => {
  const profile = groundProfile()
  const original = JSON.stringify(profile)
  const base = percentageDotEncounter()
  const initial = createCurrentStatDrivenCombatEncounterState(
    base,
    base.statBridge.combatants.map((profile) => ({
      ...profile,
      level: 1,
      criticalChance: 0,
      physicalPower: 20,
      mysticPower: 20,
    })),
  )
  const spawned = spawnCombatSummon(
    { ...initial, groundEffectPolicyVersion: 1 },
    {
      ownerCombatantId: 'actor',
      sourceSkillId: 'wildwarden.renewing-herbs',
      sourceSkillVersion: 5,
      profile,
      position: { x: 0, y: 1 },
      facing: 'east',
    },
  )
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
  state = preparePv1fTurnEconomy(state)
  const before = JSON.stringify(state)
  const ability = profile.abilities[0]!
  const target = { kind: 'tile' as const, position: { x: 1, y: 0 } }
  const quote = evaluatePv1fSummonAbility(state, summon, ability.id, target)
  expect(quote.evaluation.legal).toBe(true)
  expect(quote.action.groundArea).toEqual(ability.groundArea)
  expect(JSON.stringify(state)).toBe(before)
  const result = executePv1fSummonAbility(state, summon, ability.id, target)
  const restored = JSON.parse(JSON.stringify(result.state))
  expect(validateStatDrivenCombatEncounterState(restored)).toEqual([])
  expect(restored.groundAreas).toHaveLength(1)
  expect(restored.groundAreas[0]).toMatchObject({
    activationRound: state.tactical.battle.round,
    entryEffects: [{ type: 'apply-status', statusId: 'guarded' }],
  })
  expect(JSON.stringify(profile)).toBe(original)
})
