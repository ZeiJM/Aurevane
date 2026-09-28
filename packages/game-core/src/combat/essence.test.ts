import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  P36_REPRESENTATIVE_ESSENCES,
  essenceSnapshotReference,
  evaluatePv1fEssenceSkillForAi,
  executePv1fEssenceSkill,
  resolveEssenceForBuild,
  validateEssenceDefinition,
} from './essence'
import { currentMysticMpCost, latestEnabledMatureSkills } from './mature-skills'
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

    const vanguard = resolveEssenceForBuild('vanguard', null)
    expect(vanguard?.essenceId).toBe('essence.vanguard.unbroken-strike')
    const lifebinder = resolveEssenceForBuild('lifebinder', null)
    expect(lifebinder?.essenceId).toBe('essence.lifebinder.verdant-rupture')
    expect(resolveEssenceForBuild('vanguard', 'lifebinder')).toBeNull()
    expect(resolveEssenceForBuild('unknown-discipline', null)).toBeNull()
  })

  it('keeps all current Essences as bounded higher-cost combat-v5 signature Skills', () => {
    const disciplineIds = [
      ...new Set(P36_REPRESENTATIVE_ESSENCES.map((row) => row.sourceDisciplineId)),
    ]
    const regularSkills = latestEnabledMatureSkills()

    expect(disciplineIds).toHaveLength(17)
    for (const disciplineId of disciplineIds) {
      const definition = resolveEssenceForBuild(disciplineId, null)
      if (!definition) throw new Error(`Expected current Essence for ${disciplineId}.`)

      const ordinary = regularSkills.filter((skill) => skill.sourceDisciplineId === disciplineId)
      const averageOrdinaryAp =
        ordinary.reduce((sum, skill) => sum + skill.apCost, 0) / Math.max(1, ordinary.length)

      expect(validateEssenceDefinition(definition), definition.essenceId).toEqual([])
      expect(definition.flavorLine?.trim().length, definition.essenceId).toBeGreaterThan(0)
      expect(definition.skill.authoring.validationTags, definition.essenceId).toContain(
        'owner-rebalance-v5',
      )
      expect(definition.skill.apCost, definition.essenceId).toBeGreaterThanOrEqual(55)
      expect(definition.skill.apCost, definition.essenceId).toBeLessThanOrEqual(75)
      expect(definition.skill.apCost, definition.essenceId).toBeGreaterThan(averageOrdinaryAp)

      if (definition.skill.requirements.length > 0) {
        expect(definition.skill.cooldown, definition.essenceId).toBeNull()
      } else {
        expect(definition.skill.cooldown?.ownerTurns, definition.essenceId).toBeGreaterThanOrEqual(
          1,
        )
        expect(definition.skill.cooldown?.ownerTurns, definition.essenceId).toBeLessThanOrEqual(3)
      }

      for (const effect of definition.skill.effects) {
        expect(effect.durationTurns, definition.essenceId).toBeGreaterThanOrEqual(0)
        expect(effect.durationTurns, definition.essenceId).toBeLessThanOrEqual(4)
        if (
          effect.type === 'damage' ||
          effect.type === 'healing' ||
          effect.type === 'barrier-change'
        ) {
          expect(effect.amount, definition.essenceId).toBeGreaterThanOrEqual(1)
          expect(effect.amount, definition.essenceId).toBeLessThanOrEqual(20)
        }
        if (effect.type === 'resource-change') {
          expect(Math.abs(effect.delta), definition.essenceId).toBeGreaterThanOrEqual(1)
          expect(Math.abs(effect.delta), definition.essenceId).toBeLessThanOrEqual(20)
        }
        if (effect.power !== undefined) {
          expect(effect.power, definition.essenceId).toBeGreaterThanOrEqual(1)
          expect(effect.power, definition.essenceId).toBeLessThanOrEqual(20)
        }
      }
    }
  })

  it('normalizes current mystic Essence MP while retaining historical versions', () => {
    const disciplineIds = [
      ...new Set(P36_REPRESENTATIVE_ESSENCES.map((row) => row.sourceDisciplineId)),
    ]
    for (const disciplineId of disciplineIds) {
      const definition = resolveEssenceForBuild(disciplineId, null)
      if (!definition) throw new Error(`Expected current Essence for ${disciplineId}.`)
      if (definition.skill.tags.includes('mystic')) {
        expect(definition.skill.mpCost).toBe(currentMysticMpCost(definition.skill.apCost))
      } else {
        expect(definition.skill.mpCost ?? 0).toBe(0)
      }
    }

    expect(resolveEssenceForBuild('aetherist', null, 2)?.skill.mpCost).toBeUndefined()
    expect(resolveEssenceForBuild('aetherist', null)?.skill.mpCost).toBe(4)
    expect(resolveEssenceForBuild('lifebinder', null, 2)?.skill.mpCost).toBeUndefined()
    expect(resolveEssenceForBuild('lifebinder', null)?.skill.mpCost).toBe(3)
  })

  it('tunes current Sevenfold Cut without mutating its historical Phase 4 version', () => {
    const current = resolveEssenceForBuild('edgedancer', null)
    const historical = resolveEssenceForBuild('edgedancer', null, 2)
    if (!current || !historical) throw new Error('Expected Edgedancer Essence versions.')

    expect(current.contentVersion).toBe(4)
    expect(
      current.skill.effects
        .filter((effect) => effect.type === 'damage')
        .map((effect) => effect.amount),
    ).toEqual([9, 9, 9, 9, 9, 9, 9])
    expect(
      historical.skill.effects
        .filter((effect) => effect.type === 'damage')
        .map((effect) => effect.amount),
    ).toEqual([3, 3, 3, 3, 3, 3, 3])
  })

  it('exposes a stable pure-build snapshot reference outside Discipline Skill slots', () => {
    const essence = resolveEssenceForBuild('vanguard', null)
    if (!essence) throw new Error('Expected representative Vanguard Essence.')

    expect(essenceSnapshotReference(essence)).toEqual({
      essenceId: essence.essenceId,
      contentVersion: 3,
      sourceDisciplineId: 'vanguard',
      skillId: 'essence.vanguard.unbroken-strike',
      skillContentVersion: 3,
    })

    const historical = resolveEssenceForBuild('vanguard', null, 1)
    expect(historical && essenceSnapshotReference(historical)).toEqual({
      essenceId: 'essence.vanguard.unbroken-strike',
      contentVersion: 1,
      sourceDisciplineId: 'vanguard',
      skillId: 'essence.vanguard.unbroken-strike',
      skillContentVersion: 1,
    })
  })

  it('gives AI the same pure-build legality, AP override, target evaluation, and authored utility', () => {
    const essence = resolveEssenceForBuild('vanguard', null)
    if (!essence) throw new Error('Expected representative Vanguard Essence.')
    const selection = { kind: 'unit', combatantId: 'recruit' } as const

    const pve = evaluatePv1fEssenceSkillForAi({
      state: encounter(),
      essence,
      primaryDisciplineId: 'vanguard',
      secondaryDisciplineId: null,
      combatContext: 'pve',
      selection,
    })
    expect(pve).toMatchObject({
      essenceId: 'essence.vanguard.unbroken-strike',
      skillId: 'essence.vanguard.unbroken-strike',
      legal: true,
      affordable: true,
      apCost: 55,
      actionEconomyRemaining: 100,
      baseUtility: 95,
      purposeTags: ['damage', 'finisher', 'pure-build'],
      combatEvaluation: { legal: true, primaryCombatantId: 'recruit' },
    })

    const pvp = evaluatePv1fEssenceSkillForAi({
      state: encounter(),
      essence,
      primaryDisciplineId: 'vanguard',
      secondaryDisciplineId: null,
      combatContext: 'pvp',
      selection,
    })
    expect(pvp?.apCost).toBe(60)

    expect(
      evaluatePv1fEssenceSkillForAi({
        state: encounter(),
        essence,
        primaryDisciplineId: 'vanguard',
        secondaryDisciplineId: 'lifebinder',
        combatContext: 'pve',
        selection,
      }),
    ).toBeNull()
  })

  it('uses canonical PV-1F Essence authority for AP, effects, repeat-use, and PvP', () => {
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
    expect(pve.state.tactical.battle.combatants.find((row) => row.id === 'recruit')?.hp).toBe(30)
    expect(pve.events).toContainEqual(
      expect.objectContaining({
        event: 'skill_cooldown_started',
        actionId: essence.skill.id,
        ownerTurns: 3,
      }),
    )
    expect(pve.events).toContainEqual(
      expect.objectContaining({
        event: 'action_economy_spent',
        combatantId: 'player',
        amount: 55,
        remaining: 45,
      }),
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

  it('executes Verdant Rupture as the pure Lifebinder offensive Essence Skill', () => {
    const essence = resolveEssenceForBuild('lifebinder', null)
    if (!essence) throw new Error('Expected representative Lifebinder Essence.')

    const result = executePv1fEssenceSkill({
      state: encounter(),
      essence,
      primaryDisciplineId: 'lifebinder',
      secondaryDisciplineId: null,
      combatContext: 'pve',
      selection: { kind: 'unit', combatantId: 'recruit' },
    })

    expect(essence.name).toBe('Verdant Rupture')
    expect(essence.skill.tags).toEqual(expect.arrayContaining(['attack', 'cockpit:attack']))
    expect(readPv1fActionEconomy(result.state, 'player')?.current).toBe(45)
    expect(result.state.tactical.battle.combatants.find((row) => row.id === 'recruit')?.hp).toBe(31)
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


describe('Combat v5.1 Essence targeting balance', () => {
  it('publishes current Essence versions with v5.1 targeting rules while preserving v5 history', () => {
    const disciplineIds = [
      ...new Set(P36_REPRESENTATIVE_ESSENCES.map((row) => row.sourceDisciplineId)),
    ]
    const elevations = new Map<number, number>([
      [0, 0],
      [1, 0],
      [2, 0],
    ])

    for (const disciplineId of disciplineIds) {
      const current = resolveEssenceForBuild(disciplineId, null)
      if (!current) throw new Error(`Expected current Essence for ${disciplineId}.`)

      expect(current.authoring.validationTags, current.essenceId).toContain('owner-rebalance-v5-1')
      expect(current.skill.authoring.validationTags, current.essenceId).toContain(
        'owner-rebalance-v5-1',
      )
      expect(current.skill.apCost, current.essenceId).toBeGreaterThanOrEqual(55)
      expect(current.skill.apCost, current.essenceId).toBeLessThanOrEqual(75)

      if (current.skill.target.kind === 'self') {
        expect(current.skill.target.maximumRange, current.essenceId).toBe(0)
        expect(current.skill.target.maximumElevationDifference, current.essenceId).toBeNull()
      } else {
        expect(current.skill.target.maximumRange, current.essenceId).toBeGreaterThanOrEqual(1)
        expect(current.skill.target.maximumRange, current.essenceId).toBeLessThanOrEqual(5)
        const elevation = current.skill.target.maximumElevationDifference
        expect(elevation, current.essenceId).not.toBeNull()
        expect(elevation ?? 0, current.essenceId).toBeGreaterThanOrEqual(0)
        expect(elevation ?? 0, current.essenceId).toBeLessThanOrEqual(2)
        elevations.set(elevation ?? 0, (elevations.get(elevation ?? 0) ?? 0) + 1)
      }

      const previous = resolveEssenceForBuild(
        disciplineId,
        null,
        current.contentVersion - 1,
      )
      if (!previous) throw new Error(`Expected prior Essence for ${disciplineId}.`)
      expect(previous.skill.authoring.validationTags, previous.essenceId).toContain(
        'owner-rebalance-v5',
      )
      expect(previous.skill.authoring.validationTags, previous.essenceId).not.toContain(
        'owner-rebalance-v5-1',
      )
    }

    expect(elevations.get(0) ?? 0).toBeGreaterThan(elevations.get(1) ?? 0)
    expect(elevations.get(1) ?? 0).toBeGreaterThan(elevations.get(2) ?? 0)
    expect(elevations.get(2) ?? 0).toBeGreaterThan(0)
  })
})
