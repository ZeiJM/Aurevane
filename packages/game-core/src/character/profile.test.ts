import { describe, expect, it } from 'vitest'

import type { LevelProgressionCurve } from './progression'
import type { PersistedCharacter } from './persistence'
import { buildCharacterProfileReadModel } from './profile'

const levelCurve: LevelProgressionCurve = {
  version: 1,
  maxLevel: 100,
  cumulativeXpByLevel: Array.from({ length: 100 }, (_, index) => index * 100),
}

const character: PersistedCharacter = {
  id: '00000000-0000-4000-8000-000000000901',
  userId: '00000000-0000-4000-8000-000000000902',
  slotIndex: 0,
  rulesVersion: 1,
  name: 'Arlen Vale',
  nameKey: 'arlenvale',
  presentationId: 'androgynous',
  pronounPresetId: 'they_them',
  portraitRef: 'portrait.starter.wayfarer-01',
  starterAppearanceRef: 'appearance.starter.roadworn',
  foundationDisciplineId: 'vanguard',
  attributes: { might: 6, finesse: 6, intellect: 6, resolve: 6 },
  level: 1,
  xp: 0,
  progressionCycle: { number: 1 },
  createdAt: '2026-08-16T15:30:00.000Z',
  cycleStartedAt: '2026-08-16T15:30:00.000Z',
  lastActiveAt: '2026-08-16T15:30:00.000Z',
}

describe('character profile read model', () => {
  it('projects character-facing identity without account linkage or normalized name internals', () => {
    const profile = buildCharacterProfileReadModel(character, levelCurve)
    const serialized = JSON.stringify(profile)

    expect(profile.identity).toMatchObject({
      name: 'Arlen Vale',
      presentationLabel: 'Androgynous',
      pronounLabel: 'They / Them',
    })
    expect(profile.foundationDiscipline.name).toBe('Vanguard')
    expect(serialized).not.toContain(character.userId)
    expect(serialized).not.toContain(character.nameKey)
    expect(profile).not.toHaveProperty('userId')
    expect(profile).not.toHaveProperty('nameKey')
  })

  it('calculates derived stats and Level progress from authoritative state plus curve config', () => {
    const profile = buildCharacterProfileReadModel(character, levelCurve)

    expect(profile.derived.rulesVersion).toBe(1)
    expect(profile.derived.stats.maxHp.value).toBe(164)
    expect(profile.derived.stats.accuracy.value).toBe(7400)
    expect(profile.derived.stats.movement.value).toBe(4)
    expect(profile.progression.progress).toMatchObject({
      curveVersion: 1,
      level: 1,
      totalXp: 0,
      nextLevelThreshold: 100,
      xpIntoLevel: 0,
      xpRequiredForNextLevel: 100,
      progressBasisPoints: 0,
      isMaxLevel: false,
    })
  })

  it('rejects persisted Level drift from the authoritative cumulative XP curve', () => {
    expect(() =>
      buildCharacterProfileReadModel({ ...character, level: 2, xp: 0 }, levelCurve),
    ).toThrow('Persisted character Level does not match authoritative cumulative XP.')
  })
})
