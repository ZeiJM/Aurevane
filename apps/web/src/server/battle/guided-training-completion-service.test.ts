import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import type { BattleEventRecord, BattleEventRepository } from '@aurevane/db/battle-session'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  collectGuidedTrainingEventHistory,
  readGuidedTrainingCompletionDisposition,
  readGuidedTrainingProgress,
} from './guided-training-completion-service'

import {
  capturedBasicSkillSource,
  defaultBasicSkills,
} from '@aurevane/game-core/combat/combat-basic-actions'
import {
  captureBattleBuildAbilitySources,
  type BattleBuildAuthoritySnapshot,
} from './battle-build-authority'
import { capturedBasicBattle } from '@/components/battle/battle-basic-actions.test-utils'
import { commitCombatAbilityCommand } from '@aurevane/game-core/combat/combat-ability-command'
import { combatAbilityCommandContext } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'

const CONTROLLED_COMBATANT_ID = 'character:player'
const CREATED_AT = '2026-08-25T16:00:00.000Z'

function record(battleVersion: number, eventIndex: number, event: unknown): BattleEventRecord {
  return {
    battleVersion,
    eventIndex,
    event,
    createdAt: CREATED_AT,
  }
}

describe('guided training completion disposition', () => {
  it('treats player defeat as a loss even when the battle is already completed', () => {
    const events = [
      record(2, 0, {
        event: 'guided_training_completed',
        combatantId: CONTROLLED_COMBATANT_ID,
        criteria: ['move', 'attack', 'guard', 'facing'],
      }),
      record(2, 1, { event: 'battle_completed', winningTeamId: 'recruits' }),
    ]

    expect(() =>
      readGuidedTrainingCompletionDisposition(
        {
          lifecycle: 'completed',
          combatants: [{ id: CONTROLLED_COMBATANT_ID, hp: 0 }],
        },
        events,
        CONTROLLED_COMBATANT_ID,
      ),
    ).toThrowError('Guided training is lost when your combatant is defeated.')
  })

  it('does not reinterpret an unrelated completed battle as a training victory', () => {
    expect(() =>
      readGuidedTrainingCompletionDisposition(
        {
          lifecycle: 'completed',
          combatants: [{ id: CONTROLLED_COMBATANT_ID, hp: 12 }],
        },
        [record(7, 0, { event: 'battle_completed', winningTeamId: 'recruits' })],
        CONTROLLED_COMBATANT_ID,
      ),
    ).toThrowError('That guided exercise ended without a training victory.')
  })

  it('still recognizes a legitimate prior guided-training completion as a replay', () => {
    expect(
      readGuidedTrainingCompletionDisposition(
        {
          lifecycle: 'completed',
          combatants: [{ id: CONTROLLED_COMBATANT_ID, hp: 12 }],
        },
        [
          record(7, 0, {
            event: 'guided_training_completed',
            combatantId: CONTROLLED_COMBATANT_ID,
            criteria: ['move', 'attack', 'guard', 'facing'],
          }),
        ],
        CONTROLLED_COMBATANT_ID,
      ),
    ).toBe('replayed')
  })
})

