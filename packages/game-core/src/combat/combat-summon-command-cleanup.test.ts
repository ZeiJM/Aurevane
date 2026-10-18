import { expect, it } from 'vitest'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { reconcileCombatAbilitySources } from './combat-behavior-runtime'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { spawnCombatSummon } from './combat-summons'
import { resolveMatureSkillVersion } from './mature-skills'
import {
  evaluatePv1fMatureSkill,
  executePv1fMatureSkill,
  preparePv1fTurnEconomy,
} from './pv1f-action-economy'
import {
  createCurrentStatDrivenCombatEncounterState,
  validateStatDrivenCombatEncounterState,
} from './stat-driven-combat'

it('retains the cleaned bridge when a historical native Mature root and Manual modifier defeat a summon', () => {
  const base = percentageDotEncounter()
  const spawned = spawnCombatSummon(
    createCurrentStatDrivenCombatEncounterState(
      base,
      base.statBridge.combatants.map((profile) => ({
        ...profile,
        level: 1,
        criticalChance: 0,
        physicalPower: 200,
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
  const modifier = captureCombatAbilitySource(
    source(
      {
        id: 'bonus',
        mode: 'modifier',
        targeting: null,
        costs: [],
        requirements: { kind: 'action', sourceDisciplineId: 'vanguard' },
        effects: [
          { id: 'extra', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
        ],
      },
      'modifier',
    ),
  )
  const state = preparePv1fTurnEconomy(
    reconcileCombatAbilitySources(spawned, [modifier]) as typeof spawned,
  )
  const child = state.effectState!.summons![0]!
  const definition = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
  expect(Object.hasOwn(definition, 'ability')).toBe(false)
  const target = { kind: 'unit' as const, combatantId: child.combatantId }
  const options = { manualModifiers: [{ sourceInstanceId: 'modifier', behaviorId: 'bonus' }] }
  const before = JSON.stringify(state)
  const quote = evaluatePv1fMatureSkill(state, definition, target, 'pve', options)
  expect(quote.command?.root.kind).toBe('native')
  expect(quote.evaluation.legal).toBe(true)
  expect(JSON.stringify(state)).toBe(before)
  const out = executePv1fMatureSkill(state, definition, target, 'pve', options)
  expect(JSON.stringify(state)).toBe(before)
  expect(validateStatDrivenCombatEncounterState(JSON.parse(JSON.stringify(out.state)))).toEqual([])
  expect(out.state.effectState?.summons).toEqual([])
  expect(out.state.statBridge.combatants.some((row) => row.combatantId === child.combatantId)).toBe(
    false,
  )
  expect(out.state.tactical.battle.combatants.some((row) => row.id === child.combatantId)).toBe(
    false,
  )
  expect(out.state.tactical.battle.lifecycle).toBe('active')
  expect(
    out.events.filter((e) => (e as { event: string }).event === 'summon_defeated'),
  ).toHaveLength(1)
})
