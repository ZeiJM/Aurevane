import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  P36_REPRESENTATIVE_ESSENCES,
  essenceSnapshotReference,
  executePv1fEssenceSkill,
  resolveEssenceForBuild,
  validateEssenceDefinition,
} from './essence'
import { createPv1fTemporaryResources, readPv1fActionEconomy } from './pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from './stat-driven-combat'

function profile(combatantId: string): StatDrivenCombatProfile {
  return {
    combatantId,
    provenance: {
      kind: combatantId === 'player' ? 'character-derived' : 'scenario',
      sourceId: combatantId === 'player' ? 'character:p36-player' : 'scenario:p36-recruit',
      sourceRulesVersion: 1,
    },
    accuracy: 10_000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 1,
  }
}

function encounter(): StatDrivenCombatEncounterState {
  const playerProfile = profile('player')
  const recruitProfile = profile('recruit')
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:p3.6-essence',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 63636,
      combatants: [
        {
          id: 'player',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 50,
          maxHp: 50,
          mp: 20,
          maxMp: 20,
          temporaryResources: createPv1fTemporaryResources(16),
        },
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 50,
          maxHp: 50,
          mp: 20,
          maxMp: 20,
          temporaryResources: createPv1fTemporaryResources(16),
        },
      ],
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 2,
    height: 1,
    terrains: [{ id: 'open-ground', traversalCost: 1 }],
    tiles: [
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
    ],
    movementProfiles: [
      { id: 'player-ground', maxElevationStep: 1, terrainCostOverrides: [] },
      { id: 'recruit-ground', maxElevationStep: 1, terrainCostOverrides: [] },
    ],
    placements: [
      {
        combatantId: 'player',
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'player-ground',
      },
      {
        combatantId: 'recruit',
        position: { x: 1, y: 0 },
        facing: 'west',
        movementProfileId: 'recruit-ground',
      },
    ],
  })

  return createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), [
    playerProfile,
    recruitProfile,
  ])
}

describe('P3.6 versioned pure Essence framework', () => {
  it('keeps representative Essence content valid and resolves only for pure builds', () => {
    for (const definition of P36_REPRESENTATIVE_ESSENCES) {
      expect(validateEssenceDefinition(definition)).toEqual([])
    }

    const pure = resolveEssenceForBuild('vanguard', null)
    expect(pure?.essenceId).toBe('essence.vanguard.unbroken-strike')
    expect(resolveEssenceForBuild('vanguard', 'lifebinder')).toBeNull()
    expect(resolveEssenceForBuild('unknown-discipline', null)).toBeNull()
  })

  it('exposes a stable pure-build snapshot reference outside Discipline Skill slots', () => {
    const essence = resolveEssenceForBuild('vanguard', null)
    if (!essence) throw new Error('Expected representative Vanguard Essence.')

    expect(essenceSnapshotReference(essence)).toEqual({
      essenceId: essence.essenceId,
      contentVersion: 1,
      sourceDisciplineId: 'vanguard',
      skillId: 'essence.vanguard.unbroken-strike',
      skillContentVersion: 1,
    })
  })

  it('uses the canonical PV-1F Skill path for AP, cooldown, effects, and PvP overrides', () => {
    const essence = resolveEssenceForBuild('vanguard', null)
    if (!essence) throw new Error('Expected representative Vanguard Essence.')

    const pve = executePv1fEssenceSkill({
      state: encounter(),
      essence,
      primaryDisciplineId: 'vanguard',
      secondaryDisciplineId: null,
      combatContext: 'pve',
      selection: { kind: 'unit', combatantId: 'recruit' },
    })
    expect(readPv1fActionEconomy(pve.state, 'player')?.current).toBe(45)
    expect(
      pve.state.tactical.battle.combatants.find((row) => row.id === 'recruit')?.hp,
    ).toBe(30)
    expect(pve.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'skill_cooldown_started',
          cooldownKey: essence.skill.cooldown.key,
          actionId: essence.skill.id,
          definitionVersion: essence.skill.contentVersion,
        }),
        expect.objectContaining({
          event: 'action_economy_spent',
          combatantId: 'player',
          amount: 55,
          remaining: 45,
        }),
      ]),
    )

    const pvp = executePv1fEssenceSkill({
      state: encounter(),
      essence,
      primaryDisciplineId: 'vanguard',
      secondaryDisciplineId: null,
      combatContext: 'pvp',
      selection: { kind: 'unit', combatantId: 'recruit' },
    })
    expect(readPv1fActionEconomy(pvp.state, 'player')?.current).toBe(40)
    expect(pvp.events).toContainEqual(
      expect.objectContaining({
        event: 'action_economy_spent',
        combatantId: 'player',
        amount: 60,
        remaining: 40,
      }),
    )
  })

  it('fails closed for a mixed build before spending AP or applying effects', () => {
    const essence = resolveEssenceForBuild('vanguard', null)
    if (!essence) throw new Error('Expected representative Vanguard Essence.')
    const state = encounter()

    expect(() =>
      executePv1fEssenceSkill({
        state,
        essence,
        primaryDisciplineId: 'vanguard',
        secondaryDisciplineId: 'lifebinder',
        combatContext: 'pve',
        selection: { kind: 'unit', combatantId: 'recruit' },
      }),
    ).toThrow('That Essence Skill is not legal for the committed Discipline build.')

    expect(readPv1fActionEconomy(state, 'player')?.current).toBe(100)
    expect(state.tactical.battle.combatants.find((row) => row.id === 'recruit')?.hp).toBe(50)
  })
})
