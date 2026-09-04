import { createHash } from 'node:crypto'

import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import { describe, expect, it, vi } from 'vitest'

import {
  activateCharacterSavedBuildLoadout,
  listCharacterSavedBuildLoadouts,
  saveCurrentCharacterBuildLoadout,
  type CharacterSavedBuildLoadoutRepository,
} from './character-saved-build-loadout-service'

vi.mock('server-only', () => ({}))

const userId = '00000000-0000-4000-8000-000000000901'
const characterId = '00000000-0000-4000-8000-000000000902'
const idempotencyKey = '00000000-0000-4000-8000-000000000903'

function character(): PersistedCharacter {
  return {
    id: characterId,
    userId,
    slotIndex: 0,
    rulesVersion: 1,
    name: 'Loadout Tester',
    nameKey: 'loadouttester',
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

function repository(overrides: Partial<CharacterSavedBuildLoadoutRepository> = {}) {
  const base: CharacterSavedBuildLoadoutRepository = {
    list: vi.fn(async () => [
      {
        slotIndex: 1,
        name: 'Solo Vanguard',
        primaryDisciplineId: 'vanguard',
        secondaryDisciplineId: null,
        disciplineSkills: [],
        sourceBuildVersion: 4,
        savedAt: '2026-09-04T00:00:00.000Z',
        updatedAt: '2026-09-04T00:00:00.000Z',
      },
    ]),
    save: vi.fn(async (input) => ({
      slotIndex: input.slotIndex,
      name: input.name,
      sourceBuildVersion: input.expectedBuildVersion,
      savedAt: '2026-09-04T00:00:00.000Z',
      replayed: false,
    })),
    activate: vi.fn(async (input) => ({
      buildVersion: input.expectedBuildVersion + 2,
      replayed: false,
      activatedAt: '2026-09-04T00:01:00.000Z',
    })),
  }
  return { ...base, ...overrides }
}

function sha(value: Record<string, unknown>) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

describe('character saved build loadout service', () => {
  it('lists only repository-owned saved build snapshots', async () => {
    const repo = repository()
    const result = await listCharacterSavedBuildLoadouts(userId, characterId, repo)

    expect(repo.list).toHaveBeenCalledWith(userId, characterId)
    expect(result).toEqual([
      expect.objectContaining({ slotIndex: 1, primaryDisciplineId: 'vanguard' }),
    ])
  })

  it('saves the current authoritative build intent with a canonical request fingerprint', async () => {
    const repo = repository()
    const result = await saveCurrentCharacterBuildLoadout(
      userId,
      character(),
      {
        slotIndex: 3,
        name: '  Mixed sustain  ',
        expectedBuildVersion: 7,
        idempotencyKey,
      },
      repo,
    )

    expect(repo.save).toHaveBeenCalledWith({
      userId,
      characterId,
      slotIndex: 3,
      name: 'Mixed sustain',
      expectedBuildVersion: 7,
      idempotencyKey,
      requestFingerprint: sha({
        command: 'character.saved-build-loadout.save.v1',
        characterId,
        slotIndex: 3,
        name: 'Mixed sustain',
        expectedBuildVersion: 7,
      }),
    })
    expect(result).toMatchObject({ slotIndex: 3, name: 'Mixed sustain', replayed: false })
  })

  it('activates by stored slot only and fingerprints the versioned command', async () => {
    const repo = repository()
    const result = await activateCharacterSavedBuildLoadout(
      userId,
      character(),
      { slotIndex: 2, expectedBuildVersion: 9, idempotencyKey },
      repo,
    )

    expect(repo.activate).toHaveBeenCalledWith({
      userId,
      characterId,
      slotIndex: 2,
      expectedBuildVersion: 9,
      idempotencyKey,
      requestFingerprint: sha({
        command: 'character.saved-build-loadout.activate.v1',
        characterId,
        slotIndex: 2,
        expectedBuildVersion: 9,
      }),
    })
    expect(result).toMatchObject({ buildVersion: 11, replayed: false })
  })

  it('rejects malformed slots, names, versions, and request keys before persistence', async () => {
    const repo = repository()

    await expect(
      saveCurrentCharacterBuildLoadout(
        userId,
        character(),
        { slotIndex: 0, name: 'bad', expectedBuildVersion: 1, idempotencyKey },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    await expect(
      saveCurrentCharacterBuildLoadout(
        userId,
        character(),
        { slotIndex: 1, name: ' '.repeat(4), expectedBuildVersion: 1, idempotencyKey },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    await expect(
      activateCharacterSavedBuildLoadout(
        userId,
        character(),
        { slotIndex: 1, expectedBuildVersion: 0, idempotencyKey },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    await expect(
      activateCharacterSavedBuildLoadout(
        userId,
        character(),
        { slotIndex: 1, expectedBuildVersion: 1, idempotencyKey: 'not-a-uuid' },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })

    expect(repo.save).not.toHaveBeenCalled()
    expect(repo.activate).not.toHaveBeenCalled()
  })
})
