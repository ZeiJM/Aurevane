import {
  createCombatActionProvenance,
  createCombatEffectInstanceProvenance,
} from '@aurevane/game-core/combat/combat-kernel-types'
import type { BattleSessionCommitRecord } from '@aurevane/db/battle-session'
import type { TransactionalCommandResult } from '@aurevane/db/transactional-command'
import {
  createCombatEncounterState,
  executeCombatAction,
  type CombatStatusInstance,
} from '@aurevane/game-core/combat/actions'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  omitPendingBattlePayloads,
  projectBattleEffectStateForViewer,
  projectBattleStatusStateForViewer,
} from './battle-live-viewer-projection'
import { projectCommittedBattleSession } from './battle-session-service'
import {
  deriveParticipantBattleViewerEntitlement,
  createSpectatorBattleViewerEntitlement,
} from './battle-viewer-entitlement'

const PLAYER = 'character:player'
const ALLY = 'character:ally'
const ENEMY = 'character:enemy'
const PLAIN_ENEMY = 'character:plain-enemy'

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

function encounter(): StatDrivenCombatEncounterState {
  const combatants = [
    { id: PLAYER, teamId: 'team:a', initiative: 40 },
    { id: ALLY, teamId: 'team:a', initiative: 30 },
    { id: ENEMY, teamId: 'team:b', initiative: 20 },
    { id: PLAIN_ENEMY, teamId: 'team:b', initiative: 10 },
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
      battleId: 'battle:csr2-live-viewer',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 0x24681357,
      combatants,
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 4,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: [0, 1, 2, 3].map((x) => ({
      position: { x, y: 0 },
      elevation: 0,
      terrainId: 'open',
    })),
    movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
    placements: [PLAYER, ALLY, ENEMY, PLAIN_ENEMY].map((combatantId, x) => ({
      combatantId,
      position: { x, y: 0 },
      facing: x < 2 ? ('east' as const) : ('west' as const),
      movementProfileId: 'ground',
    })),
  })
  const state = createStatDrivenCombatEncounterState(
    createCombatEncounterState(tactical, [
      {
        combatantId: PLAYER,
        statuses: [status('covert', PLAYER, 3), status('guarded', PLAYER)],
      },
      {
        combatantId: ALLY,
        statuses: [status('covert', ALLY, 3), status('guarded', ALLY)],
      },
      {
        combatantId: ENEMY,
        statuses: [
          status('covert', ENEMY, 3),
          status('guarded', ENEMY),
          status('exposed', PLAYER),
          { ...status('revealed', PLAYER), statusVersion: 999 },
          status('future-positive', ENEMY),
        ],
      },
      { combatantId: PLAIN_ENEMY, statuses: [status('guarded', PLAIN_ENEMY)] },
    ]),
    [PLAYER, ALLY, ENEMY, PLAIN_ENEMY].map(profile),
  )
  state.effectState = {
    ongoingRecovery: [],
    poison: [],
    bleed: [],
    burn: [],
    damageHistory: [],
    temporarySkills: [
      {
        combatantId: PLAYER,
        skillId: 'vanguard.forceful-strike',
        contentVersion: 2,
        sourceCombatantId: ENEMY,
      },
      {
        combatantId: ALLY,
        skillId: 'vanguard.cleave',
        contentVersion: 1,
        sourceCombatantId: ENEMY,
      },
      {
        combatantId: ENEMY,
        skillId: 'vanguard.guard-break',
        contentVersion: 1,
        sourceCombatantId: PLAYER,
      },
    ],
  }
  return state
}

function rowStatuses(
  state: { statusState: StatDrivenCombatEncounterState['statusState'] },
  id: string,
) {
  return state.statusState.find((row) => row.combatantId === id)?.statuses ?? []
}

function committed(
  snapshot: StatDrivenCombatEncounterState,
): TransactionalCommandResult<BattleSessionCommitRecord> {
  return {
    replayed: false,
    result: {
      battleSessionId: 'session:csr2-live-viewer',
      battleVersion: 7,
      snapshot,
      committedAt: '2026-09-17T12:00:00.000Z',
    },
  }
}

