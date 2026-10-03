import type { BattleEventRecord } from '@aurevane/db/battle-session'
import {
  createCombatEncounterState,
  executeCombatAction,
  endCombatTurn,
  type CombatActionDefinition,
  type CombatStatusInstance,
} from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import {
  createTacticalBattleState,
  selectCurrentFinalFacing,
} from '@aurevane/game-core/combat/board'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  buildBattlePrivacyJournalInput,
  projectBattleHistoryForViewer,
  type BattleHistoryPrivacyJournal,
} from './battle-history-privacy'
import {
  createSpectatorBattleViewerEntitlement,
  deriveParticipantBattleViewerEntitlement,
} from './battle-viewer-entitlement'

const ACTOR = 'character:actor'
const ALLY = 'character:ally'
const TARGET = 'character:target'

function status(
  statusId: string,
  sourceCombatantId: string,
  remainingOwnerTurnStarts = 2,
): CombatStatusInstance {
  return {
    statusId,
    statusVersion: 1,
    stacks: 1,
    remainingOwnerTurnStarts,
    sourceCombatantId,
  }
}

function profile(combatantId: string): StatDrivenCombatProfile {
  return {
    combatantId,
    provenance: {
      kind: 'scenario',
      sourceId: `scenario:${combatantId}`,
      sourceRulesVersion: 2,
    },
    accuracy: 10_000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 1,
  }
}

function encounter(input?: {
  actorStatuses?: readonly CombatStatusInstance[]
  allyStatuses?: readonly CombatStatusInstance[]
  targetStatuses?: readonly CombatStatusInstance[]
}): StatDrivenCombatEncounterState {
  const combatants = [
    { id: ACTOR, teamId: 'team:a', initiative: 30 },
    { id: ALLY, teamId: 'team:a', initiative: 20 },
    { id: TARGET, teamId: 'team:b', initiative: 10 },
  ].map((entry) => ({
    ...entry,
    baseMovementBudget: 4,
    hp: 100,
    maxHp: 100,
    mp: 20,
    maxMp: 20,
  }))
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:csr3-history',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 0x12345678,
      combatants,
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 3,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: [0, 1, 2].map((x) => ({
      position: { x, y: 0 },
      elevation: 0,
      terrainId: 'open',
    })),
    movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
    placements: [ACTOR, ALLY, TARGET].map((combatantId, x) => ({
      combatantId,
      position: { x, y: 0 },
      facing: x < 2 ? ('east' as const) : ('west' as const),
      movementProfileId: 'ground',
    })),
  })
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(tactical, [
      { combatantId: ACTOR, statuses: input?.actorStatuses ?? [] },
      { combatantId: ALLY, statuses: input?.allyStatuses ?? [] },
      { combatantId: TARGET, statuses: input?.targetStatuses ?? [] },
    ]),
    [ACTOR, ALLY, TARGET].map(profile),
  )
}

function record(
  battleVersion: number,
  eventIndex: number,
  event: Record<string, unknown>,
): BattleEventRecord {
  return {
    battleVersion,
    eventIndex,
    event,
    createdAt: '2026-09-17T12:00:00.000Z',
  }
}

