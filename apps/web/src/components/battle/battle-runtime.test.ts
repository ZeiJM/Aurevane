import { describe, expect, it } from 'vitest'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

import { buildBattleViewModel, type BattleRuntime } from './battle-runtime'

function runtime(): Extract<BattleRuntime, { kind: 'pve' }> {
  return {
    kind: 'pve',
    playerName: 'Wayfarer',
    playerLevel: 12,
    playerPortraitAssetId: 'portrait.starter.wayfarer-01',
    playerProfileImageUrl: null,
  } as unknown as Extract<BattleRuntime, { kind: 'pve' }>
}

function battleWithSummon(): BattleSessionView {
  return {
    battleSessionId: '00000000-0000-4000-8000-000000000759',
    battleVersion: 4,
    replayed: false,
    snapshot: {
      tactical: {
        battle: {
          combatants: [
            { id: 'player', teamId: 'players' },
            { id: 'enemy', teamId: 'opponents' },
            { id: 'summon:verdant', teamId: 'players' },
          ],
        },
      },
      statBridge: {
        combatants: [
          {
            combatantId: 'player',
            provenance: {
              kind: 'character-derived',
              sourceId: 'character:00000000-0000-4000-8000-000000000001',
              sourceRulesVersion: 4,
            },
          },
          {
            combatantId: 'enemy',
            provenance: {
              kind: 'scenario',
              sourceId: 'scenario:recruit',
              sourceRulesVersion: 4,
            },
          },
          {
            combatantId: 'summon:verdant',
            provenance: {
              kind: 'scenario',
              sourceId: 'summon.wildwarden.verdant-stalker',
              sourceRulesVersion: 4,
            },
          },
        ],
      },
      effectState: {
        summons: [
          {
            combatantId: 'summon:verdant',
            ownerCombatantId: 'player',
            sourceSkillId: 'wildwarden.renewing-herbs',
            sourceSkillVersion: 5,
            spawnedRound: 2,
            turnsCompleted: 0,
            profile: {
              name: 'Verdant Stalker',
            },
          },
        ],
      },
    },
  } as unknown as BattleSessionView
}

describe('battle runtime summon presentation', () => {
  it('adds a live summon to the current battlefield model on its actual team', () => {
    const view = buildBattleViewModel(battleWithSummon(), runtime())

    expect(view.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          combatantId: 'player',
          name: 'Wayfarer',
          teamIndex: 0,
          local: true,
          kind: 'character',
        }),
        expect.objectContaining({
          combatantId: 'enemy',
          name: 'Recruit',
          teamIndex: 1,
          kind: 'scenario',
        }),
        expect.objectContaining({
          combatantId: 'summon:verdant',
          name: 'Verdant Stalker',
          teamIndex: 0,
          local: false,
          kind: 'summon',
        }),
      ]),
    )
    expect(view.participantByCombatant.get('summon:verdant')?.name).toBe('Verdant Stalker')
  })

  it('does not rename the real opponent just because a summon also uses scenario stat provenance', () => {
    const view = buildBattleViewModel(battleWithSummon(), runtime())
    const opponent = view.participants.find((participant) => participant.kind === 'scenario')

    expect(opponent?.name).toBe('Recruit')
    expect(opponent?.teamIndex).toBe(1)
  })
})