describe('CSR-2 live viewer-relative status projection', () => {
  it.each([
    [1, 1500],
    [2, 2000],
    [3, 2500],
  ])(
    'derives height %i rail effects with %i Evasion basis points without persistent mutations',
    (height, evasion) => {
      const state = elevatedEncounter(PLAYER, height)
      const before = structuredClone(state)
      const owner = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
        PLAYER,
      ])
      const projected = { statusState: projectBattleStatusStateForViewer(state, owner) }
      expect(rowStatuses(projected, PLAYER)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            statusId: 'terrain-evasion',
            potencyBasisPoints: evasion,
            timingState: 'active',
            presentationDuration: 'while-elevated',
          }),
          expect.objectContaining({
            statusId: 'terrain-defense',
            potencyBasisPoints: 2000,
            timingState: 'active',
            presentationDuration: 'while-elevated',
          }),
        ]),
      )
      expect(state).toEqual(before)
      expect(PV1F_COMBAT_CONTENT.statuses.some((status) => status.id.startsWith('terrain-'))).toBe(
        false,
      )
    },
  )

  it('removes position-derived effects immediately on leaving elevated terrain and preserves historical policy', () => {
    const state = elevatedEncounter(PLAIN_ENEMY, 2)
    const spectator = createSpectatorBattleViewerEntitlement()
    const project = (snapshot: typeof state) =>
      rowStatuses(
        { statusState: projectBattleStatusStateForViewer(snapshot, spectator) },
        PLAIN_ENEMY,
      ).filter((status) => status.statusId.startsWith('terrain-'))
    expect(project(state)).toHaveLength(2)
    const exited = {
      ...state,
      tactical: {
        ...state.tactical,
        tiles: [
          ...state.tactical.tiles,
          { position: { x: 4, y: 0 }, elevation: 0, terrainId: 'open' },
        ],
        width: 5,
        placements: state.tactical.placements.map((row) =>
          row.combatantId === PLAIN_ENEMY ? { ...row, position: { x: 4, y: 0 } } : row,
        ),
      },
    }
    expect(project(exited)).toEqual([])
    const historical = { ...state }
    delete historical.statBalancePolicyVersion
    expect(project(historical)).toEqual([])
  })

  it('keeps allied elevated positives visible while Covert hides them from opponents and spectators', () => {
    const state = elevatedEncounter(ALLY, 3)
    const ids = (viewer: ReturnType<typeof createSpectatorBattleViewerEntitlement>) =>
      rowStatuses({ statusState: projectBattleStatusStateForViewer(state, viewer) }, ALLY).map(
        (status) => status.statusId,
      )
    expect(
      ids(deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAYER])),
    ).toEqual(expect.arrayContaining(['terrain-evasion', 'terrain-defense']))
    for (const viewer of [
      deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [ENEMY]),
      createSpectatorBattleViewerEntitlement(),
    ]) {
      expect(ids(viewer)).toContain('terrain-defense')
      expect(ids(viewer)).not.toContain('terrain-evasion')
    }
  })

  it('carries viewer-only terrain rows through the canonical committed-session projection', () => {
    const state = elevatedEncounter(ALLY, 2)
    const before = structuredClone(state)
    const own = projectCommittedBattleSession(committed(state), [PLAYER]).snapshot
    expect(
      rowStatuses(own, ALLY).filter((status) => status.statusId.startsWith('terrain-')),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          statusId: 'terrain-evasion',
          presentationDuration: 'while-elevated',
        }),
        expect.objectContaining({
          statusId: 'terrain-defense',
          presentationDuration: 'while-elevated',
        }),
      ]),
    )
    const opponent = projectCommittedBattleSession(committed(state), [ENEMY]).snapshot
    expect(
      rowStatuses(opponent, ALLY)
        .filter((status) => status.statusId.startsWith('terrain-'))
        .map((status) => status.statusId),
    ).toEqual(['terrain-defense'])
    expect(state).toEqual(before)
    expect(own.tactical.battle).not.toHaveProperty('rng')
  })

  it('omits elevated effects for dead or unplaced combatants', () => {
    const state = elevatedEncounter(PLAIN_ENEMY, 3)
    const viewer = createSpectatorBattleViewerEntitlement()
    const dead = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((row) =>
            row.id === PLAIN_ENEMY ? { ...row, hp: 0 } : row,
          ),
        },
      },
    }
    const unplaced = {
      ...state,
      tactical: {
        ...state.tactical,
        placements: state.tactical.placements.filter((row) => row.combatantId !== PLAIN_ENEMY),
      },
    }
    for (const snapshot of [dead, unplaced])
      expect(
        rowStatuses(
          { statusState: projectBattleStatusStateForViewer(snapshot, viewer) },
          PLAIN_ENEMY,
        ).some((status) => status.statusId.startsWith('terrain-')),
      ).toBe(false)
  })

  it('preserves Covert privacy after a current Copy transfers allied beneficial tags', () => {
    const before = encounter()
    before.copyPolicyVersion = 1
    before.statusState = before.statusState.map((row) =>
      row.combatantId === PLAYER ? { ...row, statuses: [] } : row,
    )
    before.effectState = {
      ...before.effectState!,
      barriers: [
        {
          targetCombatantId: ALLY,
          sourceCombatantId: ALLY,
          sourceActionId: 'secret.barrier',
          amount: 30,
        },
      ],
      ongoingRecovery: [
        {
          kind: 'hp',
          targetCombatantId: ALLY,
          sourceCombatantId: ALLY,
          sourceActionId: 'secret.recovery',
          amountPerTick: 8,
          remainingFutureTicks: 2,
        },
      ],
    }
    const result = executeCombatAction(
      before,
      {
        id: 'test.beneficial-copy',
        version: 1,
        sourceType: 'discipline-skill',
        tags: [],
        target: {
          kind: 'unit',
          teamPolicy: 'any',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 10,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          friendlyFire: 'all-units',
        },
        cost: { spendsAction: true, mp: 0 },
        requirements: [],
        accuracyMode: 'automatic',
        effects: [{ type: 'copy', recipient: 'primary-unit' }],
      },
      { kind: 'unit', combatantId: ALLY },
      PV1F_COMBAT_CONTENT,
    ).state
    const owner = deriveParticipantBattleViewerEntitlement(result.tactical.battle.combatants, [
      PLAYER,
    ])
    const opposing = deriveParticipantBattleViewerEntitlement(result.tactical.battle.combatants, [
      ENEMY,
    ])
    expect(
      rowStatuses(
        {
          statusState: projectBattleStatusStateForViewer(
            result as StatDrivenCombatEncounterState,
            owner,
          ),
        },
        PLAYER,
      ).map((row) => row.statusId),
    ).toEqual(expect.arrayContaining(['covert', 'guarded']))
    expect(
      rowStatuses(
        {
          statusState: projectBattleStatusStateForViewer(
            result as StatDrivenCombatEncounterState,
            opposing,
          ),
        },
        PLAYER,
      ),
    ).toEqual([])
    expect(
      rowStatuses(
        {
          statusState: projectBattleStatusStateForViewer(
            result as StatDrivenCombatEncounterState,
            createSpectatorBattleViewerEntitlement(),
          ),
        },
        PLAYER,
      ),
    ).toEqual([])
    const selfEffects = projectBattleEffectStateForViewer(
      result as StatDrivenCombatEncounterState,
      owner,
    )
    expect(selfEffects?.barriers?.find((entry) => entry.targetCombatantId === PLAYER)?.amount).toBe(
      30,
    )
    expect(
      selfEffects?.ongoingRecovery.find((entry) => entry.targetCombatantId === PLAYER)
        ?.amountPerTick,
    ).toBe(8)
    for (const viewer of [opposing, createSpectatorBattleViewerEntitlement()]) {
      const publicEffects = projectBattleEffectStateForViewer(
        result as StatDrivenCombatEncounterState,
        viewer,
      )
      expect(publicEffects?.barriers?.some((entry) => entry.targetCombatantId === PLAYER)).toBe(
        false,
      )
      expect(
        publicEffects?.ongoingRecovery.some((entry) => entry.targetCombatantId === PLAYER),
      ).toBe(false)
      expect(JSON.stringify(publicEffects)).not.toContain('secret.barrier')
      expect(JSON.stringify(publicEffects)).not.toContain('secret.recovery')
    }
  })
  it('strips pinned narration metadata from public snapshots without mutating history', () => {
    const state = {
      pendingEffects: [],
      buildAuthority: {
        combatants: [
          {
            combatantId: PLAYER,
            fingerprint: 'unchanged',
            narratorIdentity: { name: 'Historical name', pronounPresetId: 'she_her' },
          },
        ],
      },
    }
    const projected = omitPendingBattlePayloads(state)
    expect(projected.buildAuthority.combatants[0]).toEqual({
      combatantId: PLAYER,
      fingerprint: 'unchanged',
    })
    expect(state.buildAuthority.combatants[0]?.narratorIdentity.name).toBe('Historical name')
    expect(projected).not.toHaveProperty('pendingEffects')
  })

  it('keeps self/allied Covert positives but omits an opposing Covert unit’s positive and unknown status rows', () => {
    const authoritative = encounter()
    const before = structuredClone(authoritative.statusState)
    const projected = projectCommittedBattleSession(committed(authoritative), [PLAYER]).snapshot

    expect(rowStatuses(projected, PLAYER).map((entry) => entry.statusId)).toEqual([
      'covert',
      'guarded',
      'copy',
    ])
    expect(rowStatuses(projected, ALLY).map((entry) => entry.statusId)).toEqual([
      'covert',
      'guarded',
      'copy',
    ])
    expect(rowStatuses(projected, ENEMY).map((entry) => entry.statusId)).toEqual(['exposed'])
    expect(rowStatuses(projected, PLAIN_ENEMY).map((entry) => entry.statusId)).toEqual(['guarded'])
    expect(authoritative.statusState).toEqual(before)
    expect(projected.tactical.battle).not.toHaveProperty('rng')
  })

  it('treats spectators as unprivileged without hiding positives on non-Covert units', () => {
    const authoritative = encounter()
    const before = structuredClone(authoritative.statusState)
    const projected = {
      statusState: projectBattleStatusStateForViewer(
        authoritative,
        createSpectatorBattleViewerEntitlement(),
      ),
    }

    expect(rowStatuses(projected, PLAYER)).toEqual([])
    expect(rowStatuses(projected, ALLY)).toEqual([])
    expect(rowStatuses(projected, ENEMY).map((entry) => entry.statusId)).toEqual(['exposed'])
    expect(rowStatuses(projected, PLAIN_ENEMY).map((entry) => entry.statusId)).toEqual(['guarded'])
    expect(authoritative.statusState).toEqual(before)
  })
  it('projects temporary copied Skill identities only to friendly viewers', () => {
    const authoritative = encounter()
    const before = structuredClone(authoritative.effectState)
    const projected = projectCommittedBattleSession(committed(authoritative), [PLAYER]).snapshot

    expect(projected.effectState?.temporarySkills).toEqual([
      expect.objectContaining({ combatantId: PLAYER, skillId: 'vanguard.forceful-strike' }),
      expect.objectContaining({ combatantId: ALLY, skillId: 'vanguard.cleave' }),
    ])

    const spectator = projectBattleEffectStateForViewer(
      authoritative,
      createSpectatorBattleViewerEntitlement(),
    )
    expect(spectator?.temporarySkills).toEqual([])
    expect(authoritative.effectState).toEqual(before)
  })
})

