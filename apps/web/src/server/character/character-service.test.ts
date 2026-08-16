import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import { describe, expect, it, vi } from 'vitest'

import { createBaseCharacter, loadBaseCharacter } from './character-service'

const actor = { userId: '00000000-0000-4000-8000-000000000601' }

function intent() {
  return {
    name: '  Arlen   Vale ',
    presentationId: 'androgynous',
    pronounPresetId: 'they_them',
    portraitRef: 'portrait.starter.wayfarer-01',
    starterAppearanceRef: 'appearance.starter.roadworn',
    attributeBonuses: { might: 1, finesse: 1, intellect: 1, resolve: 1 },
    foundationDisciplineId: 'vanguard',
  }
}

function record(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: '00000000-0000-4000-8000-000000000602',
    userId: actor.userId,
    slotIndex: 0,
    rulesVersion: 1,
    name: 'Arlen Vale',
    nameKey: 'arlenvale',
    presentationId: 'androgynous',
    pronounPresetId: 'they_them',
    portraitRef: 'portrait.starter.wayfarer-01',
    starterAppearanceRef: 'appearance.starter.roadworn',
    foundationDisciplineId: 'vanguard',
    might: 6,
    finesse: 6,
    intellect: 6,
    resolve: 6,
    level: 1,
    xp: 0,
    progressionCycle: 1,
    createdAt: '2026-08-16T15:30:00.000Z',
    cycleStartedAt: '2026-08-16T15:30:00.000Z',
    lastActiveAt: '2026-08-16T15:30:00.000Z',
    ...overrides,
  }
}

function repository(overrides: Partial<CharacterRepository> = {}): CharacterRepository {
  return {
    findByOwnerSlot: vi.fn(async () => null),
    createBaseCharacter: vi.fn(async () => ({ result: record(), replayed: false })),
    ...overrides,
  }
}

describe('character service', () => {
  it('reconstructs canonical starting state before persistence', async () => {
    const create = vi.fn(async () => ({ result: record(), replayed: false }))
    const repo = repository({ createBaseCharacter: create })

    await createBaseCharacter(
      {
        actor,
        idempotencyKey: '00000000-0000-4000-8000-000000000603',
        intent: { ...intent(), level: 100, xp: 999999 } as ReturnType<typeof intent>,
      },
      repo,
    )

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: actor.userId,
        name: 'Arlen Vale',
        nameKey: 'arlenvale',
        might: 6,
        finesse: 6,
        intellect: 6,
        resolve: 6,
      }),
    )
    const persisted = create.mock.calls[0][0]
    expect(persisted).not.toHaveProperty('level')
    expect(persisted).not.toHaveProperty('xp')
    expect(persisted.requestFingerprint).toHaveLength(64)
  })

  it('rejects invented starter media references before repository execution', async () => {
    const create = vi.fn(async () => ({ result: record(), replayed: false }))
    const repo = repository({ createBaseCharacter: create })

    await expect(
      createBaseCharacter(
        {
          actor,
          idempotencyKey: '00000000-0000-4000-8000-000000000604',
          intent: { ...intent(), portraitRef: 'portrait.starter.forged' },
        },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(create).not.toHaveBeenCalled()
  })

  it('preserves repository replay information', async () => {
    const repo = repository({
      createBaseCharacter: vi.fn(async () => ({ result: record(), replayed: true })),
    })

    const outcome = await createBaseCharacter(
      {
        actor,
        idempotencyKey: '00000000-0000-4000-8000-000000000605',
        intent: intent(),
      },
      repo,
    )

    expect(outcome.replayed).toBe(true)
    expect(outcome.character.name).toBe('Arlen Vale')
  })

  it('loads only the authenticated owner base slot', async () => {
    const find = vi.fn(async () => record())
    const loaded = await loadBaseCharacter(actor, repository({ findByOwnerSlot: find }))

    expect(find).toHaveBeenCalledWith(actor.userId, 0)
    expect(loaded?.userId).toBe(actor.userId)
  })

  it('rejects a persistence result belonging to another owner', async () => {
    const repo = repository({
      findByOwnerSlot: vi.fn(async () =>
        record({ userId: '00000000-0000-4000-8000-000000000699' }),
      ),
    })

    await expect(loadBaseCharacter(actor, repo)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
