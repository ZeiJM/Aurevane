import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import { describe, expect, it, vi } from 'vitest'

import {
  changeCharacterDisciplines,
  changeCharacterPrimaryDiscipline,
  loadCharacterBuildContext,
  loadCharacterCommittedBuildSnapshot,
  previewCharacterDisciplines,
  previewCharacterPrimaryDiscipline,
  saveCharacterDisciplineSkills,
  type CharacterActiveBuildRecord,
  type CharacterBuildRepository,
  type CharacterEquippedDisciplineSkillRecord,
  type CharacterLearnedSkillRecord,
  type DisciplineCatalogEntry,
} from './character-build-service'

vi.mock('server-only', () => ({}))

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
  id: 'vanguard' | 'aetherist' | 'lifebinder',
  offsets: Record<string, number>,
  masteredAt: string | null = null,
): DisciplineCatalogEntry {
  const names = {
    vanguard: 'Vanguard',
    aetherist: 'Aetherist',
    lifebinder: 'Lifebinder',
  } as const
  return {
    definition: {
      id,
      definitionVersion: 1,
      name: names[id],
      summary: `${id} summary`,
      enabledForPrimary: true,
      enabledForSecondary: true,
    },
    profile: { disciplineId: id, profileVersion: 1, statOffsets: offsets },
    masteredAt,
  }
}

const vanguard = entry('vanguard', { maxHp: 20, armor: 5 })
const aetherist = entry(
  'aetherist',
  { maxMp: 20, mysticPower: 5, maxHp: -8 },
  '2026-09-02T00:00:00.000Z',
)
const lifebinder = entry('lifebinder', { maxHp: 8, maxMp: 15, ward: 4 }, '2026-09-02T01:00:00.000Z')

const learnedVanguard: CharacterLearnedSkillRecord = {
  skillId: 'vanguard.forceful-strike',
  contentVersion: 2,
  sourceDisciplineId: 'vanguard',
  learnedAt: '2026-09-02T02:00:00.000Z',
}
const learnedLifebinder: CharacterLearnedSkillRecord = {
  skillId: 'lifebinder.mending-light',
  contentVersion: 1,
  sourceDisciplineId: 'lifebinder',
  learnedAt: '2026-09-02T03:00:00.000Z',
}

function equippedVanguard(slotIndex = 1): CharacterEquippedDisciplineSkillRecord {
  return {
    slotIndex,
    skillId: learnedVanguard.skillId,
    contentVersion: learnedVanguard.contentVersion,
    sourceDisciplineId: learnedVanguard.sourceDisciplineId,
    equippedAt: '2026-09-03T00:00:00.000Z',
  }
}

function build(
  source = vanguard,
  buildVersion = 1,
  secondary: DisciplineCatalogEntry | null = null,
  locks: { primary?: string | null; secondary?: string | null } = {},
): CharacterActiveBuildRecord {
  return {
    characterId: character().id,
    schemaVersion: 4,
    buildVersion,
    primaryDefinition: source.definition,
    primaryProfile: source.profile,
    secondaryDefinition: secondary?.definition ?? null,
    primaryAttunementLockedUntil: locks.primary ?? null,
    secondaryAttunementLockedUntil: locks.secondary ?? null,
    attunementPolicy: {
      version: 1,
      primaryCooldownSeconds: 14_400,
      secondaryCooldownSeconds: 14_400,
    },
    serverNow: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  }
}

function repository(overrides: Partial<CharacterBuildRepository> = {}): CharacterBuildRepository {
  return {
    findActiveBuild: vi.fn(async () => build()),
    listDisciplines: vi.fn(async () => [vanguard, aetherist, lifebinder]),
    listLearnedSkills: vi.fn(async () => [learnedVanguard, learnedLifebinder]),
    listEquippedDisciplineSkills: vi.fn(async () => []),
    loadCommittedBuildSnapshot: vi.fn(async () => ({
      schemaVersion: 4,
      buildVersion: 1,
      primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
      secondary: null,
      disciplineSkills: [],
      extensions: {
        resonance: null,
        essence: null,
        equipmentSkills: [],
        supernatural: null,
        prestige: null,
      },
    })),
    changeDisciplines: vi.fn(async () => ({
      build: build(aetherist, 2),
      replayed: false,
    })),
    saveDisciplineSkills: vi.fn(async () => ({ buildVersion: 2, replayed: false })),
    ...overrides,
  }
}

