import { describe, expect, it, vi } from 'vitest'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createStatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import {
  finishPv1fTurn,
  executePv1fAction,
  PV1F_GUARD_ACTION_ID,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  createAiQualityResources,
  createPvpQualityResources,
  surrenderPvpCombatant,
  timeoutAiTurn,
  timeoutPvpTurn,
  AI_MISSED_TURN_STREAK_KEY,
} from '@aurevane/game-core/combat/pvp-quality'
import type { BattleEventRecord } from '@aurevane/db/battle-session'

vi.mock('server-only', () => ({}))
import { buildBattleLogView } from './battle-log-service'
import { buildBattleChronicle } from '@/components/battle/battle-log-chronicle-model'

const actors = ['character:zei', 'recruit:weon']
function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:idle-history',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 1,
      combatants: actors.map((id, index) => ({
        id,
        teamId: id,
        initiative: 20 - index,
        baseMovementBudget: 2,
        hp: 100,
        maxHp: 100,
        mp: 100,
        maxMp: 100,
        temporaryResources: [...createAiQualityResources(), ...createPvpQualityResources()],
      })),
    }),
  ).state
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 2,
        height: 1,
        terrains: [{ id: 'open-ground', traversalCost: 1 }],
        tiles: actors.map((_, index) => ({
          position: { x: index, y: 0 },
          elevation: 0,
          terrainId: 'open-ground',
        })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
        placements: actors.map((combatantId, index) => ({
          combatantId,
          position: { x: index, y: 0 },
          facing: 'north',
          movementProfileId: 'ground',
        })),
      }),
    ),
    actors.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario', sourceId: 'scenario:idle-history', sourceRulesVersion: 1 },
      accuracy: 10_000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
    })),
  )
}
function records(events: readonly unknown[], battleVersion: number): BattleEventRecord[] {
  return events.map((event, eventIndex) => ({
    battleVersion,
    eventIndex,
    event,
    createdAt: '2026-10-04T00:00:00Z',
  }))
}
function idleNarrations(history: readonly BattleEventRecord[]) {
  return buildBattleChronicle(buildBattleLogView('idle', history).entries, {
    combatantNames: { [actors[0]]: 'Zei', [actors[1]]: 'Weon' },
  }).flatMap((round) =>
    round.actors.flatMap((actor) =>
      actor.actions
        .filter((action) => action.family === 'idle')
        .map((action) => [round.round, actor.actorId, action.fallbackNarration]),
    ),
  )
}

