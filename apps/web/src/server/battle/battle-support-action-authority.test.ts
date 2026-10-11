import { describe, expect, it, vi } from 'vitest'
import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
} from '@aurevane/game-core/combat/essence'
import type { CharacterCommittedBuildSnapshotRecord } from '@/server/character/character-build-service'
import {
  createBattleBuildAuthoritySnapshot,
  parseBattleBuildAuthoritySnapshot,
} from './battle-build-authority'

vi.mock('server-only', () => ({}))

const characterId = '00000000-0000-4000-8000-000000000801'
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

describe('battle Support Action authority', () => {
  it.each(['basic.guard', 'basic.recover', 'basic.recover.mp'] as const)(
    'freezes %s for AI and PvP independently of future build edits',
    (supportActionId) => {
      for (const mode of ['pve', 'pvp'] as const) {
        const snapshot = { ...committed(), supportActionId }
        const authority = createBattleBuildAuthoritySnapshot(mode, [
          { characterId, combatantId: `character:${characterId}`, snapshot },
        ])
        const persisted = JSON.parse(JSON.stringify(authority))
        snapshot.supportActionId = 'basic.guard'
        expect(parseBattleBuildAuthoritySnapshot(persisted)?.combatants[0]?.supportActionId).toBe(
          supportActionId,
        )
        persisted.combatants[0].supportActionId =
          supportActionId === 'basic.guard' ? 'basic.recover' : 'basic.guard'
        expect(parseBattleBuildAuthoritySnapshot(persisted)).toBeNull()
      }
    },
  )
  it('does not inject Guard into legacy snapshots or accept an explicit arbitrary action', () => {
    const legacy = createBattleBuildAuthoritySnapshot('pve', [
      { characterId, combatantId: `character:${characterId}`, snapshot: committed() },
    ])
    expect(parseBattleBuildAuthoritySnapshot(legacy)).toEqual(legacy)
    expect(Object.hasOwn(legacy.combatants[0]!, 'supportActionId')).toBe(false)
    expect(
      parseBattleBuildAuthoritySnapshot({
        ...legacy,
        combatants: [{ ...legacy.combatants[0], supportActionId: 'basic.attack' }],
      }),
    ).toBeNull()
  })
})
