import { describe, expect, it, vi } from 'vitest'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import { createCombatEncounterState, executeCombatAction } from '@aurevane/game-core/combat/actions'
import {
  createStatDrivenCombatEncounterState,
  reattachStatDrivenCombatBridge,
} from '@aurevane/game-core/combat/stat-driven-combat'
import {
  applyCurrentPoisonState,
  applyCurrentBurnState,
} from '@aurevane/game-core/combat/combat-dots'
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

  it.each(['poison', 'burn'] as const)(
    'keeps the next character idle after automatic %s settlement and preserves damage',
    (kind) => {
      const initial = encounter()
      const affected = (kind === 'poison' ? applyCurrentPoisonState : applyCurrentBurnState)(
        initial,
        actors[1],
        actors[0],
        'test.dot',
      )
      const first = finishPv1fTurn(
        reattachStatDrivenCombatBridge(affected, initial.statBridge),
        'east',
      )
      const second = finishPv1fTurn(first.state, 'west')
      const history = [...records(first.events, 2), ...records(second.events, 3)]
      expect(idleNarrations(history)).toEqual([
        [1, actors[0], 'Zei stands around and does nothing.'],
        [1, actors[1], 'Weon stands around and does nothing.'],
      ])
      const outcomes = buildBattleChronicle(buildBattleLogView('idle', history).entries).flatMap(
        (round) =>
          round.actors.flatMap((actor) => actor.actions.flatMap((action) => action.outcomes)),
      )
      expect(outcomes.some((outcome) => outcome.tone === 'damage')).toBe(true)
    },
  )

  it('still recognizes Guard chosen after the preceding character’s passive settlement', () => {
    const initial = encounter()
    const poisoned = applyCurrentPoisonState(initial, actors[1], actors[0], 'test.poison')
    const first = finishPv1fTurn(
      reattachStatDrivenCombatBridge(poisoned, initial.statBridge),
      'east',
    )
    const guarded = executePv1fAction(first.state, PV1F_GUARD_ACTION_ID, { kind: 'self' })
    const second = finishPv1fTurn(guarded.state, 'west')
    expect(
      idleNarrations([
        ...records(first.events, 2),
        ...records(guarded.events, 3),
        ...records(second.events, 4),
      ]),
    ).toEqual([[1, actors[0], 'Zei stands around and does nothing.']])
  })

  it.each([
    {
      event: 'damage_applied',
      actionId: 'status.poison.current.v1',
      sourceCombatantId: actors[0],
      targetCombatantId: actors[1],
      amount: 2,
    },
    {
      event: 'damage_applied',
      actionId: 'status.unknown-legacy',
      sourceCombatantId: actors[1],
      targetCombatantId: actors[0],
      amount: 2,
    },
    {
      event: 'healing_applied',
      actionId: 'skill.unrecorded-recovery',
      sourceCombatantId: actors[1],
      targetCombatantId: actors[0],
      amount: 2,
    },
  ])('requires the outgoing recipient and known passive identity for $actionId', (receipt) => {
    const first = finishPv1fTurn(encounter(), 'east')
    const second = finishPv1fTurn(first.state, 'west')
    expect(
      idleNarrations([...records([...first.events, receipt], 2), ...records(second.events, 3)]),
    ).toEqual([[1, actors[0], 'Zei stands around and does nothing.']])
  })

  it.each(['hp', 'mp'] as const)(
    'keeps the next character idle after a proven scheduled %s recovery tick',
    (resource) => {
      const initial = encounter()
      initial.tactical.battle.combatants[1].hp = 80
      initial.tactical.battle.combatants[1].mp = 80
      const cast = executeCombatAction(
        initial,
        {
          id: 'test.scheduled-recovery',
          version: 1,
          sourceType: 'test',
          tags: ['test'],
          requirements: [],
          cost: { spendsAction: false, mp: 0 },
          target: {
            kind: 'unit',
            teamPolicy: 'any',
            shape: { kind: 'single' },
            minimumRange: 0,
            maximumRange: 4,
            requiresLineOfSight: false,
            maximumElevationDifference: null,
            friendlyFire: 'all-units',
          },
          effects: [
            resource === 'hp'
              ? { type: 'healing', recipient: 'primary-unit', amount: 5, ticks: 3 }
              : {
                  type: 'resource-change',
                  recipient: 'primary-unit',
                  resource: 'mp',
                  delta: 5,
                  ticks: 3,
                },
          ],
        },
        { kind: 'unit', combatantId: actors[1] },
        { statuses: [] },
      )
      const first = finishPv1fTurn(
        reattachStatDrivenCombatBridge(cast.state, initial.statBridge),
        'east',
      )
      const second = finishPv1fTurn(first.state, 'west')
      const third = finishPv1fTurn(second.state, 'south')
      const history = [
        ...records(cast.events, 2),
        ...records(first.events, 3),
        ...records(second.events, 4),
        ...records(third.events, 5),
      ]
      expect(idleNarrations(history)).toEqual([
        [1, actors[1], 'Weon stands around and does nothing.'],
        [2, actors[0], 'Zei stands around and does nothing.'],
      ])
      expect(
        JSON.stringify(buildBattleChronicle(buildBattleLogView('idle', history).entries)),
      ).toContain(resource === 'hp' ? '+5 HP' : '+5 MP')
    },
  )

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
