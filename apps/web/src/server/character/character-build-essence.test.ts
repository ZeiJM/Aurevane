import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import { describe, expect, it, vi } from 'vitest'

import {
  loadCharacterBuildContext,
  loadCharacterCommittedBuildSnapshot,
  type CharacterActiveBuildRecord,
  type CharacterBuildRepository,
  type DisciplineCatalogEntry,
} from './character-build-service'

vi.mock('server-only', () => ({}))

const userId = '00000000-0000-4000-8000-000000003601'
const characterId = '00000000-0000-4000-8000-000000003602'

function character(): PersistedCharacter {
  return {
    id: characterId,
    userId,
    slotIndex: 0,
    rulesVersion: 1,
    name: 'Essence Tester',
    nameKey: 'essencetester',
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
    createdAt: '2026-09-03T00:00:00.000Z',
    cycleStartedAt: '2026-09-03T00:00:00.000Z',
    lastActiveAt: '2026-09-03T00:00:00.000Z',
  }
}

function catalogEntry(
  id: 'vanguard' | 'lifebinder',
  masteredAt: string | null,
): DisciplineCatalogEntry {
  return {
    definition: {
      id,
      definitionVersion: 1,
      name: id === 'vanguard' ? 'Vanguard' : 'Lifebinder',
      summary: `${id} summary`,
      enabledForPrimary: true,
      enabledForSecondary: true,
    },
    profile: {
      disciplineId: id,
      profileVersion: 1,
      statOffsets: id === 'vanguard' ? { maxHp: 20, armor: 5 } : { maxHp: 8, ward: 4 },
    },
    masteredAt,
  }
}

const vanguard = catalogEntry('vanguard', null)
const lifebinder = catalogEntry('lifebinder', '2026-09-03T00:00:00.000Z')

function activeBuild(secondary: DisciplineCatalogEntry | null = null): CharacterActiveBuildRecord {
  return {
    characterId,
    schemaVersion: 2,
    buildVersion: secondary ? 2 : 1,
    primaryDefinition: vanguard.definition,
    primaryProfile: vanguard.profile,
    secondaryDefinition: secondary?.definition ?? null,
    primaryAttunementLockedUntil: null,
    secondaryAttunementLockedUntil: null,
    attunementPolicy: {
      version: 1,
      primaryCooldownSeconds: 14_400,
      secondaryCooldownSeconds: 14_400,
    },
    serverNow: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
  }
}

function repository(overrides: Partial<CharacterBuildRepository> = {}): CharacterBuildRepository {
  return {
    findActiveBuild: vi.fn(async () => activeBuild()),
    listDisciplines: vi.fn(async () => [vanguard, lifebinder]),
    listLearnedSkills: vi.fn(async () => []),
    listEquippedDisciplineSkills: vi.fn(async () => []),
    loadCommittedBuildSnapshot: vi.fn(async () => ({
      schemaVersion: 2,
      buildVersion: 1,
      primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
      secondary: null,
      disciplineSkills: [],
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
    })),
    changeDisciplines: vi.fn(async () => ({ build: activeBuild(), replayed: false })),
    saveDisciplineSkills: vi.fn(async () => ({ buildVersion: 1, replayed: false })),
    ...overrides,
  }
}

describe('P3.6 character build Essence authority', () => {
  it('derives the representative Essence for a pure build outside Discipline Skill capacity', async () => {
    const context = await loadCharacterBuildContext(userId, character(), repository())

    expect(context.disciplineSkills.capacity).toBe(4)
    expect(context.disciplineSkills.equippedSkills).toEqual([])
    expect(context.disciplineSkills.extensions.resonance).toBeNull()
    expect(context.disciplineSkills.extensions.essence).toMatchObject({
      essenceId: 'essence.vanguard.unbroken-strike',
      contentVersion: 1,
      sourceDisciplineId: 'vanguard',
      skill: expect.objectContaining({
        id: 'essence.vanguard.unbroken-strike',
        apCost: 55,
        cooldown: { key: 'essence.vanguard.unbroken-strike', ownerTurns: 3 },
        ai: expect.objectContaining({ enabled: true }),
      }),
    })
  })

  it('removes Essence and resolves Resonance when a Secondary is active', async () => {
    const context = await loadCharacterBuildContext(
      userId,
      character(),
      repository({ findActiveBuild: vi.fn(async () => activeBuild(lifebinder)) }),
    )

    expect(context.disciplineSkills.capacity).toBe(4)
    expect(context.disciplineSkills.extensions.essence).toBeNull()
    expect(context.disciplineSkills.extensions.resonance).toMatchObject({
      id: 'resonance.lifebinder-vanguard.mercys-edge',
      contentVersion: 1,
    })
  })

  it('accepts the exact pure Essence reference from committed snapshot v2', async () => {
    const snapshot = await loadCharacterCommittedBuildSnapshot(userId, characterId, repository())

    expect(snapshot.extensions.resonance).toBeNull()
    expect(snapshot.extensions.essence).toEqual({
      essenceId: 'essence.vanguard.unbroken-strike',
      contentVersion: 1,
      sourceDisciplineId: 'vanguard',
      skillId: 'essence.vanguard.unbroken-strike',
      skillContentVersion: 1,
    })
  })

  it('fails closed when a pure snapshot fabricates a different Essence identity', async () => {
    const repo = repository({
      loadCommittedBuildSnapshot: vi.fn(async () => ({
        schemaVersion: 2,
        buildVersion: 1,
        primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
        secondary: null,
        disciplineSkills: [],
        extensions: {
          resonance: null,
          essence: {
            essenceId: 'essence.vanguard.fabricated',
            contentVersion: 1,
            sourceDisciplineId: 'vanguard',
            skillId: 'essence.vanguard.fabricated',
            skillContentVersion: 1,
          },
          equipmentSkills: [],
          supernatural: null,
          prestige: null,
        },
      })),
    })

    await expect(
      loadCharacterCommittedBuildSnapshot(userId, characterId, repo),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  })
})
