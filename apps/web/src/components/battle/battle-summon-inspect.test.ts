import type { BattleSessionView } from '@/server/battle/battle-session-service'
import { describe, expect, it } from 'vitest'

import { readSummonInspectMetadata } from './battle-summon-inspect'

describe('battle summon Inspect metadata', () => {
  it('projects the pinned summon profile and remaining authored lifetime', () => {
    const snapshot = {
      effectState: {
        summons: [
          {
            combatantId: 'summon:test',
            ownerCombatantId: 'character:owner',
            sourceSkillId: 'wildwarden.renewing-herbs',
            sourceSkillVersion: 6,
            spawnedRound: 2,
            turnsCompleted: 2,
            profile: {
              schemaVersion: 1,
              id: 'summon.wildwarden.verdant-stalker',
              name: 'Verdant Stalker',
              description: 'A temporary woodland hunter.',
              flavorLine: 'Roots twist into a watchful hunter.',
              portraitKey: 'summon.wildwarden.verdant-stalker.portrait',
              tags: ['summon', 'verdant'],
              maxHp: 36,
              maxMp: 12,
              initiative: 28,
              movementBudget: 5,
              stats: {
                accuracy: 6800,
                evasion: 1200,
                armor: 8,
                ward: 6,
                jump: 1,
                physicalPower: 24,
                mysticPower: 18,
              },
              aiProfile: 'standard',
              aiPurposeTags: ['damage'],
              lifetimeTurns: 5,
              abilities: [
                {
                  id: 'wildwarden.verdant-stalker.thorn-rake',
                  name: 'Thorn Rake',
                  description: 'Strike a nearby enemy.',
                  apCost: 45,
                  mpCost: 0,
                  tags: ['attack', 'melee'],
                  target: {
                    kind: 'unit',
                    teamPolicy: 'enemy',
                    shape: { kind: 'single' },
                    minimumRange: 1,
                    maximumRange: 2,
                    requiresLineOfSight: true,
                    maximumElevationDifference: 0,
                    friendlyFire: 'enemies-only',
                  },
                  requirements: [],
                  effects: [
                    {
                      type: 'damage',
                      recipient: 'primary-unit',
                      amount: 5,
                      durationTurns: 0,
                    },
                  ],
                  ai: { baseUtility: 70, purposeTags: ['damage'] },
                  media: { iconKey: null, audioCueKey: null, vfxKey: null },
                },
              ],
            },
          },
        ],
      },
    } as unknown as BattleSessionView['snapshot']

    expect(readSummonInspectMetadata(snapshot, 'summon:test')).toMatchObject({
      name: 'Verdant Stalker',
      ownerCombatantId: 'character:owner',
      sourceSkillId: 'wildwarden.renewing-herbs',
      sourceSkillVersion: 6,
      turnsCompleted: 2,
      lifetimeTurns: 5,
      remainingTurns: 3,
      tags: ['summon', 'verdant'],
    })
    expect(readSummonInspectMetadata(snapshot, 'summon:test')?.abilities).toHaveLength(1)
  })

  it('returns null for ordinary combatants', () => {
    const snapshot = { effectState: { summons: [] } } as unknown as BattleSessionView['snapshot']
    expect(readSummonInspectMetadata(snapshot, 'character:owner')).toBeNull()
  })
})