function elevatedEncounter(combatantId: string, elevation: number) {
  const state = encounter() as StatDrivenCombatEncounterState & { statBalancePolicyVersion?: 1 }
  state.statBalancePolicyVersion = 1
  state.statBridge = {
    schemaVersion: 4,
    rulesVersion: 4,
    combatants: state.statBridge.combatants.map((profile) => ({
      ...profile,
      provenance: { ...profile.provenance, sourceRulesVersion: 4 },
      physicalPower: 120,
      mysticPower: 120,
      level: 1,
      criticalChance: 1500,
      statusResistance: 1000,
    })),
  }
  const position = state.tactical.placements.find(
    (row) => row.combatantId === combatantId,
  )!.position
  state.tactical = {
    ...state.tactical,
    tiles: state.tactical.tiles.map((tile) =>
      tile.position.x === position.x && tile.position.y === position.y
        ? { ...tile, elevation }
        : tile,
    ),
  }
  return state
}

it('shows pending icons without exposing queued effect definitions', () => {
  const state = encounter()
  state.effectTimingPolicy = { version: 1, modes: {} }
  state.pendingEffects = [
    {
      actorId: PLAYER,
      actionId: 'test.pending',
      effect: { type: 'apply-status', recipient: 'primary-unit', statusId: 'hexed', stacks: 1 },
      recipientIds: [PLAIN_ENEMY],
      affectedTiles: [],
      activationRound: 2,
      content: {
        statuses: [
          {
            id: 'hexed',
            version: 1,
            maximumStacks: 1,
            durationOwnerTurnStarts: 2,
            damageTakenMultiplierBasisPoints: 10000,
          },
        ],
      },
    },
  ]
  const rows = projectBattleStatusStateForViewer(state, createSpectatorBattleViewerEntitlement())
  expect(rows.find((row) => row.combatantId === PLAIN_ENEMY)?.statuses).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        statusId: 'hexed',
        timingState: 'pending',
        activationRound: 2,
        remainingOwnerTurnEnds: 1,
      }),
    ]),
  )
})