describe('CSR-3 commit-time privacy metadata', () => {
  it('retains original Covert cast visibility when a delayed status activates in a later public turn transition', () => {
    const before = {
      ...encounter({ actorStatuses: [status('covert', ACTOR, 4)] }),
      effectTimingPolicy: { version: 1 as const, modes: {} },
    }
    const action: CombatActionDefinition = {
      id: 'secret.hex',
      version: 1,
      sourceType: 'test',
      tags: [],
      cost: { spendsAction: false, mp: 0 },
      requirements: [],
      target: {
        kind: 'unit',
        teamPolicy: 'enemy',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 6,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
        friendlyFire: 'enemies-only',
      },
      effects: [
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'hexed',
          stacks: 1,
          durationTurns: 1,
        },
      ],
    }
    const cast = executeCombatAction(
      before,
      action,
      { kind: 'unit', combatantId: TARGET },
      PV1F_COMBAT_CONTENT,
    )
    let state = { ...before, ...cast.state, statBridge: before.statBridge }
    let transition: ReturnType<typeof endCombatTurn> | undefined
    let activationBefore = state
    for (let turn = 0; turn < 3; turn += 1) {
      activationBefore = state
      transition = endCombatTurn(
        { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
        PV1F_COMBAT_CONTENT,
      )
      state = { ...state, ...transition.state, statBridge: state.statBridge }
    }
    if (!transition) throw new Error('Expected next-round activation.')
    const applied = transition.events.findIndex(
      (event) => event.event === 'status_applied' && event.actionId === action.id,
    )
    expect(applied).toBeGreaterThanOrEqual(0)
    const journal = buildBattlePrivacyJournalInput({
      before: activationBefore,
      after: state,
      commandKind: 'face',
      events: transition.events,
    })
    expect(journal.commandVisibility).toEqual({ kind: 'public' })
    expect(
      journal.eventVisibilityOverrides.find((override) => override.eventIndex === applied)
        ?.visibility,
    ).toEqual({ kind: 'team-only', teamId: 'team:a' })
  })

  it('intersects original source privacy with an opposing Covert target restriction', () => {
    const before = encounter({ targetStatuses: [status('covert', TARGET, 4)] })
    const event = {
      event: 'status_applied',
      actionId: 'secret.buff',
      sourceCombatantId: ACTOR,
      targetCombatantId: TARGET,
      statusId: 'guarded',
      sourceCommandVisibility: { kind: 'team-only', teamId: 'team:a' },
    }
    const input = buildBattlePrivacyJournalInput({
      before,
      after: before,
      commandKind: 'face',
      events: [event],
    })
    const journal: BattleHistoryPrivacyJournal = {
      ...input,
      battleVersion: 9,
      actorCombatantId: TARGET,
      actorTeamId: 'team:b',
      eventCount: 1,
    }
    expect(input.eventVisibilityOverrides).toEqual([
      {
        eventIndex: 0,
        visibility: { kind: 'team-only', teamId: 'team:a', requiredTeamIds: ['team:b'] },
      },
    ])
    for (const viewer of [
      deriveParticipantBattleViewerEntitlement(before.tactical.battle.combatants, [ACTOR]),
      deriveParticipantBattleViewerEntitlement(before.tactical.battle.combatants, [TARGET]),
      createSpectatorBattleViewerEntitlement(),
    ]) {
      expect(projectBattleHistoryForViewer([record(9, 0, event)], [journal], viewer)).toEqual([])
    }
  })

  it('applies original source restriction to non-status delayed receipts and copied grants', () => {
    const before = encounter()
    const events = [
      {
        event: 'damage_applied',
        actionId: 'secret.bonus',
        sourceCombatantId: ACTOR,
        targetCombatantId: TARGET,
        amount: 7,
        sourceCommandVisibility: { kind: 'team-only', teamId: 'team:a' },
      },
      {
        event: 'temporary_skill_copied',
        combatantId: ACTOR,
        sourceCombatantId: TARGET,
        skillId: 'vanguard.forceful-strike',
        contentVersion: 2,
        sourceCommandVisibility: { kind: 'team-only', teamId: 'team:a' },
      },
    ]
    const input = buildBattlePrivacyJournalInput({
      before,
      after: before,
      commandKind: 'face',
      events,
    })
    const journal: BattleHistoryPrivacyJournal = {
      ...input,
      battleVersion: 9,
      actorCombatantId: TARGET,
      actorTeamId: 'team:b',
      eventCount: events.length,
    }
    const rows = events.map((event, index) => record(9, index, event))
    expect(
      projectBattleHistoryForViewer(
        rows,
        [journal],
        deriveParticipantBattleViewerEntitlement(before.tactical.battle.combatants, [ALLY]),
      ),
    ).toEqual(rows)
    expect(
      projectBattleHistoryForViewer(
        rows,
        [journal],
        deriveParticipantBattleViewerEntitlement(before.tactical.battle.combatants, [TARGET]),
      ),
    ).toEqual([])
    expect(
      projectBattleHistoryForViewer(rows, [journal], createSpectatorBattleViewerEntitlement()),
    ).toEqual([])
  })

  it('samples command-start Covert before command mutations and hides only ordinary action identity', () => {
    const before = encounter({ actorStatuses: [status('covert', ACTOR, 3)] })
    const after = encounter()
    const events = [
      { event: 'combat_action_used', actionId: 'vanguard.forceful-strike', actorId: ACTOR },
      {
        event: 'damage_applied',
        actionId: 'vanguard.forceful-strike',
        sourceCombatantId: ACTOR,
        targetCombatantId: TARGET,
        amount: 12,
        hpBefore: 100,
        hpAfter: 88,
      },
    ]

    expect(
      buildBattlePrivacyJournalInput({ before, after, commandKind: 'action', events }),
    ).toMatchObject({
      schemaVersion: 1,
      commandVisibility: { kind: 'team-only', teamId: 'team:a' },
    })
    expect(
      buildBattlePrivacyJournalInput({ before, after, commandKind: 'move', events }),
    ).toMatchObject({
      schemaVersion: 1,
      commandVisibility: { kind: 'public' },
    })
  })

  it('hides a positive lifecycle fact on a Covert target without hiding a negative lifecycle fact', () => {
    const before = encounter({ targetStatuses: [status('covert', TARGET, 3)] })
    const after = encounter({
      targetStatuses: [
        status('covert', TARGET, 3),
        status('guarded', ACTOR),
        status('exposed', ACTOR),
      ],
    })
    const events = [
      {
        event: 'status_applied',
        actionId: 'test.buff',
        sourceCombatantId: ACTOR,
        targetCombatantId: TARGET,
        statusId: 'guarded',
        stacks: 1,
        remainingOwnerTurnStarts: 2,
        refreshed: false,
        stacked: false,
      },
      {
        event: 'status_applied',
        actionId: 'test.debuff',
        sourceCombatantId: ACTOR,
        targetCombatantId: TARGET,
        statusId: 'exposed',
        stacks: 1,
        remainingOwnerTurnStarts: 2,
        refreshed: false,
        stacked: false,
      },
    ]

    expect(
      buildBattlePrivacyJournalInput({ before, after, commandKind: 'action', events }),
    ).toEqual({
      schemaVersion: 1,
      commandVisibility: { kind: 'public' },
      eventVisibilityOverrides: [
        { eventIndex: 0, visibility: { kind: 'team-only', teamId: 'team:b' } },
      ],
    })
  })

  it('publishes the successful Sensory purge/Covert removal/Revealed boundary even when the actor command is hidden', () => {
    const before = encounter({
      actorStatuses: [status('covert', ACTOR, 3)],
      targetStatuses: [status('covert', TARGET, 3), status('guarded', TARGET)],
    })
    const after = encounter({ targetStatuses: [status('revealed', ACTOR, 4)] })
    const events = [
      { event: 'combat_action_used', actionId: 'test.sensory', actorId: ACTOR },
      {
        event: 'status_removed',
        actionId: 'test.sensory',
        sourceCombatantId: ACTOR,
        targetCombatantId: TARGET,
        statusId: 'guarded',
      },
      {
        event: 'status_removed',
        actionId: 'test.sensory',
        sourceCombatantId: ACTOR,
        targetCombatantId: TARGET,
        statusId: 'covert',
      },
      {
        event: 'status_applied',
        actionId: 'test.sensory',
        sourceCombatantId: ACTOR,
        targetCombatantId: TARGET,
        statusId: 'revealed',
        stacks: 1,
        remainingOwnerTurnStarts: 4,
        refreshed: false,
        stacked: false,
      },
    ]

    expect(
      buildBattlePrivacyJournalInput({ before, after, commandKind: 'action', events }),
    ).toEqual({
      schemaVersion: 1,
      commandVisibility: { kind: 'team-only', teamId: 'team:a' },
      eventVisibilityOverrides: [
        { eventIndex: 1, visibility: { kind: 'public' } },
        { eventIndex: 2, visibility: { kind: 'public' } },
        { eventIndex: 3, visibility: { kind: 'public' } },
      ],
    })
  })
})

