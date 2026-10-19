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
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BattleLogFeed } from '@/components/battle/battle-log-feed'
import { formatBattleLogForClipboard } from '@/components/battle/battle-log-clipboard'
import { createViewerSafeBattleLogService } from './battle-log-service'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import { commitCombatAbilityCommand } from '@aurevane/game-core/combat/combat-ability-command'
import { preparePv1fTurnEconomy } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  projectBattleStatusStateForViewer,
  projectBattleEffectStateForViewer,
  omitCombatExecutionMetadata,
} from './battle-live-viewer-projection'

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
  event: BattleEventRecord['event'],
): BattleEventRecord {
  return {
    battleVersion,
    eventIndex,
    event,
    createdAt: '2026-09-17T12:00:00.000Z',
  }
}

describe('CSR-3 commit-time privacy metadata', () => {
  it.each([false, true])(
    'keeps authoritative active Covert concealed through a queued refresh (active: %s)',
    (active) => {
      const makeSource = (id: string, instant: boolean) =>
        captureCombatAbilitySource({
          schemaVersion: 1,
          sourceInstanceId: id,
          ownerCombatantId: ACTOR,
          abilityId: id,
          contentVersion: 1,
          sourceKind: 'discipline-skill',
          sourceDisciplineId: 'shadehand',
          tags: ['utility'],
          definition: {
            schemaVersion: 1,
            behaviors: [
              {
                id: 'hide',
                activation: 'manual',
                mode: 'action',
                classification: 'utility',
                costs: [],
                cooldown: null,
                requirements: null,
                targeting: {
                  kind: 'self',
                  teamPolicy: 'self',
                  friendlyFire: 'allies-only',
                  shape: { kind: 'single' },
                  minimumRange: 0,
                  maximumRange: 0,
                  requiresLineOfSight: false,
                  maximumElevationDifference: null,
                  maximumSelections: 1,
                },
                effects: [
                  {
                    id: 'hide',
                    ...(instant ? { timing: 'instant' as const } : {}),
                    payload: {
                      type: 'apply-status',
                      recipient: 'actor',
                      statusId: 'covert',
                      stacks: 1,
                      durationTurns: 2,
                    },
                  },
                ],
              },
            ],
          },
        })
      const instant = makeSource('review.instant', true),
        pending = makeSource('review.pending', false)
      const initial = {
        ...preparePv1fTurnEconomy(encounter({ actorStatuses: [status('inspired', ACTOR)] })),
        effectTimingPolicy: { version: 1 as const, modes: {} },
        effectStackingPolicyVersion: 1 as const,
      }
      let state = reconcileCombatAbilitySources(initial, [instant, pending])
      for (const source of active ? [instant, pending] : [pending])
        state = commitCombatAbilityCommand({
          state,
          actorId: ACTOR,
          root: { kind: 'canonical', source },
          selection: { kind: 'self' },
          content: PV1F_COMBAT_CONTENT,
          context: combatAbilityCommandContext(state, source),
        }).state
      expect(
        state.statusState
          .find((x) => x.combatantId === ACTOR)!
          .statuses.some((x) => x.statusId === 'covert' && x.timingState === 'active'),
      ).toBe(active)
      expect(
        state.pendingEffects!.some(
          (x) => x.effect.type === 'apply-status' && x.effect.statusId === 'covert',
        ),
      ).toBe(true)
      expect(
        validateStatDrivenCombatEncounterState(state as StatDrivenCombatEncounterState),
      ).toEqual([])
      for (const id of [ACTOR, ALLY]) {
        const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
          id,
        ])
        const statuses = projectBattleStatusStateForViewer(
          state as StatDrivenCombatEncounterState,
          viewer,
        ).find((x) => x.combatantId === ACTOR)!.statuses
        expect(statuses.map((x) => x.statusId)).toEqual(
          expect.arrayContaining(['inspired', 'covert']),
        )
        expect(statuses.some((x) => x.statusId === 'covert' && x.timingState === 'active')).toBe(
          active,
        )
        expect(statuses.some((x) => x.statusId === 'covert' && x.timingState === 'pending')).toBe(
          true,
        )
      }
      for (const viewer of [
        deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [TARGET]),
        createSpectatorBattleViewerEntitlement(),
      ]) {
        const statuses = projectBattleStatusStateForViewer(
          state as StatDrivenCombatEncounterState,
          viewer,
        ).find((x) => x.combatantId === ACTOR)!.statuses
        expect(statuses.map((x) => x.statusId)).toEqual(active ? [] : ['inspired'])
      }
    },
  )

  it.each([
    'append',
    'replace',
    'replace-recorded',
    'owner-clock',
    'round-clock',
    'skip-clock',
  ] as const)(
    'conceals canonical pending-Covert instances and retains only provably public facts (%s)',
    (mode) => {
      const source = captureCombatAbilitySource({
        schemaVersion: 1,
        sourceInstanceId: 'mixed.source',
        ownerCombatantId: ACTOR,
        abilityId: 'secret.mixed',
        contentVersion: 1,
        sourceKind: 'discipline-skill',
        sourceDisciplineId: 'shadehand',
        tags: ['utility'],
        definition: {
          schemaVersion: 1,
          behaviors: [
            {
              id: 'shelter',
              activation: 'manual',
              mode: 'action',
              classification: 'utility',
              costs: [],
              cooldown: null,
              requirements: null,
              targeting: {
                kind: 'self',
                teamPolicy: 'self',
                friendlyFire: 'allies-only',
                shape: { kind: 'single' },
                minimumRange: 0,
                maximumRange: 0,
                requiresLineOfSight: false,
                maximumElevationDifference: null,
                maximumSelections: 1,
              },
              effects: [
                ...(mode.startsWith('replace')
                  ? [
                      {
                        id: 'remove',
                        timing: 'instant' as const,
                        payload: {
                          type: 'remove-status' as const,
                          recipient: 'actor' as const,
                          statusIds: ['inspired'],
                          removalMode: 'specified' as const,
                        },
                      },
                    ]
                  : []),
                {
                  id: 'hide',
                  payload: {
                    type: 'apply-status',
                    recipient: 'actor',
                    statusId: 'covert',
                    stacks: 1,
                  },
                },
                {
                  id: 'shield',
                  timing: 'instant',
                  payload: { type: 'barrier-change', recipient: 'actor', amount: 17 },
                },
                {
                  id: 'inspire',
                  timing: 'instant',
                  payload: {
                    type: 'apply-status',
                    recipient: 'actor',
                    statusId: 'inspired',
                    potencyBasisPoints: 3500,
                    durationTurns: mode === 'owner-clock' ? 4 : 1,
                    stacks: 1,
                  },
                },
              ],
            },
          ],
        },
      })
      const initial = {
        ...preparePv1fTurnEconomy(
          encounter({
            actorStatuses: [
              status('guarded', ACTOR),
              {
                ...status('inspired', ACTOR, 1),
                timingState: 'active',
                remainingOwnerTurnEnds: 1,
                potencyBasisPoints: 2000,
                ...(mode === 'round-clock'
                  ? {
                      durationScope: 'rounds' as const,
                      remainingRoundBoundaries: 4,
                      skipCurrentOwnerTurnEnd: true,
                    }
                  : {}),
                skipCurrentOwnerTurnEnd: mode !== 'skip-clock',
              },
            ],
          }),
        ),
        effectTimingPolicy: { version: 1, modes: {} },
        effectStackingPolicyVersion: 1 as const,
        effectState: {
          ongoingRecovery: [],
          poison: [],
          burn: [],
          bleed: [],
          damageHistory: [],
          barriers: [
            {
              sourceActionId: source.abilityId,
              sourceCombatantId: ACTOR,
              targetCombatantId: ACTOR,
              amount: 5,
              applicationOrder: 1,
            },
          ],
        },
      }
      if (mode === 'replace-recorded')
        initial.statusState = initial.statusState.map((row) =>
          row.combatantId === ACTOR
            ? {
                ...row,
                statuses: row.statuses.map((status) =>
                  status.statusId === 'inspired'
                    ? {
                        ...status,
                        applicationModifiers: [
                          { stacks: 1, sourceCombatantId: ACTOR, potencyBasisPoints: 2000 },
                        ],
                      }
                    : status,
                ),
              }
            : row,
        )
      const state = reconcileCombatAbilitySources(initial, [source])
      const cast = commitCombatAbilityCommand({
        state,
        actorId: ACTOR,
        root: { kind: 'canonical', source },
        selection: { kind: 'self' },
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(state, source),
      })
      const after = { ...initial, ...cast.state, statBridge: initial.statBridge }
      expect(
        after.pendingEffects!.some(
          (effect) => effect.effect.type === 'apply-status' && effect.effect.statusId === 'covert',
        ),
      ).toBe(true)
      expect(after.effectState!.barriers!.map((pool) => pool.amount)).toEqual([5, 17])
      expect(validateStatDrivenCombatEncounterState(JSON.parse(JSON.stringify(after)))).toEqual([])
      const corrupt = JSON.parse(JSON.stringify(after)) as StatDrivenCombatEncounterState
      corrupt.effectState!.barriers![1].sourceCommandVisibility = {
        kind: 'team-only',
        teamId: 'team:b',
      }
      expect(validateStatDrivenCombatEncounterState(corrupt)).not.toEqual([])
      for (const id of [ACTOR, ALLY]) {
        const viewer = deriveParticipantBattleViewerEntitlement(after.tactical.battle.combatants, [
          id,
        ])
        expect(JSON.stringify(projectBattleStatusStateForViewer(after, viewer))).not.toContain(
          'sourceCommandVisibility',
        )
        expect(JSON.stringify(projectBattleStatusStateForViewer(after, viewer))).not.toContain(
          'privateSharedLifetime',
        )
        expect(JSON.stringify(projectBattleEffectStateForViewer(after, viewer))).not.toContain(
          'sourceCommandVisibility',
        )
        expect(
          projectBattleEffectStateForViewer(after, viewer)!.barriers!.map((pool) => pool.amount),
        ).toEqual([5, 17])
        expect(
          projectBattleStatusStateForViewer(after, viewer)
            .find((row) => row.combatantId === ACTOR)!
            .statuses.map((row) => row.statusId),
        ).toEqual(expect.arrayContaining(['guarded', 'inspired', 'covert', 'barrier']))
      }
      for (const viewer of [
        deriveParticipantBattleViewerEntitlement(after.tactical.battle.combatants, [TARGET]),
        createSpectatorBattleViewerEntitlement(),
      ]) {
        expect(
          projectBattleEffectStateForViewer(after, viewer)!.barriers!.map((pool) => pool.amount),
        ).toEqual([5])
        const statuses = projectBattleStatusStateForViewer(after, viewer).find(
          (row) => row.combatantId === ACTOR,
        )!.statuses
        expect(statuses.map((row) => row.statusId)).toEqual(
          mode === 'append' ? ['guarded', 'inspired', 'barrier'] : ['guarded', 'barrier'],
        )
        if (mode === 'append')
          expect(statuses.find((row) => row.statusId === 'inspired')).toMatchObject({
            stacks: 1,
            potencyBasisPoints: 2000,
            remainingOwnerTurnStarts: 1,
            remainingOwnerTurnEnds: 1,
            applicationModifiers: [{ stacks: 1, potencyBasisPoints: 2000 }],
          })
        expect(statuses.find((row) => row.statusId === 'barrier')!.barrier!.amount).toBe(5)
        const afterConcealmentEnds = { ...after, pendingEffects: [] }
        expect(
          projectBattleEffectStateForViewer(afterConcealmentEnds, viewer)!.barriers!.map(
            (pool) => pool.amount,
          ),
        ).toEqual([5, 17])
      }
    },
  )

  it('keeps actual owner pending/active benefits while the enemy DTO, Chronicle, readers and clipboard remain generic', async () => {
    const before = {
      ...encounter({ actorStatuses: [status('covert', ACTOR, 3)] }),
      effectTimingPolicy: { version: 1, modes: { 'barrier-change': 'instant' as const } },
    }
    const action: CombatActionDefinition = {
      id: 'secret.shelter',
      version: 1,
      sourceType: 'test',
      tags: [],
      cost: { spendsAction: false, mp: 2 },
      requirements: [],
      target: {
        kind: 'self',
        teamPolicy: 'self',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 0,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
        friendlyFire: 'allies-only',
      },
      effects: [
        { type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 },
        { type: 'barrier-change', recipient: 'actor', amount: 17 },
      ],
    }
    const cast = executeCombatAction(before, action, { kind: 'self' }, PV1F_COMBAT_CONTENT)
    const after = { ...before, ...cast.state, statBridge: before.statBridge }
    const journal: BattleHistoryPrivacyJournal = {
      ...buildBattlePrivacyJournalInput({
        before,
        after,
        commandKind: 'action',
        events: cast.events,
      }),
      battleVersion: 1,
      actorCombatantId: ACTOR,
      actorTeamId: 'team:a',
      eventCount: cast.events.length,
    }
    const records = cast.events.map((event, index) => record(1, index, event))
    const owner = deriveParticipantBattleViewerEntitlement(before.tactical.battle.combatants, [
      ACTOR,
    ])
    const ownerRows = projectBattleStatusStateForViewer(after, owner).find(
      (row) => row.combatantId === ACTOR,
    )!.statuses
    expect(ownerRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ statusId: 'guarded', timingState: 'pending' }),
        expect.objectContaining({
          statusId: 'barrier',
          timingState: 'active',
          barrier: expect.objectContaining({ amount: 17 }),
        }),
      ]),
    )
    expect(projectBattleEffectStateForViewer(after, owner)?.barriers?.[0].amount).toBe(17)
    const names = { [ACTOR]: 'Arin', [TARGET]: 'Bryn' }
    for (const viewer of [
      deriveParticipantBattleViewerEntitlement(before.tactical.battle.combatants, [TARGET]),
      createSpectatorBattleViewerEntitlement(),
    ]) {
      const log = await createViewerSafeBattleLogService(
        { findBattleEvents: async () => records },
        { findBattleHistoryPrivacy: async () => ({ viewer, journals: [journal] }) },
      ).getLog('user', 'session')
      expect(log.entries).toHaveLength(1)
      expect(log.entries[0]).toMatchObject({
        eventType: 'hidden_combat_action',
        actionId: null,
        actionLabel: null,
        targetCombatantId: null,
        facts: [],
      })
      const html = renderToStaticMarkup(
        createElement(BattleLogFeed, {
          entries: log.entries,
          combatantNames: names,
          playerName: 'Bryn',
        }),
      )
      const copied = formatBattleLogForClipboard(log.entries, {
        combatantNames: names,
        playerName: 'Bryn',
      })
      expect(html).toContain('Arin uses a skill.')
      expect(copied).toContain('Arin uses a skill.')
      expect(JSON.stringify(log) + html + copied).not.toMatch(
        /secret.shelter|Guard|Barrier|Covert|Explain|activationRound/,
      )
      expect(
        projectBattleStatusStateForViewer(after, viewer).find((row) => row.combatantId === ACTOR)!
          .statuses,
      ).toEqual([])
      expect(projectBattleEffectStateForViewer(after, viewer)?.barriers).toEqual([])
    }
  })

  it.each(['instant', 'next-round'] as const)(
    'conceals the actual %s Skill that establishes Covert from opponents and spectators',
    (mode) => {
      const before = { ...encounter(), effectTimingPolicy: { version: 1, modes: { covert: mode } } }
      const action: CombatActionDefinition = {
        id: 'secret.smoke',
        version: 1,
        sourceType: 'test',
        tags: [],
        cost: { spendsAction: false, mp: 2 },
        requirements: [],
        target: {
          kind: 'self',
          teamPolicy: 'self',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 0,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          friendlyFire: 'allies-only',
        },
        effects: [
          { type: 'apply-status', recipient: 'actor', statusId: 'covert', stacks: 1 },
          { type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 },
        ],
      }
      const cast = executeCombatAction(before, action, { kind: 'self' }, PV1F_COMBAT_CONTENT)
      const after = { ...before, ...cast.state, statBridge: before.statBridge }
      const input = buildBattlePrivacyJournalInput({
        before,
        after,
        commandKind: 'action',
        events: cast.events,
      })
      const journal: BattleHistoryPrivacyJournal = {
        ...input,
        battleVersion: 1,
        actorCombatantId: ACTOR,
        actorTeamId: 'team:a',
        eventCount: cast.events.length,
      }
      const records = cast.events.map((event, index) => record(1, index, event))
      for (const viewer of [
        deriveParticipantBattleViewerEntitlement(before.tactical.battle.combatants, [TARGET]),
        createSpectatorBattleViewerEntitlement(),
      ]) {
        expect(
          projectBattleStatusStateForViewer(after, viewer).find((row) => row.combatantId === ACTOR)!
            .statuses,
        ).toEqual([])
        expect(
          projectBattleHistoryForViewer(records, [journal], viewer).map((row) => row.event),
        ).toEqual([{ event: 'hidden_combat_action', actorCombatantId: ACTOR }])
      }
      for (const id of [ACTOR, ALLY]) {
        const viewer = deriveParticipantBattleViewerEntitlement(before.tactical.battle.combatants, [
          id,
        ])
        expect(projectBattleHistoryForViewer(records, [journal], viewer)).toEqual(
          records.map((row) => ({
            ...row,
            event: omitCombatExecutionMetadata(row.event as object),
          })),
        )
      }
    },
  )

  it('conceals pending benefits received by another Covert combatant while retaining public harm', () => {
    const before = encounter({ allyStatuses: [status('covert', ALLY)] })
    const events = ['guarded', 'barrier-change', 'healing', 'mp-recovery', 'exposed'].map(
      (effectTag) => ({
        event: 'effect_pending',
        actionId: 'public.ally-cast',
        sourceCombatantId: ACTOR,
        targetCombatantId: ALLY,
        effectTag,
        activationRound: 2,
      }),
    )
    const input = buildBattlePrivacyJournalInput({
      before,
      after: before,
      commandKind: 'action',
      events,
    })
    expect(input.eventVisibilityOverrides).toEqual(
      [0, 1, 2, 3].map((eventIndex) => ({
        eventIndex,
        visibility: { kind: 'team-only', teamId: 'team:a' },
      })),
    )
  })

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
  it('retains already-public historical Covert grants rather than inferring an entire old command boundary', () => {
    const before = encounter()
    const records = [
      record(1, 0, { event: 'combat_action_used', actorId: ACTOR, actionId: 'old.smoke' }),
      record(1, 1, {
        event: 'status_applied',
        sourceCombatantId: ACTOR,
        targetCombatantId: ACTOR,
        actionId: 'old.smoke',
        statusId: 'covert',
      }),
    ]
    const journal: BattleHistoryPrivacyJournal = {
      schemaVersion: 1,
      battleVersion: 1,
      actorCombatantId: ACTOR,
      actorTeamId: 'team:a',
      eventCount: 2,
      commandVisibility: { kind: 'public' },
      eventVisibilityOverrides: [],
    }
    const viewer = deriveParticipantBattleViewerEntitlement(before.tactical.battle.combatants, [
      TARGET,
    ])
    expect(projectBattleHistoryForViewer(records, [journal], viewer)).toEqual(records)
  })

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

  it('keeps legacy versions public when no journal row exists', () => {
    const opponent = deriveParticipantBattleViewerEntitlement(combatants, [TARGET])
    expect(projectBattleHistoryForViewer(records, [], opponent)).toEqual(records)
  })
})
