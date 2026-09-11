import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { CharacterCommittedBuildSnapshotRecord } from '@/server/character/character-build-service'

import { createBattleBuildAuthoritySnapshot } from './battle-build-authority'

function productionShapeMixedSnapshot(): CharacterCommittedBuildSnapshotRecord {
  return {
    schemaVersion: 3,
    buildVersion: 29,
    primary: {
      disciplineId: 'vanguard',
      definitionVersion: 1,
      profileVersion: 1,
    },
    secondary: {
      disciplineId: 'lifebinder',
      definitionVersion: 1,
    },
    disciplineSkills: [
      {
        slotIndex: 1,
        skillId: 'vanguard.forceful-strike',
        contentVersion: 2,
        sourceDisciplineId: 'vanguard',
      },
      {
        slotIndex: 2,
        skillId: 'vanguard.rally',
        contentVersion: 1,
        sourceDisciplineId: 'vanguard',
      },
      {
        slotIndex: 3,
        skillId: 'vanguard.brace',
        contentVersion: 1,
        sourceDisciplineId: 'vanguard',
      },
      {
        slotIndex: 4,
        skillId: 'lifebinder.barrier',
        contentVersion: 1,
        sourceDisciplineId: 'lifebinder',
      },
    ],
    extensions: {
      resonance: {
        resonanceId: 'resonance.lifebinder-vanguard.mercys-edge',
        contentVersion: 1,
        disciplinePair: ['lifebinder', 'vanguard'],
      },
      essence: null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

describe('battle build authority mixed Technique source capacity', () => {
  it('accepts the canonical legal 3+1 mixed loadout when entering PvE battle', () => {
    const snapshot = productionShapeMixedSnapshot()

    expect(() =>
      createBattleBuildAuthoritySnapshot('pve', [
        {
          combatantId: 'character:00000000-0000-4000-8000-000000004301',
          characterId: '00000000-0000-4000-8000-000000004301',
          snapshot,
        },
      ]),
    ).not.toThrow()

    const authority = createBattleBuildAuthoritySnapshot('pve', [
      {
        combatantId: 'character:00000000-0000-4000-8000-000000004301',
        characterId: '00000000-0000-4000-8000-000000004301',
        snapshot,
      },
    ])

    expect(authority.combatants[0]?.disciplineSkills).toHaveLength(4)
    expect(
      authority.combatants[0]?.disciplineSkills.filter(
        (skill) => skill.sourceDisciplineId === 'vanguard',
      ),
    ).toHaveLength(3)
  })
})