describe('CSR-3 viewer-relative historical projection', () => {
  const journal: BattleHistoryPrivacyJournal = {
    battleVersion: 9,
    schemaVersion: 1,
    actorCombatantId: ACTOR,
    actorTeamId: 'team:a',
    commandVisibility: { kind: 'team-only', teamId: 'team:a' },
    eventVisibilityOverrides: [
      { eventIndex: 3, visibility: { kind: 'public' } },
      { eventIndex: 4, visibility: { kind: 'public' } },
    ],
    eventCount: 5,
  }
  const records = [
    record(9, 0, {
      event: 'combat_action_used',
      actionId: 'secret.sensory',
      actorId: ACTOR,
    }),
    record(9, 1, {
      event: 'mp_spent',
      combatantId: ACTOR,
      amount: 7,
      remaining: 13,
    }),
    record(9, 2, {
      event: 'skill_accuracy_resolved',
      actionId: 'secret.sensory',
      sourceCombatantId: ACTOR,
      targetCombatantId: TARGET,
      hit: true,
    }),
    record(9, 3, {
      event: 'status_removed',
      actionId: 'secret.sensory',
      sourceCombatantId: ACTOR,
      targetCombatantId: TARGET,
      statusId: 'covert',
    }),
    record(9, 4, {
      event: 'status_applied',
      actionId: 'secret.sensory',
      sourceCombatantId: ACTOR,
      targetCombatantId: TARGET,
      statusId: 'revealed',
      stacks: 1,
      remainingOwnerTurnStarts: 4,
      refreshed: false,
      stacked: false,
    }),
  ]
  const combatants = encounter().tactical.battle.combatants

  it('collapses a hidden command for an opponent without leaking raw child indexes/count while retaining public reveal facts', () => {
    const opponent = deriveParticipantBattleViewerEntitlement(combatants, [TARGET])
    const projected = projectBattleHistoryForViewer(records, [journal], opponent)

    expect(projected).toHaveLength(3)
    expect(projected.map((entry) => entry.eventIndex)).toEqual([0, 1, 2])
    expect(projected[0]?.event).toEqual({
      event: 'hidden_combat_action',
      actorCombatantId: ACTOR,
    })
    expect(projected.slice(1).map((entry) => (entry.event as { event?: unknown }).event)).toEqual([
      'status_removed',
      'status_applied',
    ])
    expect(JSON.stringify(projected)).not.toContain('secret.sensory')
    expect(JSON.stringify(projected)).not.toContain('mp_spent')
    expect(JSON.stringify(projected)).not.toContain('skill_accuracy_resolved')
  })

  it('keeps the full command for the actor team and treats spectators as unauthorized', () => {
    const ally = deriveParticipantBattleViewerEntitlement(combatants, [ALLY])
    expect(projectBattleHistoryForViewer(records, [journal], ally)).toEqual(records)

    const spectator = createSpectatorBattleViewerEntitlement()
    expect(projectBattleHistoryForViewer(records, [journal], spectator)).toHaveLength(3)
  })

  it('keeps a hidden Covert Copy grant inside the collapsed command boundary', () => {
    const hiddenCopyJournal: BattleHistoryPrivacyJournal = {
      battleVersion: 10,
      schemaVersion: 1,
      actorCombatantId: ACTOR,
      actorTeamId: 'team:a',
      commandVisibility: { kind: 'team-only', teamId: 'team:a' },
      eventVisibilityOverrides: [],
      eventCount: 2,
    }
    const copyRecords = [
      record(10, 0, {
        event: 'combat_action_used',
        actionId: 'secret.copy',
        actorId: ACTOR,
      }),
      record(10, 1, {
        event: 'temporary_skill_copied',
        combatantId: ACTOR,
        sourceCombatantId: TARGET,
        skillId: 'vanguard.forceful-strike',
        contentVersion: 2,
      }),
    ]
    const opponent = deriveParticipantBattleViewerEntitlement(combatants, [TARGET])
    const projected = projectBattleHistoryForViewer(copyRecords, [hiddenCopyJournal], opponent)

    expect(projected).toHaveLength(1)
    expect(projected[0]?.event).toEqual({
      event: 'hidden_combat_action',
      actorCombatantId: ACTOR,
    })
    expect(JSON.stringify(projected)).not.toContain('secret.copy')
    expect(JSON.stringify(projected)).not.toContain('vanguard.forceful-strike')

    const ally = deriveParticipantBattleViewerEntitlement(combatants, [ALLY])
    expect(projectBattleHistoryForViewer(copyRecords, [hiddenCopyJournal], ally)).toEqual(
      copyRecords,
    )
  })

  it('keeps legacy versions public when no journal row exists', () => {
    const opponent = deriveParticipantBattleViewerEntitlement(combatants, [TARGET])
    expect(projectBattleHistoryForViewer(records, [], opponent)).toEqual(records)
  })
})