it('keeps active DOT, recovery and barrier icons tied to actual remaining instances', () => {
  const state = encounter()
  state.effectState = {
    ongoingRecovery: [
      {
        kind: 'mp',
        sourceCombatantId: PLAYER,
        targetCombatantId: PLAIN_ENEMY,
        sourceActionId: 'recover',
        amountPerTick: 3,
        remainingFutureTicks: 2,
      },
    ],
    poison: [
      {
        targetCombatantId: PLAIN_ENEMY,
        sourceCombatantId: PLAYER,
        sourceActionId: 'poison',
        profileVersion: 1,
        movementRemainder: 0,
        remainingTicks: 3,
      },
    ],
    bleed: [],
    burn: [],
    temporarySkills: [],
    damageHistory: [],
    barriers: [
      {
        targetCombatantId: PLAIN_ENEMY,
        sourceCombatantId: PLAYER,
        sourceActionId: 'barrier',
        amount: 5,
      },
    ],
  }
  const viewer = createSpectatorBattleViewerEntitlement()
  const rows = projectBattleStatusStateForViewer(state, viewer)
  expect(rows.find((row) => row.combatantId === PLAIN_ENEMY)?.statuses).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        statusId: 'poison',
        timingState: 'active',
        remainingOwnerTurnEnds: 3,
      }),
      expect.objectContaining({
        statusId: 'mp-recovery',
        timingState: 'active',
        remainingOwnerTurnEnds: 2,
      }),
      expect.objectContaining({ statusId: 'barrier', durationScope: 'until-spent' }),
    ]),
  )
  state.effectState.poison = []
  state.effectState.ongoingRecovery = []
  state.effectState.barriers = []
  expect(
    projectBattleStatusStateForViewer(state, viewer)
      .find((row) => row.combatantId === PLAIN_ENEMY)
      ?.statuses.map((row) => row.statusId),
  ).toEqual(['guarded'])
})

