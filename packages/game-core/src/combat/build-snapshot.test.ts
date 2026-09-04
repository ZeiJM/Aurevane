import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  attachCombatBuildBridge,
  readCombatBuildSnapshot,
  validateCombatBuildBridge,
  validateCombatBuildSnapshot,
  type CombatBuildSnapshot,
} from './build-snapshot'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from './stat-driven-combat'

function encounter(): StatDrivenCombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:p3.7-build-snapshot',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 73737,
      combatants: [
        {
          id: 'character:00000000-0000-4000-8000-000000003701',
          teamId: 'players',
          initiative: 10,
          baseMovementBudget: 10,
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
          temporaryResources: [],
        },
        {
          id: 'recruit:p3-7',
          teamId: 'opponents',
          initiative: 5,
          baseMovementBudget: 10,
          hp: 80,
          maxHp: 80,
          mp: 25,
          maxMp: 25,
          temporaryResources: [],
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
        combatantId: 'character:00000000-0000-4000-8000-000000003701',
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'player-ground',
      },
      {
        combatantId: 'recruit:p3-7',
        position: { x: 1, y: 0 },
        facing: 'west',
        movementProfileId: 'recruit-ground',
      },
    ],
  })
  const profiles: StatDrivenCombatProfile[] = [
    {
      combatantId: 'character:00000000-0000-4000-8000-000000003701',
      provenance: {
        kind: 'character-derived',
        sourceId: 'character:00000000-0000-4000-8000-000000003701',
        sourceRulesVersion: 1,
      },
      accuracy: 8_000,
      evasion: 1_000,
      armor: 20,
      ward: 10,
      jump: 1,
    },
    {
      combatantId: 'recruit:p3-7',
      provenance: { kind: 'scenario', sourceId: 'scenario:p3-7', sourceRulesVersion: 1 },
      accuracy: 7_000,
      evasion: 800,
      armor: 20,
      ward: 20,
      jump: 1,
    },
  ]
  return createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), profiles)
}

function pureSnapshot(): CombatBuildSnapshot {
  return {
    schemaVersion: 1,
    sourceBuildSchemaVersion: 2,
    sourceBuildVersion: 7,
    fingerprint: `sha256:${'a'.repeat(64)}`,
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
    secondary: null,
    disciplineSkills: [
      {
        slotIndex: 1,
        skillId: 'skill.vanguard.forceful-strike',
        contentVersion: 1,
        sourceDisciplineId: 'vanguard',
      },
    ],
    extensions: {
      resonance: null,
      essence: {
        essenceId: 'essence.vanguard.unbroken-strike',
        contentVersion: 1,
        sourceDisciplineId: 'vanguard',
        skillId: 'essence.vanguard.unbroken-strike',
        skillContentVersion: 1,
      },
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

describe('P3.7 immutable combat build snapshot bridge', () => {
  it('accepts the representative pure build and preserves legacy states without a bridge', () => {
    expect(validateCombatBuildSnapshot(pureSnapshot())).toEqual([])
    expect(validateCombatBuildBridge(encounter())).toEqual([])
    expect(validateCombatBuildBridge(encounter(), true)).toEqual([
      { field: 'buildBridge', message: 'Combat build bridge is required.' },
    ])
  })

  it('attaches a copied snapshot to the matching combatant and reads it back', () => {
    const source = pureSnapshot()
    const state = attachCombatBuildBridge(encounter(), [
      {
        combatantId: 'character:00000000-0000-4000-8000-000000003701',
        characterId: '00000000-0000-4000-8000-000000003701',
        snapshot: source,
      },
    ])

    expect(validateCombatBuildBridge(state, true)).toEqual([])
    expect(
      readCombatBuildSnapshot(state, 'character:00000000-0000-4000-8000-000000003701'),
    ).toEqual(source)
    expect(readCombatBuildSnapshot(state, 'recruit:p3-7')).toBeNull()
    expect(state.buildBridge.combatants[0]?.snapshot).not.toBe(source)
  })

  it('rejects mixed Essence, pure Resonance, inactive Skill sources, and duplicate slots', () => {
    const mixedWithEssence: CombatBuildSnapshot = {
      ...pureSnapshot(),
      secondary: { disciplineId: 'lifebinder', definitionVersion: 1 },
    }
    expect(validateCombatBuildSnapshot(mixedWithEssence)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'extensions.essence' }),
      ]),
    )

    const pureWithResonance: CombatBuildSnapshot = {
      ...pureSnapshot(),
      extensions: {
        ...pureSnapshot().extensions,
        essence: null,
        resonance: {
          resonanceId: 'resonance.lifebinder-vanguard.mercys-edge',
          contentVersion: 1,
          disciplinePair: ['lifebinder', 'vanguard'],
        },
      },
    }
    expect(validateCombatBuildSnapshot(pureWithResonance)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'extensions.resonance' }),
      ]),
    )

    const invalidSkills: CombatBuildSnapshot = {
      ...pureSnapshot(),
      disciplineSkills: [
        {
          slotIndex: 1,
          skillId: 'skill.lifebinder.mending-light',
          contentVersion: 1,
          sourceDisciplineId: 'lifebinder',
        },
        {
          slotIndex: 1,
          skillId: 'skill.vanguard.forceful-strike',
          contentVersion: 1,
          sourceDisciplineId: 'vanguard',
        },
      ],
    }
    expect(validateCombatBuildSnapshot(invalidSkills)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'disciplineSkills.0.sourceDisciplineId' }),
        expect.objectContaining({ field: 'disciplineSkills.1.slotIndex' }),
      ]),
    )
  })

  it('fails closed on a bridge that points at an absent combatant', () => {
    const state = encounter() as StatDrivenCombatEncounterState & { buildBridge: unknown }
    state.buildBridge = {
      schemaVersion: 1,
      combatants: [
        {
          combatantId: 'character:00000000-0000-4000-8000-000000003799',
          characterId: '00000000-0000-4000-8000-000000003799',
          snapshot: pureSnapshot(),
        },
      ],
    }
    expect(validateCombatBuildBridge(state, true)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'buildBridge.combatants.0.combatantId' }),
      ]),
    )
  })
})
