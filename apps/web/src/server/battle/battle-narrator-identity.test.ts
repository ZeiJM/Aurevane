import { describe, expect, it, vi } from 'vitest'
import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
} from '@aurevane/game-core/combat/essence'
import type { CharacterCommittedBuildSnapshotRecord } from '@/server/character/character-build-service'
import {
  createBattleBuildAuthoritySnapshot,
  parseBattleBuildAuthoritySnapshot,
  narratorIdentityForCharacter,
} from './battle-build-authority'

vi.mock('server-only', () => ({}))

function committed(): CharacterCommittedBuildSnapshotRecord {
  return {
    schemaVersion: 4,
    buildVersion: 2,
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
    secondary: null,
    disciplineSkills: [],
    extensions: {
      resonance: null,
      essence: essenceSnapshotReference(resolveEssenceForBuild('vanguard', null)!),
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

describe('immutable battle narrator identity', () => {
  it('pins explicit names and pronouns without altering build fingerprints or inferring gender', () => {
    const identity = narratorIdentityForCharacter({ name: 'Asha', pronounPresetId: 'she_her' })
    const input = { characterId: 'actor', combatantId: 'character:actor', snapshot: committed() }
    const legacy = createBattleBuildAuthoritySnapshot('pve', [input])
    const pinned = createBattleBuildAuthoritySnapshot('pve', [
      { ...input, narratorIdentity: identity },
    ])
    identity.name = 'Renamed'
    identity.pronounPresetId = 'he_him'
    expect(pinned.combatants[0]?.narratorIdentity).toEqual({
      name: 'Asha',
      pronounPresetId: 'she_her',
    })
    expect(pinned.combatants[0]?.fingerprint).toBe(legacy.combatants[0]?.fingerprint)
    expect(
      parseBattleBuildAuthoritySnapshot(JSON.parse(JSON.stringify(pinned)))?.combatants[0]
        ?.narratorIdentity,
    ).toEqual({ name: 'Asha', pronounPresetId: 'she_her' })
    expect(legacy.combatants[0]?.narratorIdentity).toBeUndefined()
  })

  it('uses neutral missing pronouns and rejects malformed optional identity snapshots', () => {
    expect(narratorIdentityForCharacter({ name: 'Asha', pronounPresetId: 'unknown' })).toEqual({
      name: 'Asha',
    })
    const authority = createBattleBuildAuthoritySnapshot('pvp', [
      { characterId: 'actor', combatantId: 'character:actor', snapshot: committed() },
    ])
    for (const narratorIdentity of [
      { name: 'Asha', pronounPresetId: 'unknown' },
      { name: 'Asha', gender: 'feminine' },
      { name: '<script>' },
      { name: 'Asha\nBryn' },
    ]) {
      expect(
        parseBattleBuildAuthoritySnapshot({
          ...authority,
          combatants: [{ ...authority.combatants[0], narratorIdentity }],
        }),
      ).toBeNull()
    }
  })
})
