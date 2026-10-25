import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'
import { capturedBasicBattle } from './battle-basic-actions.test-utils'
import { BattleExperience } from './battle-experience'
import type { BattleRuntime } from './battle-runtime'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

it.each(['pve', 'pvp'] as const)(
  'omits the Modifiers footer button in %s even with owned modifiers',
  (kind) => {
    const { view } = capturedBasicBattle()
    const battle = {
      ...view,
      snapshot: {
        ...view.snapshot,
        manualModifierAvailability: [
          {
            ownerCombatantId: 'actor',
            sourceInstanceId: 'owned-modifier',
            behaviorId: 'extra',
            name: 'Extra',
            type: 'manual-modifier' as const,
            abilityId: 'owned',
            contentVersion: 1,
            costs: [],
            cooldown: null,
            ownerEligible: true,
            blockedReasons: [],
            requiresAction: true as const,
          },
        ],
      },
    }
    const runtime: BattleRuntime =
      kind === 'pve'
        ? {
            kind,
            playerName: 'Wayfarer',
            playerLevel: 1,
            playerPortraitAssetId: 'character.creation.square-portrait-01',
            playerProfileImageUrl: null,
          }
        : {
            kind,
            playerName: 'Wayfarer',
            metadata: {
              mode: '1v1',
              lobbyId: 'lobby',
              battleKey: 'key',
              localCharacterId: 'actor',
              participants: battle.snapshot.tactical.battle.combatants.map((unit, index) => ({
                combatantId: unit.id,
                characterId: unit.id,
                characterName: unit.id,
                teamIndex: index,
                seatIndex: 0,
                characterLevel: 1,
                portraitRef: STARTER_CHARACTER_PORTRAITS[0]!.ref,
                profileImageUrl: null,
              })),
            },
          }
    const before = JSON.stringify(battle)
    const html = renderToStaticMarkup(<BattleExperience initialBattle={battle} runtime={runtime} />)
    const footer = html.match(
      /<footer[^>]*data-unified-battle-footer="true"[\s\S]*?<\/footer>/,
    )?.[0]
    expect(footer).toBeTruthy()
    expect(footer).not.toContain('Modifiers')
    expect(footer).toContain('Terrain')
    expect(html).toContain('data-battle-turn-state="yours"')
    expect(html).toContain('data-battle-instruction-title="true">Your turn')
    expect(footer).toContain('Cancel Action')
    if (kind === 'pve') expect(footer).toContain('Surrender')
    expect(JSON.stringify(battle)).toBe(before)
  },
)