describe('guided training completion progress', () => {
  it('captures the extra recovery lesson action with enabled current definitions without changing the equipped Support', async () => {
    const { state } = capturedBasicBattle('basic.pilfer', false, {}, true)
    const authority: BattleBuildAuthoritySnapshot = {
      schemaVersion: 1,
      combatContext: 'pve',
      combatants: [
        {
          combatantId: 'actor',
          characterId: 'actor',
          snapshotSchemaVersion: 1,
          buildSchemaVersion: 1,
          buildVersion: 1,
          fingerprint: 'captured-guided-build',
          primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
          secondary: null,
          disciplineSkills: [],
          extensions: { resonance: null, essence: null },
          supportActionId: 'basic.pilfer',
        },
      ],
    }
    const definitions = vi.fn(async () => new Map(defaultBasicSkills().map((row) => [row.id, row])))
    const sources = await captureBattleBuildAbilitySources(
      state,
      authority,
      {
        resolveCurrentSkillDefinition: async () => null,
        resolvePinnedSkillDefinition: async () => null,
        resolveCurrentBasicSkillDefinitions: definitions,
      },
      true,
    )
    expect(definitions).toHaveBeenCalledWith([
      'basic.move',
      'unarmed.basic',
      'basic.pilfer',
      'basic.recover',
    ])
    expect(sources.map((row) => row.abilityId)).toEqual([
      'basic.move',
      'unarmed.basic',
      'basic.pilfer',
      'basic.recover',
    ])
    expect(authority.combatants[0]!.supportActionId).toBe('basic.pilfer')
  })
  it.each(['pve', 'pvp'] as const)(
    'does not grant contextual Recovery in ordinary %s admission for equipment Support',
    async (combatContext) => {
      const { state } = capturedBasicBattle('basic.pilfer', false, {}, true)
      const item = starterItemDefinitions().find((item) => item.id === 'tower-shield')!
      const authority: BattleBuildAuthoritySnapshot = {
        schemaVersion: 1,
        combatContext,
        combatants: [
          {
            combatantId: 'actor',
            characterId: 'actor',
            snapshotSchemaVersion: 1,
            buildSchemaVersion: 1,
            buildVersion: 1,
            fingerprint: 'native-roles',
            primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
            secondary: null,
            disciplineSkills: [],
            supportActionId: 'basic.pilfer',
            extensions: {
              essence: null,
              resonance: null,
              equipmentSkills: [
                {
                  schemaVersion: 1,
                  inventoryRevision: 1,
                  selectedSupport: {
                    kind: 'equipment',
                    position: 'main-hand',
                    itemId: item.id,
                    behaviorId: 'guard',
                  },
                  equipment: [{ position: 'main-hand', ownedStackId: 'private-guard', item }],
                },
              ],
            },
          },
        ],
      }
      const sources = await captureBattleBuildAbilitySources(state, authority, {
        resolveCurrentSkillDefinition: async () => null,
        resolvePinnedSkillDefinition: async () => null,
        resolveCurrentBasicSkillDefinitions: async () =>
          new Map(defaultBasicSkills().map((basic) => [basic.id, basic])),
        resolvePinnedItemDefinition: async () => item,
      })
      expect(sources.filter((source) => source.basic).map((source) => source.abilityId)).toEqual([
        'basic.move',
      ])
      expect(sources.find((source) => source.equipment)!.equipment!.roles).toEqual({
        attack: 'attack',
        support: 'guard',
      })
      expect(() =>
        capturedBasicSkillSource(
          { ...state, capturedAbilitySources: sources },
          'actor',
          'basic.recover',
        ),
      ).toThrow('Basic Skill is not in the captured equipped actions')
    },
  )

  it('counts the actual captured HP Recovery commit after restoring missing health', () => {
    const { state } = capturedBasicBattle('basic.recover', false, {}, true)
    state.supportActionPolicyVersion = 1
    const actor = state.tactical.battle.combatants.find((row) => row.id === 'actor')!
    actor.hp = Math.floor(actor.maxHp * 0.75)
    const before = actor.hp
    const source = state.capturedAbilitySources!.find((row) => row.abilityId === 'basic.recover')!
    const result = commitCombatAbilityCommand({
      state,
      actorId: 'actor',
      root: { kind: 'canonical', source },
      selection: { kind: 'unit', combatantId: 'actor' },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, source),
    })
    expect(
      result.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp,
    ).toBeGreaterThan(before)
    const history = result.events.map((event, index) => record(1, index, event))
    expect(readGuidedTrainingProgress(history, 'actor', 'basic.recover').guard).toBe(true)
  })
  it('requires the current HP Recovery exercise and preserves historical Guard completion', () => {
    const event = (actionId: string) => [
      record(2, 0, {
        event: 'combat_action_used',
        actorId: CONTROLLED_COMBATANT_ID,
        actionId,
      }),
    ]
    expect(
      readGuidedTrainingProgress(event('basic.recover'), CONTROLLED_COMBATANT_ID, 'basic.recover')
        .guard,
    ).toBe(true)
    expect(
      readGuidedTrainingProgress(event('basic.guard'), CONTROLLED_COMBATANT_ID, 'basic.recover')
        .guard,
    ).toBe(false)
    expect(readGuidedTrainingProgress(event('basic.guard'), CONTROLLED_COMBATANT_ID).guard).toBe(
      true,
    )
    expect(readGuidedTrainingProgress(event('basic.recover'), CONTROLLED_COMBATANT_ID).guard).toBe(
      false,
    )
  })

  it('does not count timer-expiry facing as intentional facing', () => {
    const progress = readGuidedTrainingProgress(
      [
        record(7, 0, {
          event: 'ai_turn_timed_out',
          combatantId: CONTROLLED_COMBATANT_ID,
          consecutiveMisses: 1,
        }),
        record(7, 1, {
          event: 'final_facing_selected',
          combatantId: CONTROLLED_COMBATANT_ID,
          facing: 'east',
        }),
        record(7, 2, {
          event: 'combatant_facing_changed',
          combatantId: CONTROLLED_COMBATANT_ID,
          facing: 'east',
        }),
      ],
      CONTROLLED_COMBATANT_ID,
    )

    expect(progress.facing).toBe(false)
  })

  it('still counts an explicitly committed final facing', () => {
    const progress = readGuidedTrainingProgress(
      [
        record(8, 0, {
          event: 'final_facing_selected',
          combatantId: CONTROLLED_COMBATANT_ID,
          facing: 'north',
        }),
        record(8, 1, {
          event: 'combatant_facing_changed',
          combatantId: CONTROLLED_COMBATANT_ID,
          facing: 'north',
        }),
      ],
      CONTROLLED_COMBATANT_ID,
    )

    expect(progress.facing).toBe(true)
  })

  it('cannot complete all fundamentals when the only facing came from a timeout', () => {
    const progress = readGuidedTrainingProgress(
      [
        record(2, 0, {
          event: 'combatant_moved',
          combatantId: CONTROLLED_COMBATANT_ID,
          from: { x: 0, y: 0 },
          to: { x: 1, y: 0 },
          movementCost: 1,
        }),
        record(3, 0, {
          event: 'combat_action_used',
          actorId: CONTROLLED_COMBATANT_ID,
          actionId: 'basic.attack.unarmed.basic',
        }),
        record(4, 0, {
          event: 'combat_action_used',
          actorId: CONTROLLED_COMBATANT_ID,
          actionId: 'basic.guard',
        }),
        record(5, 0, {
          event: 'ai_turn_timed_out',
          combatantId: CONTROLLED_COMBATANT_ID,
          consecutiveMisses: 1,
        }),
        record(5, 1, {
          event: 'final_facing_selected',
          combatantId: CONTROLLED_COMBATANT_ID,
          facing: 'west',
        }),
        record(5, 2, {
          event: 'combatant_facing_changed',
          combatantId: CONTROLLED_COMBATANT_ID,
          facing: 'west',
        }),
      ],
      CONTROLLED_COMBATANT_ID,
    )

    expect(progress).toEqual({
      move: true,
      attack: true,
      guard: true,
      facing: false,
    })
  })

  it('keeps earned non-lethal criteria after more than one event page of later turns', async () => {
    const latestPage = Array.from({ length: 100 }, (_, index) =>
      record(220 - index, 0, {
        event: 'combatant_waited',
        combatantId: CONTROLLED_COMBATANT_ID,
      }),
    )
    const olderPage = [
      record(11, 0, {
        event: 'combatant_moved',
        combatantId: CONTROLLED_COMBATANT_ID,
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
        movementCost: 1,
      }),
      record(10, 0, {
        event: 'combat_action_used',
        actorId: CONTROLLED_COMBATANT_ID,
        actionId: 'basic.attack.unarmed.basic',
      }),
      record(9, 0, {
        event: 'final_facing_selected',
        combatantId: CONTROLLED_COMBATANT_ID,
        facing: 'east',
      }),
    ]
    const findBattleEvents = vi
      .fn<BattleEventRepository['findBattleEvents']>()
      .mockResolvedValueOnce(latestPage)
      .mockResolvedValueOnce(olderPage)
    const repository: BattleEventRepository = { findBattleEvents }

    const history = await collectGuidedTrainingEventHistory(repository, 'user:test', 'battle:test')
    const progress = readGuidedTrainingProgress(history, CONTROLLED_COMBATANT_ID)

    expect(findBattleEvents).toHaveBeenCalledTimes(2)
    expect(findBattleEvents.mock.calls[0]?.[2]).toBe(100)
    expect(findBattleEvents.mock.calls[1]?.[3]).toEqual({ battleVersion: 121, eventIndex: 0 })
    expect(progress).toEqual({ move: true, attack: true, guard: false, facing: true })
  })
})
