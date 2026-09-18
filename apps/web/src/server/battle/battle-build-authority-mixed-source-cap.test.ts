import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'

import type { CharacterCommittedBuildSnapshotRecord } from '@/server/character/character-build-service'
import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'

import {
  createBattleBuildAuthoritySnapshot,
  createResolvedBattleBuildAuthoritySnapshot,
  parseBattleBuildAuthoritySnapshot,
  resolveBattleDisciplineSkillDefinitions,
  resolveBattleTemporarySkillDefinition,
} from './battle-build-authority'

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

function currentStaticSkill(skillId: string): MatureSkillDefinition | null {
  return resolveMatureSkillVersion(skillId)
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

  it('pins the current published Skill version into new battle authority', async () => {
    const resolver: CombatContentResolver = {
      async resolveCurrentSkillDefinition(skillId) {
        const definition = currentStaticSkill(skillId)
        if (!definition) return null
        return skillId === 'vanguard.forceful-strike'
          ? { ...structuredClone(definition), contentVersion: 7, apCost: 44 }
          : structuredClone(definition)
      },
      async resolvePinnedSkillDefinition(skillId, version) {
        return resolveMatureSkillVersion(skillId, version)
      },
    }

    const authority = await createResolvedBattleBuildAuthoritySnapshot(
      'pve',
      [
        {
          combatantId: 'character:00000000-0000-4000-8000-000000004301',
          characterId: '00000000-0000-4000-8000-000000004301',
          snapshot: productionShapeMixedSnapshot(),
        },
      ],
      resolver,
    )

    expect(authority.catalogVersion).toBe(3)
    expect(authority.combatants[0]?.disciplineSkills[0]).toEqual(
      expect.objectContaining({
        skillId: 'vanguard.forceful-strike',
        contentVersion: 7,
        sourceDisciplineId: 'vanguard',
      }),
    )
    expect(parseBattleBuildAuthoritySnapshot(structuredClone(authority))).not.toBeNull()
  })

  it('rejects a publication that changes the Skill source Discipline', async () => {
    const resolver: CombatContentResolver = {
      async resolveCurrentSkillDefinition(skillId) {
        const definition = currentStaticSkill(skillId)
        if (!definition) return null
        return skillId === 'vanguard.forceful-strike'
          ? {
              ...structuredClone(definition),
              contentVersion: 7,
              sourceDisciplineId: 'lifebinder',
            }
          : structuredClone(definition)
      },
      async resolvePinnedSkillDefinition(skillId, version) {
        return resolveMatureSkillVersion(skillId, version)
      },
    }

    await expect(
      createResolvedBattleBuildAuthoritySnapshot(
        'pve',
        [
          {
            combatantId: 'character:00000000-0000-4000-8000-000000004301',
            characterId: '00000000-0000-4000-8000-000000004301',
            snapshot: productionShapeMixedSnapshot(),
          },
        ],
        resolver,
      ),
    ).rejects.toThrow(/source Discipline/u)
  })
  it('resolves exact pinned regular pools and validates temporary grants against the source build', async () => {
    const resolver: CombatContentResolver = {
      async resolveCurrentSkillDefinition(skillId) {
        const definition = currentStaticSkill(skillId)
        if (!definition) return null
        return skillId === 'vanguard.forceful-strike'
          ? { ...structuredClone(definition), contentVersion: 7, apCost: 44 }
          : structuredClone(definition)
      },
      async resolvePinnedSkillDefinition(skillId, version) {
        const definition = currentStaticSkill(skillId)
        if (!definition) return null
        if (skillId === 'vanguard.forceful-strike' && version === 7) {
          return { ...structuredClone(definition), contentVersion: 7, apCost: 44 }
        }
        return resolveMatureSkillVersion(skillId, version)
      },
    }
    const sourceId = 'character:00000000-0000-4000-8000-000000004302'
    const actorId = 'character:00000000-0000-4000-8000-000000004303'
    const authority = await createResolvedBattleBuildAuthoritySnapshot(
      'pvp',
      [
        {
          combatantId: sourceId,
          characterId: '00000000-0000-4000-8000-000000004302',
          snapshot: productionShapeMixedSnapshot(),
        },
        {
          combatantId: actorId,
          characterId: '00000000-0000-4000-8000-000000004303',
          snapshot: productionShapeMixedSnapshot(),
        },
      ],
      resolver,
    )

    const pool = await resolveBattleDisciplineSkillDefinitions(authority, sourceId, resolver)
    expect(pool?.map((definition) => [definition.id, definition.contentVersion])).toEqual([
      ['vanguard.forceful-strike', 7],
      ['vanguard.rally', 1],
      ['vanguard.brace', 1],
      ['lifebinder.barrier', 1],
    ])

    await expect(
      resolveBattleTemporarySkillDefinition(
        authority,
        {
          combatantId: actorId,
          sourceCombatantId: sourceId,
          skillId: 'vanguard.forceful-strike',
          contentVersion: 7,
        },
        resolver,
      ),
    ).resolves.toMatchObject({
      id: 'vanguard.forceful-strike',
      contentVersion: 7,
      apCost: 44,
    })

    await expect(
      resolveBattleTemporarySkillDefinition(
        authority,
        {
          combatantId: actorId,
          sourceCombatantId: sourceId,
          skillId: 'vanguard.forceful-strike',
          contentVersion: 6,
        },
        resolver,
      ),
    ).resolves.toBeNull()
  })
})
