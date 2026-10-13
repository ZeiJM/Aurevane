import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'

import type { CharacterCommittedBuildSnapshotRecord } from '@/server/character/character-build-service'
import {
  createCombatContentResolver,
  type CombatContentResolver,
} from '@/server/combat/combat-content-resolver'

import {
  createBattleBuildAuthoritySnapshot,
  createResolvedBattleBuildAuthoritySnapshot,
  parseBattleBuildAuthoritySnapshot,
  resolveBattleDisciplineSkillDefinitions,
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
  it('resolves exact pinned regular Skill pools', async () => {
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
      ['vanguard.rally', 5],
      ['vanguard.brace', 4],
      ['lifebinder.barrier', 4],
    ])
  })
})

describe('bulk current Skill authority preparation', () => {
  const inputs = () =>
    ['actor', 'target'].map((characterId) => ({
      characterId,
      combatantId: `character:${characterId}`,
      snapshot: productionShapeMixedSnapshot(),
    }))
  it('reads duplicated participant Skills in one batch and preserves the complete fallback authority', async () => {
    const current = vi.fn(async (skillId: string) => {
      const definition = currentStaticSkill(skillId)
      return (
        definition && {
          ...definition,
          contentVersion: skillId === 'vanguard.forceful-strike' ? 7 : definition.contentVersion,
        }
      )
    })
    const fallback: CombatContentResolver = {
      resolveCurrentSkillDefinition: current,
      resolvePinnedSkillDefinition: async (id, version) => resolveMatureSkillVersion(id, version),
    }
    const expected = await createResolvedBattleBuildAuthoritySnapshot('pvp', inputs(), fallback)
    current.mockClear()
    const bulk = vi.fn(
      async (ids: readonly string[]) =>
        new Map(await Promise.all(ids.map(async (id) => [id, (await current(id))!] as const))),
    )
    const actual = await createResolvedBattleBuildAuthoritySnapshot('pvp', inputs(), {
      ...fallback,
      resolveCurrentSkillDefinitions: bulk,
    })
    expect(actual).toEqual(expected)
    expect(bulk).toHaveBeenCalledExactlyOnceWith([
      'vanguard.forceful-strike',
      'vanguard.rally',
      'vanguard.brace',
      'lifebinder.barrier',
    ])
    expect(current).toHaveBeenCalledTimes(4)
    expect(actual.combatants.map((actor) => actor.disciplineSkills[0]!.contentVersion)).toEqual([
      7, 7,
    ])
  })
  it.each(['missing', 'disabled', 'wrong-source'] as const)(
    'rejects %s bulk content rather than falling back to a different definition',
    async (invalid) => {
      const bulk = vi.fn(async (ids: readonly string[]) => {
        const definitions = new Map(ids.map((id) => [id, currentStaticSkill(id)!]))
        const id = 'vanguard.forceful-strike'
        if (invalid === 'missing') definitions.delete(id)
        else
          definitions.set(id, {
            ...definitions.get(id)!,
            ...(invalid === 'disabled' ? { enabled: false } : { sourceDisciplineId: 'lifebinder' }),
          })
        return definitions
      })
      const single = vi.fn(async (id: string) => currentStaticSkill(id))
      await expect(
        createResolvedBattleBuildAuthoritySnapshot('pvp', inputs(), {
          resolveCurrentSkillDefinition: single,
          resolveCurrentSkillDefinitions: bulk,
          resolvePinnedSkillDefinition: async (id, version) =>
            resolveMatureSkillVersion(id, version),
        }),
      ).rejects.toThrow(
        invalid === 'wrong-source' ? /source Discipline/u : /enabled current combat definition/u,
      )
      expect(single).not.toHaveBeenCalled()
    },
  )
})

it('reduces actual content-source reads from eight serial round trips to one without changing authority', async () => {
  vi.useFakeTimers()
  try {
    const read = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      return []
    })
    const resolver = createCombatContentResolver({
      findCurrentSkill: async () => null,
      findCurrentSkills: read,
      findSkillVersion: async () => null,
    })
    const inputs = ['actor', 'target'].map((characterId) => ({
      characterId,
      combatantId: `character:${characterId}`,
      snapshot: productionShapeMixedSnapshot(),
    }))
    const legacy: CombatContentResolver = {
      resolveCurrentSkillDefinition: resolver.resolveCurrentSkillDefinition,
      resolvePinnedSkillDefinition: resolver.resolvePinnedSkillDefinition,
    }
    const baselineAt = Date.now()
    const baseline = createResolvedBattleBuildAuthoritySnapshot('pvp', inputs, legacy)
    await vi.runAllTimersAsync()
    const expected = await baseline
    expect(Date.now() - baselineAt).toBe(800)
    expect(read).toHaveBeenCalledTimes(8)
    read.mockClear()
    const bulkAt = Date.now()
    const bulk = createResolvedBattleBuildAuthoritySnapshot('pvp', inputs, resolver)
    await vi.runAllTimersAsync()
    expect(await bulk).toEqual(expected)
    expect(Date.now() - bulkAt).toBe(100)
    expect(read).toHaveBeenCalledExactlyOnceWith([
      'vanguard.forceful-strike',
      'vanguard.rally',
      'vanguard.brace',
      'lifebinder.barrier',
    ])
  } finally {
    vi.useRealTimers()
  }
})