it('conceals all current Copy benefits in a command that gains Covert, including earlier named effects and typed pools', () => {
  const before = encounter()
  before.copyPolicyVersion = 1
  const after = encounter({ actorStatuses: [status('airborne', ACTOR), status('covert', ACTOR)] })
  const events = [
    { event: 'combat_action_used', actorId: ACTOR, actionId: 'test.copy' },
    {
      event: 'status_applied',
      sourceCombatantId: ACTOR,
      targetCombatantId: ACTOR,
      statusId: 'airborne',
    },
    {
      event: 'status_applied',
      sourceCombatantId: ACTOR,
      targetCombatantId: ACTOR,
      statusId: 'covert',
    },
    { event: 'barrier_changed', sourceCombatantId: ACTOR, targetCombatantId: ACTOR, amount: 30 },
    {
      event: 'recovery_scheduled',
      sourceCombatantId: ACTOR,
      targetCombatantId: ACTOR,
      amountPerTick: 8,
    },
  ]
  const journal = {
    ...buildBattlePrivacyJournalInput({ before, after, commandKind: 'action', events }),
    battleVersion: 9,
    actorCombatantId: ACTOR,
    actorTeamId: 'team:a',
    eventCount: events.length,
  }
  const records = events.map((event, index) => record(9, index, event))
  for (const viewer of [
    deriveParticipantBattleViewerEntitlement(before.tactical.battle.combatants, [TARGET]),
    createSpectatorBattleViewerEntitlement(),
  ]) {
    expect(
      projectBattleHistoryForViewer(records, [journal], viewer).map((row) => row.event),
    ).toEqual([events[0]])
  }
  expect(
    projectBattleHistoryForViewer(
      records,
      [journal],
      deriveParticipantBattleViewerEntitlement(before.tactical.battle.combatants, [ACTOR]),
    ),
  ).toEqual(records)
})
