import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'
import { spawnCombatSummon } from '@aurevane/game-core/combat/combat-summons'
import {
  createCurrentStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { VESPER_SUMMON_PROFILE } from '@aurevane/game-core/combat/universal-support'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { projectBattleSnapshot } from '@/server/battle/battle-session-service'
import { deriveParticipantBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'
import { capturedBasicBattle } from './battle-basic-actions.test-utils'
import { pvpParticipantAccent } from './battle-combatant-colors'
import { BattleExperience } from './battle-experience'
import {
  battlePresentationParticipantMap,
  buildBattleViewModel,
  type BattleRuntime,
} from './battle-runtime'
import { PvpSpectatorExperience } from './pvp-spectator-experience'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => '/game/battle',
}))

const owners = ['actor', 'ally', 'enemy', 'other']
function fixture() {
  const base = capturedBasicBattle()
  let state: StatDrivenCombatEncounterState = createCurrentStatDrivenCombatEncounterState(
    base.state,
    base.state.statBridge.combatants.map((profile) => ({
      ...profile,
      physicalPower: 20,
      mysticPower: 20,
      level: 1,
      criticalChance: 0,
    })),
  )
  owners.forEach((ownerCombatantId, x) => {
    state = spawnCombatSummon(state, {
      ownerCombatantId,
      sourceSkillId: 'basic.invocation',
      sourceSkillVersion: 1,
      profile: VESPER_SUMMON_PROFILE,
      position: { x, y: 3 },
      facing: 'east',
    }).state
  })
  return {
    ...base.view,
    snapshot: projectBattleSnapshot(
      state,
      deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['actor']),
    ),
  }
}

const participants = owners.map((combatantId, index) => ({
  combatantId,
  characterId: combatantId,
  characterName: index === 3 ? 'Vesper' : combatantId,
  characterLevel: 1,
  portraitRef: STARTER_CHARACTER_PORTRAITS[0]!.ref,
  profileImageUrl: null,
  teamIndex: index < 2 ? 0 : 1,
  seatIndex: index % 2,
}))
function runtime(mode: 'pve' | 'pvp'): BattleRuntime {
  return mode === 'pve'
    ? {
        kind: 'pve',
        playerName: 'actor',
        playerLevel: 1,
        playerPortraitAssetId: 'character.creation.square-portrait-01',
        playerProfileImageUrl: null,
      }
    : {
        kind: 'pvp',
        playerName: 'actor',
        metadata: {
          mode: '2v2',
          battleKey: 'summon-colors',
          lobbyId: 'test',
          localCharacterId: 'actor',
          participants,
        },
      }
}

describe('summoned-unit owner identity across shared battle renderers', () => {
  it.each(['pve', 'pvp', 'spectator'] as const)(
    'uses each owner’s exact ring and arrow accent in %s',
    (mode) => {
      const battle = fixture()
      const viewModel = buildBattleViewModel(battle, runtime(mode === 'pve' ? 'pve' : 'pvp'))
      const html =
        mode === 'spectator'
          ? renderToStaticMarkup(
              <PvpSpectatorExperience
                initialSpectator={{ battle, mode: '2v2', battleKey: 'summon-colors', participants }}
                initialParticipantTitles={{}}
              />,
            )
          : renderToStaticMarkup(
              <BattleExperience initialBattle={battle} runtime={runtime(mode)} />,
            )
      const accents = new Set<string>()
      owners.forEach((ownerId, x) => {
        const owner = viewModel.participantByCombatant.get(ownerId)!
        const accent = pvpParticipantAccent(owner.teamIndex, owner.seatIndex, viewModel.teamCount)
        accents.add(accent)
        const tile = html.match(
          new RegExp(`<button[^>]*aria-label="Tile ${x + 1}, 4;[\\s\\S]*?<\\/button>`),
        )?.[0]
        expect(tile).toBeDefined()
        // One explicit accent belongs to the arrow, the other to the circular portrait border.
        expect(tile!.match(new RegExp(`--battle-combatant-accent:${accent}`, 'g'))).toHaveLength(2)
        expect(tile).toContain('data-battle-facing-indicator="true"')
        expect(tile).toContain('occupied by Vesper')
      })
      expect(accents.size).toBe(4)
    },
  )

  it('does not invent an identity when a summon’s owner is unavailable to the viewer', () => {
    const battle = fixture()
    const map = battlePresentationParticipantMap(battle, [])
    for (const summon of battle.snapshot.effectState!.summons!)
      expect(map.has(summon.combatantId)).toBe(false)
  })
})
