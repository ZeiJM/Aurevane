import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import { createStatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { BattleSessionView } from '@/server/battle/battle-session-service'
import type { PvpBattleParticipantView } from '@/server/battle/pvp-lobby-service'
import { BattleExperience } from './battle-experience'
import type { BattleRuntime } from './battle-runtime'
import { PvpSpectatorExperience } from './pvp-spectator-experience'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => '/game/battle',
}))

function battleFixture(overlap: boolean, reverse: boolean): BattleSessionView {
  const ids = ['actor', 'corpse', 'opponent']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:defeated-tile',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id === 'actor' ? 'players' : 'opponents',
        initiative: 30 - index * 10,
        baseMovementBudget: 2,
        hp: id === 'corpse' ? 0 : 50,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
      })),
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 3,
    height: 1,
    terrains: [{ id: 'open-ground', traversalCost: 1 }],
    tiles: ids.map((_, x) => ({ position: { x, y: 0 }, elevation: 0, terrainId: 'open-ground' })),
    movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
    placements: ids.map((combatantId, index) => ({
      combatantId,
      position: { x: overlap && index === 2 ? 1 : index, y: 0 },
      facing: 'east' as const,
      movementProfileId: 'ground',
    })),
  })
  const snapshot = createStatDrivenCombatEncounterState(
    createCombatEncounterState(tactical),
    ids.map((combatantId) => ({
      combatantId,
      provenance: {
        kind: combatantId === 'actor' ? ('character-derived' as const) : ('scenario' as const),
        sourceId: combatantId === 'actor' ? 'character:actor' : `scenario:${combatantId}`,
        sourceRulesVersion: 1,
      },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 1,
    })),
  )
  if (reverse) snapshot.tactical.placements = [...snapshot.tactical.placements].reverse()
  return {
    battleSessionId: '33333333-3333-4333-8333-333333333333',
    battleVersion: 1,
    snapshot,
    replayed: false,
    invalidation: null,
  }
}

const participants: PvpBattleParticipantView[] = ['actor', 'corpse', 'opponent'].map(
  (combatantId, index) => ({
    combatantId,
    characterId: combatantId,
    characterName: ['Wayfarer', 'Fallen', 'Living'][index]!,
    characterLevel: 1,
    portraitRef: STARTER_CHARACTER_PORTRAITS[0]!.ref,
    profileImageUrl: null,
    teamIndex: index === 0 ? 0 : 1,
    seatIndex: index === 0 ? 0 : index - 1,
  }),
)

function renderBattle(mode: 'pve' | 'pvp' | 'spectator', overlap = false, reverse = false): string {
  const battle = battleFixture(overlap, reverse)
  if (mode === 'spectator')
    return renderToStaticMarkup(
      <PvpSpectatorExperience
        initialSpectator={{ battle, mode: '1v1', battleKey: 'test-battle', participants }}
        initialParticipantTitles={{}}
      />,
    )
  const runtime: BattleRuntime =
    mode === 'pve'
      ? {
          kind: 'pve',
          playerName: 'Wayfarer',
          playerLevel: 1,
          playerPortraitAssetId: 'character.creation.square-portrait-01',
          playerProfileImageUrl: null,
        }
      : {
          kind: 'pvp',
          playerName: 'Wayfarer',
          metadata: {
            mode: '1v1',
            battleKey: 'test-battle',
            lobbyId: 'test-lobby',
            localCharacterId: 'actor',
            participants,
          },
        }
  return renderToStaticMarkup(<BattleExperience initialBattle={battle} runtime={runtime} />)
}

function secondTile(markup: string): string {
  const tile = markup.match(/<button[^>]*aria-label="Tile 2, 1;[\s\S]*?<\/button>/)?.[0]
  expect(tile).toBeDefined()
  return tile!
}

describe('defeated battlefield tokens', () => {
  it.each(['pve', 'pvp', 'spectator'] as const)(
    'keeps the corpse icon and omits its facing arrow in %s',
    (mode) => {
      const tile = secondTile(renderBattle(mode))
      expect(tile).toContain('data-defeated="true"')
      expect(tile).toContain(mode === 'pve' ? 'Recruit 1' : 'Fallen')
      expect(tile).not.toContain('data-battle-facing-indicator')
      expect(tile).not.toContain('<i>→</i>')
      expect(tile).not.toContain('data-facing=')
    },
  )
  it.each(['pve', 'pvp', 'spectator'] as const)(
    'shows the living occupant and its facing when it shares a corpse tile in %s',
    (mode) => {
      for (const reverse of [false, true]) {
        const tile = secondTile(renderBattle(mode, true, reverse))
        expect(tile).toContain(mode === 'pve' ? 'Recruit 2' : 'Living')
        expect(tile).not.toContain('data-defeated="true"')
        expect(tile).toContain(
          mode === 'spectator' ? '<i>→</i>' : 'data-battle-facing-indicator="true"',
        )
      }
    },
  )
})