describe('character build service', () => {
  it('computes the committed Primary and exposes learned Skills without changing assigned attributes', async () => {
    const source = character()
    const before = structuredClone(source.attributes)
    const context = await loadCharacterBuildContext(userId, source, repository())

    expect(context.current.definition.id).toBe('vanguard')
    expect(context.current.derived.stats.maxHp.contributions.at(-1)).toMatchObject({
      sourceId: 'discipline.primary.vanguard.profile.1',
      inputValue: 20,
    })
    expect(context.currentSecondary).toBeNull()
    expect(context.availableSecondaries.map((candidate) => candidate.definition.id)).toEqual([
      'aetherist',
      'lifebinder',
    ])
    expect(context.disciplineSkills.capacity).toBe(8)
    expect(context.disciplineSkills.learnedSkills).toEqual([
      expect.objectContaining({
        definition: expect.objectContaining({ id: learnedVanguard.skillId }),
        activeSource: true,
      }),
      expect.objectContaining({
        definition: expect.objectContaining({ id: learnedLifebinder.skillId }),
        activeSource: false,
      }),
    ])
    expect(source.attributes).toEqual(before)
  })

  it('resolves the current mixed-build Resonance from the authoritative Discipline pair', async () => {
    const context = await loadCharacterBuildContext(
      userId,
      character(),
      repository({ findActiveBuild: vi.fn(async () => build(vanguard, 4, lifebinder)) }),
    )

    expect(context.disciplineSkills.extensions.resonance).toMatchObject({
      id: 'resonance.lifebinder-vanguard.mercys-edge',
      contentVersion: 1,
      disciplinePair: ['lifebinder', 'vanguard'],
    })
  })

  it('previews a legal proposed Primary without writing it', async () => {
    const change = vi.fn(async () => ({ build: build(aetherist, 2), replayed: false }))
    const repo = repository({ changeDisciplines: change })
    const result = await previewCharacterPrimaryDiscipline(userId, character(), 'aetherist', repo)

    expect(result.current.definition.id).toBe('vanguard')
    expect(result.proposed.definition.id).toBe('aetherist')
    expect(result.proposed.derived.stats.maxMp.value).toBeGreaterThan(
      result.current.derived.stats.maxMp.value,
    )
    expect(change).not.toHaveBeenCalled()
  })

  it('previews a mastered Secondary without adding a second base-stat profile or starting a timer', async () => {
    const change = vi.fn(async () => ({
      build: build(vanguard, 2, aetherist),
      replayed: false,
    }))
    const repo = repository({ changeDisciplines: change })
    const result = await previewCharacterDisciplines(
      userId,
      character(),
      { secondaryDisciplineId: 'aetherist' },
      repo,
    )

    expect(result.proposed.definition.id).toBe('vanguard')
    expect(result.proposed.derived).toEqual(result.current.derived)
    expect(result.proposedSecondary?.id).toBe('aetherist')
    expect(result.changes).toEqual({ primary: false, secondary: true })
    expect(result.attunement.secondaryRemainingSeconds).toBe(0)
    expect(change).not.toHaveBeenCalled()
  })

  it('fails closed before persistence for an unmastered Secondary', async () => {
    const unmasteredAetherist = entry('aetherist', { maxMp: 20 }, null)
    const repo = repository({
      listDisciplines: vi.fn(async () => [vanguard, unmasteredAetherist]),
    })
    await expect(
      previewCharacterDisciplines(
        userId,
        character(),
        { secondaryDisciplineId: 'aetherist' },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('reports server-derived remaining attunement without consulting the browser clock', async () => {
    const context = await loadCharacterBuildContext(
      userId,
      character(),
      repository({
        findActiveBuild: vi.fn(async () =>
          build(vanguard, 3, aetherist, {
            primary: '2026-09-03T01:00:00.000Z',
            secondary: '2026-09-03T00:30:00.000Z',
          }),
        ),
      }),
    )

    expect(context.attunement.primaryRemainingSeconds).toBe(3600)
    expect(context.attunement.secondaryRemainingSeconds).toBe(1800)
  })

  it('commits a combined Discipline change as one versioned authoritative command', async () => {
    const source = character()
    const before = structuredClone(source.attributes)
    const captured: { value?: Parameters<CharacterBuildRepository['changeDisciplines']>[0] } = {}
    const nextBuild = build(aetherist, 2, lifebinder, {
      primary: '2026-09-03T04:00:00.000Z',
      secondary: '2026-09-03T04:00:00.000Z',
    })
    const find = vi.fn().mockResolvedValueOnce(build()).mockResolvedValue(nextBuild)
    const repo = repository({
      findActiveBuild: find,
      changeDisciplines: vi.fn(async (input) => {
        captured.value = input
        return { build: nextBuild, replayed: true }
      }),
    })

    const result = await changeCharacterDisciplines(
      userId,
      source,
      {
        expectedBuildVersion: 1,
        primaryDisciplineId: 'aetherist',
        secondaryDisciplineId: 'lifebinder',
        idempotencyKey: '00000000-0000-4000-8000-000000000803',
      },
      repo,
    )

    expect(result.replayed).toBe(true)
    expect(result.build.buildVersion).toBe(2)
    expect(result.currentSecondary?.id).toBe('lifebinder')
    expect(captured.value).toEqual(
      expect.objectContaining({
        userId,
        characterId: source.id,
        expectedBuildVersion: 1,
        changePrimary: true,
        primaryDisciplineId: 'aetherist',
        changeSecondary: true,
        secondaryDisciplineId: 'lifebinder',
      }),
    )
    expect(captured.value?.requestFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(source.attributes).toEqual(before)
  })

  it('preserves the Primary-only compatibility command through the generic authority path', async () => {
    const captured: { value?: Parameters<CharacterBuildRepository['changeDisciplines']>[0] } = {}
    const find = vi.fn().mockResolvedValueOnce(build()).mockResolvedValue(build(aetherist, 2))
    const repo = repository({
      findActiveBuild: find,
      changeDisciplines: vi.fn(async (input) => {
        captured.value = input
        return { build: build(aetherist, 2), replayed: false }
      }),
    })

    await changeCharacterPrimaryDiscipline(
      userId,
      character(),
      {
        expectedBuildVersion: 1,
        primaryDisciplineId: 'aetherist',
        idempotencyKey: '00000000-0000-4000-8000-000000000804',
      },
      repo,
    )

    expect(captured.value).toEqual(
      expect.objectContaining({
        changePrimary: true,
        changeSecondary: false,
        secondaryDisciplineId: null,
      }),
    )
  })

  it('normalizes a Skill save from learned server data and returns the committed loadout', async () => {
    const captured: { value?: Parameters<CharacterBuildRepository['saveDisciplineSkills']>[0] } = {}
    const find = vi.fn().mockResolvedValueOnce(build()).mockResolvedValue(build(vanguard, 2))
    const equipped = vi.fn().mockResolvedValueOnce([]).mockResolvedValue([equippedVanguard()])
    const repo = repository({
      findActiveBuild: find,
      listEquippedDisciplineSkills: equipped,
      saveDisciplineSkills: vi.fn(async (input) => {
        captured.value = input
        return { buildVersion: 2, replayed: false }
      }),
    })

    const result = await saveCharacterDisciplineSkills(
      userId,
      character(),
      {
        expectedBuildVersion: 1,
        skillIds: ['vanguard.forceful-strike'],
        idempotencyKey: '00000000-0000-4000-8000-000000000805',
      },
      repo,
    )

    expect(captured.value?.skills).toEqual([
      {
        skillId: 'vanguard.forceful-strike',
        contentVersion: 2,
        sourceDisciplineId: 'vanguard',
      },
    ])
    expect(captured.value?.requestFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(result.build.buildVersion).toBe(2)
    expect(result.disciplineSkills.equippedSkills[0]?.definition.id).toBe(
      'vanguard.forceful-strike',
    )
  })

  it('rejects a learned Skill from an inactive Discipline in a pure build', async () => {
    await expect(
      saveCharacterDisciplineSkills(
        userId,
        character(),
        {
          expectedBuildVersion: 1,
          skillIds: ['lifebinder.mending-light'],
          idempotencyKey: '00000000-0000-4000-8000-000000000806',
        },
        repository(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('loads a stable committed snapshot independently of Profile draft state', async () => {
    const snapshot = await loadCharacterCommittedBuildSnapshot(
      userId,
      character().id,
      repository({
        loadCommittedBuildSnapshot: vi.fn(async () => ({
          schemaVersion: 4,
          buildVersion: 7,
          primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
          secondary: { disciplineId: 'lifebinder', definitionVersion: 1 },
          disciplineSkills: [
            {
              slotIndex: 1,
              skillId: 'vanguard.forceful-strike',
              contentVersion: 2,
              sourceDisciplineId: 'vanguard',
            },
            {
              slotIndex: 2,
              skillId: 'lifebinder.mending-light',
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
        })),
      }),
    )

    expect(snapshot.buildVersion).toBe(7)
    expect(snapshot.disciplineSkills.map((skill) => skill.skillId)).toEqual([
      'vanguard.forceful-strike',
      'lifebinder.mending-light',
    ])
    expect(snapshot.extensions.resonance).toEqual({
      resonanceId: 'resonance.lifebinder-vanguard.mercys-edge',
      contentVersion: 1,
      disciplinePair: ['lifebinder', 'vanguard'],
    })
  })
})
