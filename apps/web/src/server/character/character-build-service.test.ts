import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import { describe, expect, it, vi } from 'vitest'

import {
  changeCharacterPrimaryDiscipline,
  loadCharacterBuildContext,
  previewCharacterPrimaryDiscipline,
  type CharacterActiveBuildRecord,
  type CharacterBuildRepository,
  type PrimaryDisciplineCatalogEntry,
} from './character-build-service'

const userId = '00000000-0000-4000-8000-000000000801'

function character(): PersistedCharacter {
  return {
    id: '00000000-0000-4000-8000-000000000802',
    userId,
    slotIndex: 0,
    rulesVersion: 1,
    name: 'P3 Tester',
    nameKey: 'p3tester',
    presentationId: 'androgynous',
    pronounPresetId: 'they_them',
    portraitRef: 'portrait.starter.wayfarer-01',
    starterAppearanceRef: 'appearance.starter.roadworn',
    foundationDisciplineId: 'vanguard',
    attributes: {
      might: 7,
      finesse: 6,
      vitality: 5,
      agility: 6,
      intellect: 5,
      resolve: 7,
    },
    level: 12,
    xp: 100,
    progressionCycle: { number: 1 },
    createdAt: '2026-09-01T00:00:00.000Z',
    cycleStartedAt: '2026-09-01T00:00:00.000Z',
    lastActiveAt: '2026-09-01T00:00:00.000Z',
  }
}

function entry(
  id: 'vanguard' | 'aetherist',
  offsets: Record<string, number>,
): PrimaryDisciplineCatalogEntry {
  return {
    definition: {
      id,
      definitionVersion: 1,
      name: id === 'vanguard' ? 'Vanguard' : 'Aetherist',
      summary: `${id} summary`,
      enabledForPrimary: true,
    },
    profile: { disciplineId: id, profileVersion: 1, statOffsets: offsets },
  }
}

const vanguard = entry('vanguard', { maxHp: 20, armor: 5 })
const aetherist = entry('aetherist', { maxMp: 20, mysticPower: 5, maxHp: -8 })

function build(source = vanguard, buildVersion = 1): CharacterActiveBuildRecord {
  return {
    characterId: character().id,
    schemaVersion: 1,
    buildVersion,
    primaryDefinition: source.definition,
    primaryProfile: source.profile,
    updatedAt: '2026-09-02T00:00:00.000Z',
  }
}

function repository(overrides: Partial<CharacterBuildRepository> = {}): CharacterBuildRepository {
  return {
    findActiveBuild: vi.fn(async () => build()),
    listPrimaryDisciplines: vi.fn(async () => [vanguard, aetherist]),
    changePrimaryDiscipline: vi.fn(async () => ({ build: build(aetherist, 2), replayed: false })),
    ...overrides,
  }
}

describe('character build service', () => {
  it('computes the committed Primary from the pinned profile while preserving assigned attributes', async () => {
    const source = character()
    const before = structuredClone(source.attributes)
    const context = await loadCharacterBuildContext(userId, source, repository())

    expect(context.current.definition.id).toBe('vanguard')
    expect(context.current.derived.stats.maxHp.contributions.at(-1)).toMatchObject({
      sourceId: 'discipline.primary.vanguard.profile.1',
      inputValue: 20,
    })
    expect(source.attributes).toEqual(before)
  })

  it('previews a legal proposed Primary without writing it', async () => {
    const change = vi.fn(async () => ({ build: build(aetherist, 2), replayed: false }))
    const repo = repository({ changePrimaryDiscipline: change })
    const result = await previewCharacterPrimaryDiscipline(userId, character(), 'aetherist', repo)

    expect(result.current.definition.id).toBe('vanguard')
    expect(result.proposed.definition.id).toBe('aetherist')
    expect(result.proposed.derived.stats.maxMp.value).toBeGreaterThan(
      result.current.derived.stats.maxMp.value,
    )
    expect(change).not.toHaveBeenCalled()
  })

  it('fails closed before persistence for an unknown Primary', async () => {
    const repo = repository()
    await expect(
      previewCharacterPrimaryDiscipline(userId, character(), 'forged-discipline', repo),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('commits only the target identity/version command and preserves replay information', async () => {
    const source = character()
    const before = structuredClone(source.attributes)
    let captured: Parameters<CharacterBuildRepository['changePrimaryDiscipline']>[0] | null = null
    const repo = repository({
      changePrimaryDiscipline: vi.fn(async (input) => {
        captured = input
        return { build: build(aetherist, 2), replayed: true }
      }),
    })

    const result = await changeCharacterPrimaryDiscipline(
      userId,
      source,
      {
        expectedBuildVersion: 1,
        primaryDisciplineId: 'aetherist',
        idempotencyKey: '00000000-0000-4000-8000-000000000803',
      },
      repo,
    )

    expect(result.replayed).toBe(true)
    expect(result.build.buildVersion).toBe(2)
    expect(captured).toEqual(
      expect.objectContaining({
        userId,
        characterId: source.id,
        expectedBuildVersion: 1,
        primaryDisciplineId: 'aetherist',
      }),
    )
    expect(captured?.requestFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(source.attributes).toEqual(before)
  })
})