it('omits enemy cast identities from persistent live effects independently of history visibility', () => {
  const state = encounter()
  state.effectState = {
    ongoingRecovery: [],
    poison: [
      {
        targetCombatantId: PLAIN_ENEMY,
        sourceCombatantId: PLAYER,
        sourceActionId: 'secret.pinned.skill',
        profileVersion: 1,
        movementRemainder: 0,
      },
    ],
    bleed: [],
    burn: [],
    temporarySkills: [],
    damageHistory: [],
  }
  const before = structuredClone(state.effectState)
  const projected = projectBattleEffectStateForViewer(
    state,
    createSpectatorBattleViewerEntitlement(),
  )
  expect(projected?.poison[0]?.sourceActionId).toBe('combat.effect')
  expect(JSON.stringify(projected)).not.toContain('secret.pinned.skill')
  expect(state.effectState).toEqual(before)
})

it('scrubs concealed enemy provenance even when its debuff holder is self or ally', () => {
  const state = encounter()
  const provenance = createCombatEffectInstanceProvenance({
    action: createCombatActionProvenance({
      rulesetVersion: 4,
      sourceKind: 'discipline-skill',
      actionDefinitionId: 'secret.enemy.cast',
      actionVersion: 1,
      sourceCombatantId: ENEMY,
      controllerCombatantId: ENEMY,
      triggerChainId: 'hidden.cast',
    }),
    targetCombatantId: PLAYER,
    effectOrdinal: 0,
    createdRound: 1,
    createdTurn: 1,
  })
  state.statusState = state.statusState.map((row) =>
    [PLAYER, ALLY].includes(row.combatantId)
      ? { ...row, statuses: [{ ...status('hexed', ENEMY), provenance }] }
      : row,
  )
  const before = structuredClone(state.statusState)
  const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
    PLAYER,
  ])
  const rows = projectBattleStatusStateForViewer(state, viewer)
  for (const id of [PLAYER, ALLY])
    expect(rows.find((row) => row.combatantId === id)?.statuses[0]).not.toHaveProperty('provenance')
  expect(state.statusState).toEqual(before)
})
