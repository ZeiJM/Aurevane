import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { CharacterCommittedBuildSnapshotRecord } from '@/server/character/character-build-service'

vi.mock('server-only', () => ({}))

import {
  createBattleBuildAuthoritySnapshot,
  parseBattleBuildAuthoritySnapshot,
} from './battle-build-authority'

function historicalSnapshot(primary = 'ironfist', secondary: string | null = null) {
  const committed: CharacterCommittedBuildSnapshotRecord = {
    schemaVersion: 3,
    buildVersion: 1,
    primary: { disciplineId: primary, definitionVersion: 1, profileVersion: 1 },
    secondary: secondary ? { disciplineId: secondary, definitionVersion: 1 } : null,
    disciplineSkills: [],
    extensions: {
      resonance: null,
      essence: null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
  const canonical = {
    schemaVersion: 1,
    sourceBuildSchemaVersion: committed.schemaVersion,
    sourceBuildVersion: committed.buildVersion,
    primary: committed.primary,
    secondary: committed.secondary,
    disciplineSkills: committed.disciplineSkills,
    extensions: committed.extensions,
  }
  const characterId = '00000000-0000-4000-8000-000000004401'
  const authority = {
    schemaVersion: 1,
    combatContext: 'pve',
    combatants: [
      {
        combatantId: `character:${characterId}`,
        characterId,
        snapshotSchemaVersion: 1,
        buildSchemaVersion: committed.schemaVersion,
        buildVersion: committed.buildVersion,
        fingerprint: `sha256:${createHash('sha256').update(JSON.stringify(canonical)).digest('hex')}`,
        primary: committed.primary,
        secondary: committed.secondary,
        disciplineSkills: [],
        extensions: { resonance: null, essence: null },
      },
    ],
  }
  return { committed, authority, characterId }
}

describe('Phase 4 frozen battle catalog compatibility', () => {
  it.each([
    ['ironfist', null],
    ['ironfist', 'vanguard'],
    ['vanguard', 'ironfist'],
  ])('preserves the old %s / %s snapshot without granting new signatures', (primary, secondary) => {
    const { authority } = historicalSnapshot(primary!, secondary)
    for (const combatContext of ['pve', 'pvp']) {
      const persisted = { ...authority, combatContext }
      expect(parseBattleBuildAuthoritySnapshot(persisted)).toEqual(persisted)
      expect(parseBattleBuildAuthoritySnapshot({ ...persisted, catalogVersion: 2 })).toBeNull()
      const corrupt = structuredClone(persisted)
      corrupt.combatants[0]!.buildVersion += 1
      expect(parseBattleBuildAuthoritySnapshot(corrupt)).toBeNull()
    }
  })

  it('requires signatures for new Ironfist battles and for inherited Vanguard snapshots', () => {
    const { committed, characterId } = historicalSnapshot()
    expect(() =>
      createBattleBuildAuthoritySnapshot('pve', [
        {
          combatantId: `character:${characterId}`,
          characterId,
          snapshot: committed,
        },
      ]),
    ).toThrow('invalid battle build-authority snapshot')
    expect(parseBattleBuildAuthoritySnapshot(historicalSnapshot('vanguard').authority)).toBeNull()
  })
})