describe('idle narration from persisted command events', () => {
  it('keeps a surrender from being narrated as an idle end turn before its surrender receipt', () => {
    const surrendered = surrenderPvpCombatant(encounter(), actors[0])
    const history = records(surrendered.events, 2)
    const projected = buildBattleLogView('idle', history).entries
    expect(projected.findIndex((entry) => entry.eventType === 'turn_ended')).toBeLessThan(
      projected.findIndex((entry) => entry.eventType === 'pvp_combatant_surrendered'),
    )
    expect(idleNarrations(history)).toEqual([])
    expect(JSON.stringify(buildBattleChronicle(projected))).toContain('surrendered')
  })

  it('narrates a provable first AI timeout as idle, including the opening turn', () => {
    const timedOut = timeoutAiTurn(encounter())
    const history = records(timedOut.events, 2)
    expect((timedOut.events[0] as { event: string }).event).toBe('ai_turn_timed_out')
    expect(idleNarrations(history)).toEqual([[1, actors[0], 'Zei stands around and does nothing.']])
    expect(idleNarrations(history.slice(1))).toEqual([])
    const first = finishPv1fTurn(encounter(), 'east')
    expect(
      idleNarrations([
        ...records(first.events, 2),
        ...records(timeoutAiTurn(first.state).events, 3),
      ]),
    ).toHaveLength(2)
  })

  it('does not label an AI timeout idle when Guard was used earlier in that turn', () => {
    const guarded = executePv1fAction(encounter(), PV1F_GUARD_ACTION_ID, { kind: 'self' })
    const timedOut = timeoutAiTurn(guarded.state)
    expect(idleNarrations([...records(guarded.events, 2), ...records(timedOut.events, 3)])).toEqual(
      [],
    )
  })

  it.each(['pvp', 'repeat-ai'] as const)(
    'retains the actual Lowered Guard action and outcome on %s timeout',
    (kind) => {
      const state = encounter()
      state.tactical.battle.combatants[0].temporaryResources =
        state.tactical.battle.combatants[0].temporaryResources.map((resource) =>
          resource.key === AI_MISSED_TURN_STREAK_KEY ? { ...resource, current: 1 } : resource,
        )
      const timedOut = kind === 'pvp' ? timeoutPvpTurn(state) : timeoutAiTurn(state)
      const history = records(timedOut.events, 2)
      expect(idleNarrations(history)).toEqual([])
      const chronicle = buildBattleChronicle(buildBattleLogView('idle', history).entries)
      expect(
        chronicle
          .flatMap((round) => round.actors.flatMap((actor) => actor.actions))
          .some((action) =>
            action.outcomes.some((outcome) => outcome.statusId === 'lowered-guard'),
          ),
      ).toBe(true)
      expect(JSON.stringify(chronicle)).toContain('Lowered Guard')
    },
  )

  it('narrates the PvE opening turn without inventing an unpersisted start marker', () => {
    const finished = finishPv1fTurn(encounter(), 'east')
    const history = records(finished.events, 2)
    expect(finished.events).toEqual([
      { event: 'final_facing_selected', combatantId: actors[0], facing: 'east' },
      { event: 'combatant_facing_changed', combatantId: actors[0], facing: 'east' },
      { event: 'turn_ended', round: 1, turnNumber: 1, combatantId: actors[0] },
      { event: 'turn_started', round: 1, turnNumber: 2, combatantId: actors[1] },
    ])
    expect(idleNarrations(history)).toEqual([[1, actors[0], 'Zei stands around and does nothing.']])
    expect(idleNarrations(history.slice(1))).toEqual([])
    expect(idleNarrations(records(finished.events, 3))).toEqual([])
  })

  it('keeps real AI facing and following-round turn boundaries aligned after projection', () => {
    const first = finishPv1fTurn(encounter(), 'east')
    const second = finishPv1fTurn(first.state, 'west')
    const third = finishPv1fTurn(second.state, 'south')
    const history = [
      ...records(first.events, 2),
      ...records(
        [
          { event: 'recruit_ai_decision', combatantId: actors[1], reason: 'face-threat' },
          ...second.events,
        ],
        3,
      ),
      ...records(third.events, 4),
    ]
    expect(idleNarrations(history)).toEqual([
      [1, actors[0], 'Zei stands around and does nothing.'],
      [1, actors[1], 'Weon stands around and does nothing.'],
      [2, actors[0], 'Zei stands around and does nothing.'],
    ])
  })

  it('does not treat omitted resonance setup bookkeeping as a chosen action', () => {
    const first = finishPv1fTurn(encounter(), 'east')
    const second = finishPv1fTurn(first.state, 'west')
    const armed = {
      event: 'resonance_armed',
      actorId: actors[1],
      resonanceId: 'resonance.test',
      contentVersion: 1,
      setupActionId: 'skill.setup',
    }
    const history = [...records(first.events, 2), ...records([armed, ...second.events], 3)]
    expect(idleNarrations(history)).toHaveLength(2)
    const used = { event: 'combat_action_used', actorId: actors[1], actionId: 'skill.setup' }
    expect(
      idleNarrations([...records(first.events, 2), ...records([used, armed, ...second.events], 3)]),
    ).toHaveLength(1)
  })

  it('does not infer idle across an unknown trailing event filtered from an earlier command', () => {
    const first = finishPv1fTurn(encounter(), 'east')
    const second = finishPv1fTurn(first.state, 'west')
    expect(
      idleNarrations([
        ...records([...first.events, { event: 'unknown_legacy_action' }], 2),
        ...records(second.events, 3),
      ]),
    ).toEqual([[1, actors[0], 'Zei stands around and does nothing.']])
  })
})
