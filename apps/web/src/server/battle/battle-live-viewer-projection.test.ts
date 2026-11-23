import { combatAbilityUsageKey } from '@aurevane/game-core/combat/combat-ability-command'
import { applySkillCooldown } from '@aurevane/game-core/combat/skill-cooldowns'
import { readFileSync } from 'node:fs'
import {
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import { capturedMatureSkillAbilitySource } from '@aurevane/game-core/combat/combat-action-source'
import {
  resolveBattleCapturedSkill,
  selectBattleSkillPreviewIntent,
} from '@/components/battle/battle-preview-selection'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
  cancelCombatControlledAbility,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
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
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  omitPendingBattlePayloads,
  omitCombatExecutionMetadata,
  projectBattleManualActionTargets,
  projectBattleEffectStateForViewer,
  projectBattleStatusStateForViewer,
} from './battle-live-viewer-projection'
import { projectCommittedBattleSession, projectBattleSnapshot } from './battle-session-service'
import {
  deriveParticipantBattleViewerEntitlement,
  createSpectatorBattleViewerEntitlement,
} from './battle-viewer-entitlement'

it('omits original copy lifetimes recursively while preserving visible remaining durations', () => {
  const projected = omitCombatExecutionMetadata({
    remainingOwnerTurnEnds: 2,
    originalDurationTurns: 7,
    copyEffectOrdinal: 2,
    applicationModifiers: [{ stacks: 1, remainingOwnerTurnEnds: 2, originalDurationTurns: 7 }],
  })
  expect(projected).toEqual({
    remainingOwnerTurnEnds: 2,
    applicationModifiers: [{ stacks: 1, remainingOwnerTurnEnds: 2 }],
  })
})

it('keeps only the safe total Ruin bonus on a projected damage receipt', () => {
  const receipt = {
    event: 'damage_applied',
    amount: 160,
    ruinBonusBasisPoints: 6000,
    attackTagCapture: {
      capturedDebuffs: { privateTarget: 2 },
      ruinBonusPerDebuffBasisPoints: 3000,
    },
  }
  expect(omitCombatExecutionMetadata(receipt)).toEqual({
    event: 'damage_applied',
    amount: 160,
    ruinBonusBasisPoints: 6000,
  })
  expect(receipt).toHaveProperty('attackTagCapture')
})

it('omits private Ruin identity and consumption ledgers from live snapshots and status applications', () => {
  const receipt = {
    statusId: 'slow',
    stacks: 2,
    ruinApplicationId: 7,
    ruinCommandId: 3,
    applicationModifiers: [{ stacks: 1, ruinApplicationId: 7 }],
  }
  expect(omitCombatExecutionMetadata(receipt)).toEqual({
    statusId: 'slow',
    stacks: 2,
    applicationModifiers: [{ stacks: 1 }],
  })
  const state = {
    tactical: { battle: { lifecycle: 'active', round: 1 } },
    ruinState: {
      version: 1,
      nextApplicationId: 8,
      nextCommandId: 4,
      spentTargets: [{ commandId: 3, targetId: 'privateTarget' }],
    },
  }
  expect(omitPendingBattlePayloads(state as never)).not.toHaveProperty('ruinState')
  expect(state).toHaveProperty('ruinState')
})

it('keeps Ruin application identities private in actual participant and spectator projections', () => {
  const original = encounter()
  const state = {
    ...original,
    ruinState: {
      version: 1,
      nextApplicationId: 8,
      nextCommandId: 4,
      spentTargets: [{ commandId: 3, targetId: ENEMY }],
    },
    statusState: original.statusState.map((row) =>
      row.combatantId === ENEMY
        ? {
            ...row,
            statuses: [
              {
                ...status('slow', PLAYER),
                ruinApplicationId: 7,
                applicationModifiers: [
                  { stacks: 1, sourceCombatantId: PLAYER, ruinApplicationId: 7 },
                ],
              },
            ],
          }
        : row,
    ),
    effectState: {
      ongoingRecovery: [],
      poison: [
        {
          targetCombatantId: ENEMY,
          sourceCombatantId: PLAYER,
          sourceActionId: 'saved.poison',
          profileVersion: 1,
          movementRemainder: 0,
          damagePerTick: 2,
          remainingTicks: 2,
          ruinApplicationId: 6,
        },
      ],
      burn: [],
      bleed: [],
      damageHistory: [],
    },
  } as unknown as StatDrivenCombatEncounterState
  const before = JSON.stringify(state)
  for (const viewer of [
    createSpectatorBattleViewerEntitlement(),
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAYER]),
  ]) {
    const projected = projectBattleSnapshot(state, viewer)
    expect(JSON.stringify(projected)).not.toMatch(
      /ruinApplicationId|ruinCommandId|ruinState|attackTagCapture/,
    )
    expect(projected.statusState.find((row) => row.combatantId === ENEMY)?.statuses).toEqual(
      expect.arrayContaining([expect.objectContaining({ statusId: 'slow' })]),
    )
    expect(projected.effectState?.poison).toHaveLength(1)
  }
  expect(JSON.stringify(state)).toBe(before)
})

it('strips private captured Ability and command execution authority from actual public state', () => {
  const privateState = {
    pendingEffects: [],
    nextReversalAttackCommandId: 12,
    visible: 'yes',
    capturedAbilitySources: [{ definition: { secret: 'private' } }],
    abilityRuntime: { usage: [1] },
    modifierSuppressions: [{ sourceInstanceId: 'private-source', reason: 'insufficient-ap' }],
    nativeBasicAttackCommand: true,
    groundTargetedRecipientIds: ['actor'],
    commandDamageBonuses: [1],
    effectEligibleRecipientIds: [['actor']],
    effectTimingModes: ['delayed'],
  }
  expect(omitPendingBattlePayloads(privateState)).toEqual({ visible: 'yes' })
})

import { battleEffectInformation } from '@/components/battle/battle-effect-information'

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
  it('real committed live projection exposes only controlled active published Manual choices, including a Covert owner', () => {
    const owned = (
      ownerCombatantId: string,
      sourceKind: 'discipline-skill' | 'scenario' = 'discipline-skill',
    ) =>
      captureCombatAbilitySource({
        schemaVersion: 1,
        sourceInstanceId: `private-capture:${sourceKind}:${ownerCombatantId}`,
        ownerCombatantId,
        abilityId: 'owned.ability',
        contentVersion: 7,
        sourceKind,
        sourceDisciplineId: 'vanguard',
        tags: ['attack'],
        definition: {
          schemaVersion: 1,
          behaviors: [
            {
              id: 'manual',
              activation: 'manual',
              mode: 'modifier',
              classification: 'attack',
              attackFamily: 'physical',
              costs: [],
              cooldown: null,
              requirements: null,
              targeting: null,
              effects: [
                {
                  id: 'bonus',
                  payload: {
                    type: 'damage-bonus',
                    recipient: 'actor',
                    multiplierBasisPoints: 11000,
                  },
                },
              ],
            },
          ],
        },
      })
    const own = owned(PLAYER),
      ally = owned(ALLY),
      enemy = owned(ENEMY),
      privateScenario = owned(PLAYER, 'scenario')
    const state = reconcileCombatAbilitySources(encounter(), [
      own,
      ally,
      enemy,
      privateScenario,
    ]) as StatDrivenCombatEncounterState
    const before = JSON.stringify(state)
    const self = projectCommittedBattleSession(committed(state), [PLAYER]).snapshot
    expect(self.manualModifierAvailability).toEqual([
      expect.objectContaining({
        sourceInstanceId: own.sourceInstanceId,
        ownerCombatantId: PLAYER,
        behaviorId: 'manual',
        costs: [],
        abilityId: 'owned.ability',
        contentVersion: 7,
        compatibility: { payloadsSupported: true, requiresExplicitUnit: false },
        report: expect.objectContaining({ effects: expect.any(Array) }),
      }),
    ])
    const opposite = projectCommittedBattleSession(committed(state), [ENEMY]).snapshot
    expect(opposite.manualModifierAvailability).toEqual([
      expect.objectContaining({
        sourceInstanceId: enemy.sourceInstanceId,
        ownerCombatantId: ENEMY,
        ownerEligible: false,
        blockedReasons: ['turn-unavailable'],
      }),
    ])
    expect(
      projectBattleSnapshot(state, createSpectatorBattleViewerEntitlement())
        .manualModifierAvailability,
    ).toEqual([])
    expect(JSON.stringify(self)).not.toContain(ally.sourceInstanceId)
    expect(JSON.stringify(self)).not.toContain(enemy.sourceInstanceId)
    expect(JSON.stringify(self)).not.toContain(privateScenario.sourceInstanceId)
    expect(JSON.stringify(self)).not.toMatch(
      /capturedAbilitySources|abilityRuntime|chanceBasisPoints|requirementSubjects/,
    )
    expect(JSON.stringify(state)).toBe(before)
  })

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

  it('strips pinned narration metadata from public snapshots without mutating history', () => {
    const state = {
      pendingEffects: [],
      nextSkillPacketCommandId: 3,
      turnTriggerState: {
        preparedTurnNumber: 1,
        combatants: [{ combatantId: PLAYER, cycle: 1, usedKeys: ['private.ground.instance'] }],
      },
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
    expect(projected).not.toHaveProperty('nextSkillPacketCommandId')
    expect(projected).not.toHaveProperty('turnTriggerState')
  })

  it('keeps self/allied Covert positives but omits an opposing Covert unit’s positive and unknown status rows', () => {
    const authoritative = encounter()
    const before = structuredClone(authoritative.statusState)
    const projected = projectCommittedBattleSession(committed(authoritative), [PLAYER]).snapshot

    expect(rowStatuses(projected, PLAYER).map((entry) => entry.statusId)).toEqual([
      'covert',
      'guarded',
    ])
    expect(rowStatuses(projected, ALLY).map((entry) => entry.statusId)).toEqual([
      'covert',
      'guarded',
    ])
    expect(rowStatuses(projected, ENEMY).map((entry) => entry.statusId)).toEqual(['exposed'])
    expect(rowStatuses(projected, PLAIN_ENEMY).map((entry) => entry.statusId)).toEqual(['guarded'])
    expect(authoritative.statusState).toEqual(before)
    expect(projected.tactical.battle).not.toHaveProperty('rng')
  })

  it.each(['instant', 'next-round', 'delayed'] as const)(
    'confirms enemy Covert cast using %s timing without disclosing other buffs',
    (timing) => {
      const before = encounter()
      before.effectTimingPolicy = { version: 1, modes: { covert: timing } }
      before.statusState = before.statusState.map((row) => ({
        ...row,
        statuses: row.statuses.filter(
          (status) =>
            PV1F_COMBAT_CONTENT.statuses.some(
              (definition) =>
                definition.id === status.statusId && definition.version === status.statusVersion,
            ) && !(row.combatantId === ENEMY && status.statusId === 'covert'),
        ),
      }))
      const transition = executeCombatAction(
        before,
        {
          id: 'test.enemy-covert',
          version: 1,
          sourceType: 'test',
          tags: [],
          target: {
            kind: 'unit',
            teamPolicy: 'enemy',
            shape: { kind: 'single' },
            minimumRange: 1,
            maximumRange: 3,
            requiresLineOfSight: false,
            maximumElevationDifference: null,
            friendlyFire: 'enemies-only',
          },
          cost: { spendsAction: false, mp: 0 },
          requirements: [],
          effects: [
            {
              type: 'apply-status',
              target: 'enemy',
              recipient: 'affected-units',
              statusId: 'covert',
              stacks: 1,
              durationTurns: 3,
            },
          ],
        },
        { kind: 'unit', combatantId: ENEMY },
        PV1F_COMBAT_CONTENT,
      )
      const authoritative = reattachStatDrivenCombatBridge(transition.state, before.statBridge)
      if (timing === 'instant')
        expect(rowStatuses(authoritative, ENEMY).map((entry) => entry.statusId)).toContain('covert')
      else
        expect(authoritative.pendingEffects).toContainEqual(
          expect.objectContaining({
            recipientIds: [ENEMY],
            effect: expect.objectContaining({ statusId: 'covert' }),
          }),
        )
      const caster = projectCommittedBattleSession(committed(authoritative), [PLAYER]).snapshot
      const ally = projectCommittedBattleSession(committed(authoritative), [ALLY]).snapshot
      const expected =
        timing === 'instant' ? ['covert', 'exposed'] : ['covert', 'exposed', 'guarded']
      expect(
        rowStatuses(caster, ENEMY)
          .map((entry) => entry.statusId)
          .sort(),
      ).toEqual(expected)
      expect(
        rowStatuses(ally, ENEMY)
          .map((entry) => entry.statusId)
          .sort(),
      ).toEqual(expected)
      if (timing !== 'instant')
        expect(
          rowStatuses(caster, ENEMY).find((entry) => entry.statusId === 'covert')?.timingState,
        ).toBe('pending')
      const spectator = projectBattleStatusStateForViewer(
        authoritative,
        createSpectatorBattleViewerEntitlement(),
      )
      expect(
        rowStatuses({ statusState: spectator }, ENEMY)
          .map((entry) => entry.statusId)
          .sort(),
      ).toEqual(timing === 'instant' ? ['exposed'] : ['exposed', 'guarded'])
    },
  )

  it.each([
    [PLAYER, ENEMY],
    [ENEMY, PLAYER],
  ])('confirms only the known Covert application for source order %s then %s', (first, last) => {
    const state = encounter()
    state.effectStackingPolicyVersion = 1
    state.statusState = state.statusState.map((row) =>
      row.combatantId !== ENEMY
        ? row
        : {
            ...row,
            statuses: [
              {
                ...status('covert', last, 99),
                stacks: 2,
                originalDurationTurns: 99,
                applicationModifiers: [
                  {
                    stacks: 1,
                    sourceCombatantId: first,
                    originalDurationTurns: first === PLAYER ? 3 : 99,
                  },
                  {
                    stacks: 1,
                    sourceCombatantId: last,
                    originalDurationTurns: last === PLAYER ? 3 : 99,
                  },
                ],
              },
              status('guarded', ENEMY),
              status('exposed', PLAYER),
            ],
          },
    )
    state.statusState = state.statusState.map((row) => ({
      ...row,
      statuses: [...row.statuses].sort((a, b) => a.statusId.localeCompare(b.statusId)),
    }))
    expect(validateStatDrivenCombatEncounterState(state)).toEqual([])
    const before = structuredClone(state.statusState)
    const projected = projectCommittedBattleSession(committed(state), [PLAYER]).snapshot
    const known = rowStatuses(projected, ENEMY).find((entry) => entry.statusId === 'covert')
    expect(known).toMatchObject({
      statusId: 'covert',
      statusVersion: 1,
      sourceCombatantId: PLAYER,
      stacks: 1,
      remainingOwnerTurnStarts: 1,
      presentationDuration: 'while-active',
    })
    expect(known).not.toHaveProperty('applicationModifiers')
    expect(known).not.toHaveProperty('originalDurationTurns')
    expect(known).not.toHaveProperty('remainingOwnerTurnEnds')
    expect(known).not.toHaveProperty('remainingRoundBoundaries')
    expect(battleEffectInformation(known!).duration).toBe('Active')
    expect(rowStatuses(projected, ENEMY).map((entry) => entry.statusId)).not.toContain('guarded')
    const spectator = projectBattleStatusStateForViewer(
      state,
      createSpectatorBattleViewerEntitlement(),
    )
    expect(rowStatuses({ statusState: spectator }, ENEMY).map((entry) => entry.statusId)).toEqual([
      'exposed',
    ])
    expect(state.statusState).toEqual(before)
  })

  it('keeps known enemy Covert visible while its caster has a protected pending self refresh', () => {
    const state = encounter()
    state.effectStackingPolicyVersion = 1
    state.effectTimingPolicy = { version: 1, modes: { covert: 'next-round' } }
    const visibility = { kind: 'team-only' as const, teamId: 'team:a' }
    state.statusState = state.statusState.map((row) =>
      row.combatantId !== ENEMY
        ? row
        : {
            ...row,
            statuses: [
              {
                ...status('covert', PLAYER, 99),
                sourceCommandVisibility: visibility,
                applicationModifiers: [
                  {
                    stacks: 1,
                    sourceCombatantId: PLAYER,
                    originalDurationTurns: 3,
                    privateSharedLifetime: true,
                    sourceCommandVisibility: visibility,
                  },
                ],
              },
              status('guarded', ENEMY),
            ],
          },
    )
    state.pendingEffects = [
      {
        actorId: PLAYER,
        actionId: 'protected.covert',
        recipientIds: [PLAYER],
        affectedTiles: [],
        effect: { type: 'apply-status', recipient: 'actor', statusId: 'covert', stacks: 1 },
        activationRound: 2,
        content: PV1F_COMBAT_CONTENT,
        sourceCommandVisibility: visibility,
      },
    ]
    state.statusState = state.statusState.map((row) => ({
      ...row,
      statuses: [...row.statuses].sort((a, b) => a.statusId.localeCompare(b.statusId)),
    }))
    expect(validateStatDrivenCombatEncounterState(state)).toEqual([])
    const projected = projectCommittedBattleSession(committed(state), [PLAYER]).snapshot
    const known = rowStatuses(projected, ENEMY)
    expect(known).toHaveLength(1)
    expect(known[0]).toMatchObject({
      statusId: 'covert',
      stacks: 1,
      sourceCombatantId: PLAYER,
      presentationDuration: 'while-active',
    })
    expect(battleEffectInformation(known[0]!).duration).toBe('Active')
    expect(known[0]).not.toHaveProperty('applicationModifiers')
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

  it('keeps pending Covert private without activating concealment before its round', () => {
    const state = encounter()
    state.pendingEffects = [
      {
        actorId: PLAIN_ENEMY,
        actionId: 'secret.smoke',
        recipientIds: [PLAIN_ENEMY],
        affectedTiles: [],
        effect: { type: 'apply-status', recipient: 'actor', statusId: 'covert', stacks: 1 },
        activationRound: 2,
        content: PV1F_COMBAT_CONTENT,
      },
    ]
    const owner = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
      PLAIN_ENEMY,
    ])
    expect(
      projectBattleStatusStateForViewer(state, owner).find((row) => row.combatantId === PLAIN_ENEMY)
        ?.statuses,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ statusId: 'covert', timingState: 'pending' }),
      ]),
    )
    for (const viewer of [
      deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAYER]),
      createSpectatorBattleViewerEntitlement(),
    ]) {
      expect(
        projectBattleStatusStateForViewer(state, viewer)
          .find((row) => row.combatantId === PLAIN_ENEMY)
          ?.statuses.map((row) => row.statusId),
      ).toEqual(['guarded'])
    }
  })

  it('omits a concealed queued Summon while keeping an earlier public Summon and owner/allied rows', () => {
    const state = encounter()
    const profile = resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!
    state.pendingSummons = ['public.call', 'secret.call'].map((sourceSkillId, index) => ({
      input: {
        ownerCombatantId: PLAIN_ENEMY,
        sourceSkillId,
        sourceSkillVersion: 1,
        profile,
        position: { x: 0, y: 0 },
        facing: 'east',
      },
      activationRound: 2,
      ...(index
        ? { sourceCommandVisibility: { kind: 'team-only' as const, teamId: 'team:b' } }
        : {}),
    }))
    for (const id of [PLAIN_ENEMY, ENEMY]) {
      const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
        id,
      ])
      expect(
        projectBattleStatusStateForViewer(state, viewer)
          .find((row) => row.combatantId === PLAIN_ENEMY)!
          .statuses.filter((row) => row.statusId === 'summon'),
      ).toHaveLength(2)
    }
    for (const viewer of [
      deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAYER]),
      createSpectatorBattleViewerEntitlement(),
    ]) {
      expect(
        projectBattleStatusStateForViewer(state, viewer)
          .find((row) => row.combatantId === PLAIN_ENEMY)!
          .statuses.filter((row) => row.statusId === 'summon'),
      ).toHaveLength(1)
    }
  })

  it('retains the recipient’s own queued benefit without exposing an opposing concealed source Skill', () => {
    const state = encounter()
    state.pendingEffects = [
      {
        actorId: ENEMY,
        actionId: 'secret.opposing-buff',
        recipientIds: [PLAYER],
        affectedTiles: [],
        effect: {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'inspired',
          stacks: 1,
        },
        activationRound: 2,
        content: PV1F_COMBAT_CONTENT,
        sourceCommandVisibility: { kind: 'team-only', teamId: 'team:b' },
      },
    ]
    const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
      PLAYER,
    ])
    const projected = projectBattleStatusStateForViewer(state, viewer)
    expect(projected.find((row) => row.combatantId === PLAYER)!.statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ statusId: 'inspired', timingState: 'pending' }),
      ]),
    )
    expect(JSON.stringify(projected)).not.toContain('secret.opposing-buff')
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

it.each([1, undefined] as const)(
  'shows pending icons with recovery policy %s without exposing queued definitions',
  (policy) => {
    const state = encounter()
    state.effectTimingPolicy = { version: 1, modes: {} }
    state.healingDownPolicyVersion = policy
    state.statusState = state.statusState.map((row) =>
      row.combatantId === PLAYER
        ? { ...row, statuses: [...row.statuses, status('hexed', ENEMY)] }
        : row,
    )
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
    for (const id of [PLAYER, PLAIN_ENEMY])
      expect(
        rows
          .find((row) => row.combatantId === id)
          ?.statuses.find((item) => item.statusId === 'hexed')?.healingDownPolicyVersion,
      ).toBe(policy)
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
  },
)

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

it('retains public captured tick values while hiding a hostile DoT Skill identity', () => {
  const state = encounter()
  state.effectState!.poison = [
    {
      targetCombatantId: PLAYER,
      sourceCombatantId: ENEMY,
      sourceActionId: 'secret.pinned.skill',
      profileVersion: 1,
      movementRemainder: 0,
      remainingTicks: 4,
      percentageDamage: {
        capturedDamage: 40,
        profile: { kind: 'attack-percentage', basisPoints: 1500 },
      },
    },
  ]
  for (const viewer of [
    createSpectatorBattleViewerEntitlement(),
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAYER]),
  ]) {
    const projected = projectBattleEffectStateForViewer(state, viewer)
    expect(projected?.poison[0]?.percentageDamage).toEqual(
      state.effectState!.poison[0]!.percentageDamage,
    )
    expect(projected?.poison[0]?.sourceActionId).toBe('combat.effect')
    expect(JSON.stringify(projected)).not.toContain('secret.pinned.skill')
  }
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

it('projects captured Basic Attack geometry under its actual command identity without private definitions', () => {
  const base = encounter()
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(
      base,
      captureBasicSkillSources({
        ownerCombatantId: PLAYER,
        supportActionId: 'basic.recover',
        definitions: defaultBasicSkills().map((definition) => ({
          ...definition,
          presentation: {
            public: '{ability} full explanation.',
            compact: '{ability} compact explanation.',
          },
        })),
      }),
    ),
    base.statBridge,
  )
  const view = projectBattleSnapshot(
    state,
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAYER]),
  )
  expect(
    view.basicActions?.find((action) => action.actionId === 'basic.attack.unarmed.basic'),
  ).toMatchObject({
    description: 'Basic Attack full explanation.',
    compactText: 'Basic Attack compact explanation.',
  })
  expect(view.manualActionTargets).toContainEqual(
    expect.objectContaining({ actionId: 'basic.attack.unarmed.basic', behaviorId: 'use' }),
  )
  expect(view.manualActionTargets?.some((row) => row.actionId === 'unarmed.basic')).toBe(false)
  expect(JSON.stringify(view)).not.toMatch(
    /capturedAbilitySources|sourceInstanceId|scalingBasisPoints/,
  )
})

function controlledProjectionState(configured = false) {
  const owned = (ownerCombatantId: string) =>
    captureCombatAbilitySource({
      schemaVersion: 1,
      sourceInstanceId: `private-controlled:${ownerCombatantId}`,
      ownerCombatantId,
      abilityId: 'chronist.private-step',
      contentVersion: 7,
      sourceKind: 'discipline-skill',
      sourceDisciplineId: 'chronist',
      tags: [],
      definition: {
        schemaVersion: 1,
        behaviors: ['step', 'alternate'].map((id) => ({
          id,
          activation: 'manual' as const,
          mode: 'action' as const,
          classification: 'utility' as const,
          costs: [{ resource: 'mp' as const, amount: 999 }],
          cooldown: null,
          requirements: {
            kind: 'resource-state' as const,
            subject: 'owner' as const,
            resource: 'hp' as const,
            comparison: 'at-least' as const,
            amount: 9999,
          },
          targeting: {
            kind: 'self' as const,
            teamPolicy: 'self' as const,
            friendlyFire: 'allies-only' as const,
            shape: { kind: 'single' as const },
            minimumRange: 0,
            maximumRange: 0,
            maximumSelections: 1,
            maximumElevationDifference: null,
            requiresLineOfSight: false,
          },
          effects: [
            {
              id: 'rewind',
              ...(configured ? {} : { timing: 'controlled' as const }),
              payload: {
                type: 'return-to-turn-start' as const,
                recipient: 'actor' as const,
                anchorMode: 'cast-position' as const,
              },
            },
          ],
        })),
      },
    })
  const captures = [PLAYER, ALLY, ENEMY].map(owned)
  const base = encounter()
  return {
    captures,
    state: reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources(
        {
          ...base,
          ...(configured
            ? {
                effectTimingPolicy: {
                  version: 12,
                  modes: { 'return-to-turn-start': 'controlled' as const },
                },
              }
            : {}),
        },
        captures,
      ),
      base.statBridge,
    ),
  }
}

it.each([false, true])(
  'projects only owner Controlled command state without private anchor or conditions (configured=%s)',
  (configured) => {
    const { state, captures } = controlledProjectionState(configured)
    const own = captures[0]!
    const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
      PLAYER,
    ])
    const rows = projectBattleSnapshot(state, viewer).manualActionTargets!
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.behaviorId === 'step')).toMatchObject({
      actionId: own.abilityId,
      behaviorId: 'step',
      controlled: { phase: 'unprimed', canPrime: true, canCancel: false },
    })
    const before = JSON.stringify(state)
    projectBattleSnapshot(state, viewer)
    expect(JSON.stringify(state)).toBe(before)
    const primed = primeCombatControlledAbility({
      state,
      actorId: PLAYER,
      sourceInstanceId: own.sourceInstanceId,
      behaviorId: 'step',
    }).state as StatDrivenCombatEncounterState
    const restored = JSON.parse(JSON.stringify(primed)) as StatDrivenCombatEncounterState
    const publicView = projectBattleSnapshot(restored, viewer)
    expect(publicView.manualActionTargets).toEqual([
      expect.objectContaining({
        behaviorId: 'alternate',
        controlled: { phase: 'spent', canPrime: false, canCancel: false },
      }),
      expect.objectContaining({
        behaviorId: 'step',
        controlled: { phase: 'primed', canPrime: false, canCancel: true },
      }),
    ])
    expect(JSON.stringify(publicView)).not.toMatch(
      /private-controlled|returnAnchor|conditionTruth|"requirements"|contentVersion":7/,
    )
    expect(Object.fromEntries(publicView.manualActionTargets![0]!.report!.rows).Requirements).toBe(
      'HP [≥ 9999] [Self]',
    )
    const cancelled = cancelCombatControlledAbility({
      state: primed,
      actorId: PLAYER,
      sourceInstanceId: own.sourceInstanceId,
      behaviorId: 'step',
    }).state as StatDrivenCombatEncounterState
    expect(projectBattleSnapshot(cancelled, viewer).manualActionTargets?.[0]).toMatchObject({
      controlled: { phase: 'spent', canPrime: false, canCancel: false },
    })
    expect(
      projectBattleSnapshot(
        primed,
        deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [ALLY]),
      ).manualActionTargets,
    ).toEqual([
      expect.objectContaining({
        controlled: { phase: 'unprimed', canPrime: false, canCancel: false },
      }),
      expect.objectContaining({
        controlled: { phase: 'unprimed', canPrime: false, canCancel: false },
      }),
    ])
    expect(
      projectBattleSnapshot(primed, createSpectatorBattleViewerEntitlement()).manualActionTargets,
    ).toEqual([])
  },
)

// A captured non-Move action must expose the same payment/cooldown used by execution.
it('projects owner-scoped typed costs and cooldowns for every Manual group without leaking execution', () => {
  const { state, captures } = controlledProjectionState()
  const owned = captures[0]!
  const edited = {
    ...owned,
    definition: {
      ...owned.definition,
      behaviors: owned.definition.behaviors.map((behavior) => ({
        ...behavior,
        costs: [
          { resource: 'ap' as const, amount: 11 },
          { resource: 'mp' as const, amount: 2 },
          { resource: 'hp' as const, amount: 1 },
        ],
        cooldown: { key: 'captured-only', ownerTurns: 3 },
      })),
    },
  }
  const captured = { ...state, capturedAbilitySources: [edited, ...captures.slice(1)] }
  const before = JSON.stringify(captured)
  const view = projectBattleSnapshot(
    captured,
    deriveParticipantBattleViewerEntitlement(captured.tactical.battle.combatants, [PLAYER]),
  )
  expect(view.manualActionTargets).toHaveLength(2)
  for (const row of view.manualActionTargets!)
    expect(row).toMatchObject({
      ownerCombatantId: PLAYER,
      costs: edited.definition.behaviors[0]!.costs,
      cooldown: { key: 'captured-only', ownerTurns: 3 },
    })
  expect(JSON.stringify(view.manualActionTargets)).not.toMatch(
    /accuracy|requirements|private-controlled|returnAnchor/,
  )
  expect(JSON.stringify(captured)).toBe(before)
})

it('projects a detached complete report from the actual owner Manual capture without private accuracy or payloads', () => {
  const base = encounter()
  const behavior = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability
    .behaviors[0]!
  const source = captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: 'private-report-source',
    ownerCombatantId: PLAYER,
    abilityId: 'fixture.precise-strike',
    contentVersion: 73,
    sourceKind: 'discipline-skill',
    sourceDisciplineId: 'vanguard',
    tags: ['attack'],
    definition: {
      schemaVersion: 1,
      behaviors: [
        {
          ...behavior,
          id: 'precise',
          costs: [
            { resource: 'ap', amount: 7 },
            { resource: 'mp', amount: 3 },
            { resource: 'hp', amount: 2 },
          ],
          cooldown: { key: 'captured-report', ownerTurns: 3 },
          activationLimits: ['once-per-round'],
          accuracy: { kind: 'fixed', chanceBasisPoints: 7777 },
          requirements: {
            kind: 'resource-state',
            subject: 'owner',
            resource: 'mp',
            comparison: 'at-least',
            amount: 3,
          },
          targeting: {
            ...behavior.targeting!,
            maximumRange: 4,
            maximumSelections: 2,
            geometryVersion: 3,
            categories: ['enemy'],
          },
          effects: [
            { id: 'move', payload: { type: 'move', recipient: 'actor', maximumTiles: 2 } },
            {
              id: 'hit',
              timing: 'controlled',
              payload: { type: 'damage', recipient: 'affected-units', amount: 13 },
            },
          ],
        },
      ],
    },
  })
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(base, [source]),
    base.statBridge,
  )
  const before = JSON.stringify(state)
  const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
    PLAYER,
  ])
  const rows = projectBattleManualActionTargets(state, viewer)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toHaveProperty('report')
  const report = rows[0]!.report!
  expect(report.rows.map(([label]) => label)).toEqual([
    'Skill Type',
    'Cost',
    'Cooldown',
    'Requirements',
    'Effects',
    'Target Method',
    'Target Elevation',
    'Line of Sight',
  ])
  expect(Object.fromEntries(report.rows)).toMatchObject({
    Cost: '7 AP / 3 MP / 2 HP',
    Cooldown: '3 turns',
    Requirements: 'MP [≥ 3] [Self]',
    'Target Method': 'Single [4]',
  })
  expect(report.targetMethodExplanation).toContain('Up to 2 distinct targets')
  expect(report.effects.map((effect) => effect.parts.label)).toEqual(['Move', 'Dmg'])
  expect(report.effects[1]!.parts).toMatchObject({
    magnitude: '13',
    timing: 'Controlled',
    target: 'Enemy',
  })
  expect(report.limits).toEqual(['Once per round'])
  expect(JSON.stringify(report)).not.toMatch(
    /accuracy|chanceBasisPoints|payload|private-report-source|sourceInstanceId/,
  )
  expect(projectBattleManualActionTargets(state, createSpectatorBattleViewerEntitlement())).toEqual(
    [],
  )
  Object.assign(report.effects[0]!.parts, { label: 'Local edit' })
  expect(projectBattleManualActionTargets(state, viewer)[0]!.report!.effects[0]!.parts.label).toBe(
    'Move',
  )
  expect(JSON.stringify(state)).toBe(before)
})

it('derives report descriptions from the encounter elemental pin rather than current global defaults', () => {
  const base = encounter()
  const behavior = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability
    .behaviors[0]!
  const source = captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: 'private-fire-report',
    ownerCombatantId: PLAYER,
    abilityId: 'fixture.fire-report',
    contentVersion: 1,
    sourceKind: 'discipline-skill',
    tags: ['attack'],
    definition: {
      schemaVersion: 1,
      behaviors: [
        {
          ...behavior,
          effects: [
            {
              id: 'hit',
              payload: { type: 'damage', recipient: 'primary-unit', amount: 13, element: 'fire' },
            },
            {
              id: 'thaw',
              payload: { type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] },
            },
          ],
        },
      ],
    },
  })
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(base, [source]),
    base.statBridge,
  )
  const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
    PLAYER,
  ])
  const old = projectBattleManualActionTargets(state, viewer)[0]!.report!
  const current = projectBattleManualActionTargets(
    { ...state, elementalDamagePolicyVersion: 2 },
    viewer,
  )[0]!.report!
  expect(old.effectDescriptions[0]).not.toContain('removes Wet and Frozen')
  expect(old.effectDescriptions[0]).toContain('two round boundaries')
  expect(current.effectDescriptions[0]).not.toContain('removes Wet and Frozen')
})

it('recursively removes private hit authoring from composed snapshot metadata without removing combat stats or forecasts', () => {
  const base = encounter()
  const state = {
    ...base,
    presentation: {
      nested: [
        {
          definition: {
            accuracyRule: { kind: 'fixed', chanceBasisPoints: 7777 },
            accuracyMode: 'per-target',
            accuracyModifierBasisPoints: 88,
            ability: { behaviors: [{ accuracy: { kind: 'standard' } }] },
          },
        },
      ],
      forecast: { hitChanceBasisPoints: 6400 },
      proc: { chanceBasisPoints: 2500 },
    },
  }
  expectTypeOf<
    Extract<
      keyof ReturnType<typeof projectBattleSnapshot>,
      'capturedAbilitySources' | 'abilityRuntime' | 'pendingEffects' | 'pendingSummons'
    >
  >().toEqualTypeOf<never>()
  const before = JSON.stringify(state)
  for (const viewer of [
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAYER]),
    createSpectatorBattleViewerEntitlement(),
  ]) {
    const result = projectBattleSnapshot(state, viewer)
    expect(JSON.stringify(result)).not.toMatch(
      /accuracyRule|accuracyMode|accuracyModifierBasisPoints|7777|"accuracy":\{/,
    )
    expect(result.statBridge.combatants[0]!.accuracy).toBe(10000)
    expect(result).toHaveProperty('presentation.forecast.hitChanceBasisPoints', 6400)
    expect(result).toHaveProperty('presentation.proc.chanceBasisPoints', 2500)
  }
  expect(JSON.stringify(state)).toBe(before)
})

it.each([undefined, 1, 2] as const)(
  'actual proposed Flame Burst keeps captured player Enemy/Ground intent under policy %s',
  (policy) => {
    const rows: { id: string; after: MatureSkillDefinition }[] = JSON.parse(
      readFileSync(
        new URL(
          '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ).records
    const definition = rows.find((row) => row.id === 'cinderweaver.flame-burst')!.after
    const base = { ...encounter(), elementalDamagePolicyVersion: policy }
    const source = capturedMatureSkillAbilitySource(base, definition, PLAYER)!
    const state = reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources(base, [source]),
      base.statBridge,
    )
    const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
      PLAYER,
    ])
    const before = JSON.stringify(state)
    const choices = projectBattleManualActionTargets(state, viewer)
    // Deliberately stale native presentation must not supply captured capability.
    const skill = resolveBattleCapturedSkill(
      {
        id: definition.id,
        targetKind: 'self',
        targetTeamPolicy: 'self',
        minimumRange: 0,
        maximumRange: 0,
        groundIntentCapable: false,
      },
      choices,
    )!
    expect(skill.groundIntentCapable).toBe(policy === 2)
    const combatants = state.tactical.placements.map((placement) => ({
      combatantId: placement.combatantId,
      position: placement.position,
      hp: 100,
      teamIndex: [PLAYER, ALLY].includes(placement.combatantId) ? 0 : 1,
    }))
    const selected = {
      actorId: PLAYER,
      selectedCombatantId: null,
      selectedTile: { x: 0, y: 0 },
      combatants,
    }
    expect(selectBattleSkillPreviewIntent(skill, selected)?.target).toEqual({
      kind: 'activate',
      ...(policy === 2 ? { ground: true } : {}),
    })
    expect(
      selectBattleSkillPreviewIntent(skill, {
        ...selected,
        selectedCombatantId: ENEMY,
        selectedTile: { x: 2, y: 0 },
      })?.target,
    ).toEqual({ kind: 'activate' })
    expect(
      projectBattleManualActionTargets(state, createSpectatorBattleViewerEntitlement()),
    ).toEqual([])
    expect(JSON.stringify(choices)).not.toMatch(
      /"(?:chanceBasisPoints|effectOrigins|sourceInstanceId|caster)"\s*:/,
    )
    expect(JSON.stringify(state)).toBe(before)
  },
)

it('carries the captured application-stacking policy into public instance readers without changing legacy snapshots', () => {
  const old = encounter()
  old.statusState = old.statusState.map((row) =>
    row.combatantId === PLAYER
      ? {
          ...row,
          statuses: [
            {
              ...status('guarded', PLAYER),
              stacks: 2,
              potencyBasisPoints: 1000,
              applicationModifiers: [
                { stacks: 1, sourceCombatantId: PLAYER, potencyBasisPoints: 1000 },
                { stacks: 1, sourceCombatantId: PLAYER, potencyBasisPoints: 2000 },
              ],
            },
          ],
        }
      : row,
  )
  const current = { ...old, effectStackingPolicyVersion: 1 as const }
  const before = JSON.stringify(current)
  const viewer = createSpectatorBattleViewerEntitlement()
  const now = projectBattleStatusStateForViewer(current, viewer)
    .find((row) => row.combatantId === PLAYER)!
    .statuses.find((row) => row.statusId === 'guarded')!
  expect(now).toMatchObject({ effectStackingPolicyVersion: 1, stacks: 2 })
  expect(battleEffectInformation(now).incoming).toBe('−28%')
  const legacy = projectBattleStatusStateForViewer(old, viewer)
    .find((row) => row.combatantId === PLAYER)!
    .statuses.find((row) => row.statusId === 'guarded')!
  expect(battleEffectInformation(legacy).incoming).toBe('−19%')
  expect(
    projectBattleStatusStateForViewer(old, viewer).find((row) => row.combatantId === PLAYER)!
      .statuses[0],
  ).not.toHaveProperty('effectStackingPolicyVersion')
  expect(JSON.stringify(current)).toBe(before)
})

it('projects a global Controlled cooldown as unavailable for free preparation without a false Primed overlay', () => {
  const initial = controlledProjectionState()
  const captures = initial.captures.map((source) =>
    captureCombatAbilitySource({
      ...source,
      definition: {
        ...source.definition,
        behaviors: source.definition.behaviors.map((behavior) => ({
          ...behavior,
          cooldown: { key: 'chronist.private-step', ownerTurns: 3 },
        })),
      },
    }),
  )
  const state = reconcileCombatAbilitySources(
    {
      ...initial.state,
      capturedAbilitySources: undefined,
      abilityRuntime: undefined,
      effectTimingPolicy: {
        version: 8,
        tagAuthority: 'global',
        modes: { 'return-to-turn-start': 'controlled' },
      },
      tactical: {
        ...initial.state.tactical,
        battle: {
          ...initial.state.tactical.battle,
          combatants: initial.state.tactical.battle.combatants.map((unit) =>
            unit.id === PLAYER
              ? applySkillCooldown(
                  unit,
                  { key: 'chronist.private-step', ownerTurns: 3 },
                  { actionId: 'chronist.private-step', definitionVersion: 7 },
                ).combatant
              : unit,
          ),
        },
      },
    },
    captures,
  ) as StatDrivenCombatEncounterState
  const before = JSON.stringify(state)
  const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
    PLAYER,
  ])
  const rows = projectBattleSnapshot(state, viewer).manualActionTargets!
  expect(rows).toHaveLength(2)
  for (const row of rows)
    expect(row.controlled).toEqual({ phase: 'unprimed', canPrime: false, canCancel: false })
  expect(() =>
    primeCombatControlledAbility({
      state,
      actorId: PLAYER,
      sourceInstanceId: captures[0]!.sourceInstanceId,
      behaviorId: 'step',
    }),
  ).toThrow('controlled-cooldown-active')
  expect(JSON.stringify(state)).toBe(before)
})

it('derives an amber Primed rail tag from real Controlled state without publishing private ability facts', () => {
  const { state, captures } = controlledProjectionState()
  const own = captures[0]!
  const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
    PLAYER,
  ])
  const primed = primeCombatControlledAbility({
    state,
    actorId: PLAYER,
    sourceInstanceId: own.sourceInstanceId,
    behaviorId: 'step',
  }).state as StatDrivenCombatEncounterState
  const projected = projectBattleStatusStateForViewer(primed, viewer).find(
    (row) => row.combatantId === PLAYER,
  )!
  const marker = projected.statuses.find((row) => row.statusId === 'primed')
  expect(marker).toMatchObject({
    presentationDuration: 'while-primed',
    timingState: 'active',
    stacks: 1,
  })
  const report = battleEffectInformation(marker!)
  expect(report).toMatchObject({
    label: 'Primed',
    identifier: 'PRI',
    timing: 'Primed',
    timingState: 'primed',
    count: null,
  })
  expect(report.description).toContain('Controlled')
  expect(report.description).not.toMatch(/private-controlled|returnAnchor|contentVersion/)
  const html = JSON.stringify(marker)
  expect(html).not.toMatch(/private-controlled|returnAnchor|behaviorId|abilityId|contentVersion/)
  expect(
    projectBattleStatusStateForViewer(primed, createSpectatorBattleViewerEntitlement())
      .flatMap((row) => row.statuses)
      .some((row) => row.statusId === 'primed'),
  ).toBe(false)
  const enemy = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [ENEMY])
  expect(
    projectBattleStatusStateForViewer(primed, enemy)
      .flatMap((row) => row.statuses)
      .some((row) => row.statusId === 'primed'),
  ).toBe(false)
  const cancelled = cancelCombatControlledAbility({
    state: primed,
    actorId: PLAYER,
    sourceInstanceId: own.sourceInstanceId,
    behaviorId: 'step',
  }).state as StatDrivenCombatEncounterState
  expect(
    projectBattleStatusStateForViewer(cancelled, viewer)
      .flatMap((row) => row.statuses)
      .some((row) => row.statusId === 'primed'),
  ).toBe(false)
})

it('composed battle transport includes only controlled captured Tag wording and recursively strips private authoring fields', () => {
  const state = encounter()
  const tags = [
    {
      contentKey: 'tag.percentage-recovery',
      contentVersion: 2,
      tagId: 'percentage-recovery',
      name: 'Renewal',
      compact: 'Restore MP.',
      full: 'Restore a percentage of maximum MP.',
    },
  ]
  const sources = [PLAYER, ENEMY].flatMap((ownerCombatantId) =>
    captureBasicSkillSources({
      ownerCombatantId,
      definitions: defaultBasicSkills(),
      supportActionId: 'basic.recover.mp',
    }).filter((source) => source.abilityId === 'basic.recover.mp'),
  )
  // Stored data can contain additional unknown nested fields; project the fully composed envelope.
  state.capturedAbilitySources = sources.map((captured) => ({
    ...captured,
    definition: {
      ...captured.definition,
      tagPresentation: tags.map((tag) => ({
        ...tag,
        accuracy: { kind: 'fixed', chanceBasisPoints: 6100 },
        nested: {
          accuracyMode: 'fixed',
          accuracyRule: { kind: 'fixed', chanceBasisPoints: 6100 },
          hp: 12,
        },
      })),
    },
  })) as typeof state.capturedAbilitySources
  const publicView = projectBattleSnapshot(
    state,
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAYER]),
  )
  expect(publicView.tagPresentations).toHaveLength(1)
  expect(publicView.tagPresentations?.[0]).toMatchObject({
    ownerCombatantId: PLAYER,
    tags: [{ name: 'Renewal', nested: { hp: 12 } }],
  })
  expect(JSON.stringify(publicView.tagPresentations)).not.toMatch(/accuracy|chanceBasisPoints|6100/)
  expect(
    projectBattleSnapshot(state, createSpectatorBattleViewerEntitlement()).tagPresentations,
  ).toEqual([])
})

it('projects only admitted short wording for visible statuses without leaking the catalogue or changing state', () => {
  const state = encounter()
  state.statusState[0]!.statuses = [
    {
      statusId: 'guarded',
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: PLAYER,
    },
  ]
  const words = {
    contentKey: 'tag.guarded',
    contentVersion: 3,
    tagId: 'guarded',
    name: 'Guard',
    compact: 'Short captured Guard.',
    full: 'Private full Manager wording.',
  }
  const captured = {
    ...state,
    buildAuthority: {
      schemaVersion: 1 as const,
      combatContext: 'pve' as const,
      combatants: [],
      tagPresentations: [
        words,
        {
          ...words,
          contentKey: 'tag.copy-debuffs',
          tagId: 'copy-debuffs',
          compact: 'Unrelated tag.',
        },
      ],
    },
  }
  const before = JSON.stringify(captured)
  const rows = projectBattleStatusStateForViewer(
    captured,
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAYER]),
  )
  expect(rows[0]!.statuses[0]).toHaveProperty('battleTag', {
    tagId: 'guarded',
    contentVersion: 3,
    name: 'Guard',
    compact: 'Short captured Guard.',
  })
  expect(JSON.stringify(rows)).not.toContain('Private full Manager wording.')
  expect(JSON.stringify(rows)).not.toContain('Unrelated tag.')
  expect(JSON.stringify(captured)).toBe(before)
})

it('omits private Counter settlement rates from public damage receipts', () => {
  const receipt = { event: 'damage_applied', amount: 7, counterReturnBasisPoints: '17500' }
  expect(omitCombatExecutionMetadata(receipt)).toEqual({ event: 'damage_applied', amount: 7 })
  expect(receipt.counterReturnBasisPoints).toBe('17500')
})

it('retains exact pending Chilled-only captured wording beside a generic Conditional Cleanse sibling', () => {
  const state = encounter()
  state.pendingEffects = [
    {
      actorId: PLAYER,
      actionId: 'saved.chilled-cleanse',
      recipientIds: [PLAYER],
      affectedTiles: [],
      effect: { type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] },
      activationRound: 2,
      content: PV1F_COMBAT_CONTENT,
    },
  ]
  const words = {
    contentKey: 'tag.cleanse-chilled',
    contentVersion: 7,
    tagId: 'cleanse-chilled',
    name: 'Thawing Ember',
    compact: 'Saved compact Chilled-only text.',
    full: 'Saved full Chilled-only text.',
  }
  const captured = {
    ...state,
    buildAuthority: {
      schemaVersion: 1 as const,
      combatContext: 'pve' as const,
      combatants: [],
      tagPresentations: [
        {
          ...words,
          contentKey: 'tag.conditional-cleanse',
          tagId: 'conditional-cleanse',
          name: 'Other Cleanse',
          compact: 'Wrong sibling.',
        },
        words,
      ],
    },
  }
  const before = JSON.stringify(captured)
  const rows = projectBattleStatusStateForViewer(
    captured,
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAYER]),
  )
  expect(rows.find((row) => row.combatantId === PLAYER)!.statuses).toContainEqual(
    expect.objectContaining({
      statusId: 'remove-status',
      timingState: 'pending',
      battleTag: {
        tagId: 'cleanse-chilled',
        contentVersion: 7,
        name: 'Thawing Ember',
        compact: 'Saved compact Chilled-only text.',
      },
    }),
  )
  expect(JSON.stringify(rows)).not.toContain('Wrong sibling.')
  expect(JSON.stringify(captured)).toBe(before)
})

it('retains a captured stationary summon flag in public effect state', () => {
  const state = encounter()
  state.effectState!.summons = [
    {
      combatantId: ALLY,
      ownerCombatantId: PLAYER,
      sourceSkillId: 'wildwarden.renewing-herbs',
      sourceSkillVersion: 1,
      spawnedRound: 1,
      turnsCompleted: 0,
      profile: {
        ...resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!,
        neverMoves: true,
      },
    },
  ]
  const projected = projectBattleEffectStateForViewer(
    state,
    createSpectatorBattleViewerEntitlement(),
  )
  expect(JSON.parse(JSON.stringify(projected)).summons[0].profile.neverMoves).toBe(true)
})

it('keeps captured Summon cap budgets and provenance private from every viewer', () => {
  const state = {
    tactical: { battle: { combatants: [] } },
    statusState: [],
    effectState: {
      poison: [
        {
          targetCombatantId: 'enemy',
          sourceCombatantId: 'expired.summon',
          sourceActionId: 'summon.poison',
          summonDamageCommandId: 1,
        },
      ],
      burn: [],
      bleed: [],
      ongoingRecovery: [],
      damageHistory: [],
      summonDamageSources: [
        { combatantId: 'expired.summon', ownerCombatantId: 'owner', potencyBasisPoints: 4000 },
      ],
      summonDamageCommands: [
        {
          id: 1,
          sourceCombatantId: 'expired.summon',
          turnNumber: 2,
          budgetByRecipient: { enemy: 3 },
          spentByRecipient: {},
        },
      ],
      nextSummonDamageCommandId: 2,
    },
  } as unknown as StatDrivenCombatEncounterState
  const visible = projectBattleEffectStateForViewer(state, createSpectatorBattleViewerEntitlement())
  expect(visible).not.toHaveProperty('summonDamageSources')
  expect(visible).not.toHaveProperty('summonDamageCommands')
  expect(visible).not.toHaveProperty('nextSummonDamageCommandId')
  expect(visible!.poison[0]).not.toHaveProperty('summonDamageCommandId')
  expect(omitPendingBattlePayloads(state).effectState!.poison[0]).not.toHaveProperty(
    'summonDamageCommandId',
  )
  expect(omitPendingBattlePayloads(state).effectState).not.toHaveProperty('summonDamageCommands')
  expect(state.effectState).toHaveProperty('summonDamageCommands')
})

it('keeps elevated terrain markers independent of Fortified potency', () => {
  const initial = encounter()
  const state = {
    ...initial,
    statBalancePolicyVersion: 1 as const,
    tactical: {
      ...initial.tactical,
      tiles: initial.tactical.tiles.map((tile) => ({ ...tile, elevation: 1 })),
    },
    statusState: initial.statusState.map((row) =>
      row.combatantId === ENEMY
        ? {
            ...row,
            statuses: [
              status('covert', ENEMY),
              { ...status('fortified', ENEMY), defenseIncreaseBasisPoints: 5000 },
            ],
          }
        : row,
    ),
  }
  const rows = projectBattleStatusStateForViewer(
    state,
    createSpectatorBattleViewerEntitlement(),
  ).find((row) => row.combatantId === ENEMY)!.statuses
  expect(rows.find((row) => row.statusId === 'terrain-defense')?.potencyBasisPoints).toBe(2000)
})

it('rebuilds visible Haste tuning without leaking a concealed stacked application', () => {
  const state = encounter()
  state.effectStackingPolicyVersion = 1
  const visibility = { kind: 'team-only' as const, teamId: 'team:b' }
  state.pendingEffects = [
    {
      actorId: ENEMY,
      actionId: 'hidden.covert',
      recipientIds: [ENEMY],
      affectedTiles: [],
      effect: { type: 'apply-status', recipient: 'actor', statusId: 'covert', stacks: 1 },
      activationRound: 2,
      content: PV1F_COMBAT_CONTENT,
      sourceCommandVisibility: visibility,
    },
  ]
  state.statusState = state.statusState.map((row) =>
    row.combatantId === PLAIN_ENEMY
      ? {
          ...row,
          statuses: [
            {
              ...status('haste', PLAIN_ENEMY),
              stacks: 2,
              movementApAdjustment: 27,
              applicationModifiers: [
                { stacks: 1, sourceCombatantId: PLAIN_ENEMY, movementApAdjustment: 10 },
                {
                  stacks: 1,
                  sourceCombatantId: ENEMY,
                  movementApAdjustment: 27,
                  sourceCommandVisibility: visibility,
                },
              ],
            },
          ],
        }
      : row,
  )
  const before = JSON.stringify(state)
  for (const viewer of [
    createSpectatorBattleViewerEntitlement(),
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAYER]),
  ]) {
    const visible = projectBattleStatusStateForViewer(state, viewer)
      .find((row) => row.combatantId === PLAIN_ENEMY)!
      .statuses.find((row) => row.statusId === 'haste')!
    expect(visible).toMatchObject({ stacks: 1, movementApAdjustment: 10 })
    expect(visible.applicationModifiers).toHaveLength(1)
    expect(JSON.stringify(visible)).not.toContain('27')
  }
  const own = projectBattleStatusStateForViewer(
    state,
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAIN_ENEMY]),
  )
    .find((row) => row.combatantId === PLAIN_ENEMY)!
    .statuses.find((row) => row.statusId === 'haste')!
  expect(own).toMatchObject({ stacks: 2, movementApAdjustment: 27 })
  expect(JSON.stringify(state)).toBe(before)
})

it('copies explicitly chosen concealed buffs without revealing the Covert donor other buffs to opposing viewers', () => {
  const state = encounter()
  state.statusState = state.statusState.map((row) => ({
    ...row,
    statuses:
      row.combatantId === ENEMY
        ? ['covert', 'inspired', 'invisible'].map((id) => status(id, ENEMY))
        : [],
  }))
  const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
    PLAYER,
  ])
  expect(
    rowStatuses({ statusState: projectBattleStatusStateForViewer(state, viewer) }, ENEMY),
  ).toEqual([])
  const next = executeCombatAction(
    state,
    {
      id: 'copy-concealed',
      version: 1,
      sourceType: 'test',
      tags: ['utility'],
      target: {
        kind: 'unit',
        teamPolicy: 'enemy',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 3,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
        friendlyFire: 'enemies-only',
      },
      cost: { spendsAction: false, mp: 0 },
      requirements: [],
      effects: [
        {
          type: 'copy-statuses',
          recipient: 'primary-unit',
          mode: 'amplify',
          invisibleDonorPolicyVersion: 1,
          statusIds: ['covert', 'invisible'],
        },
      ],
    },
    { kind: 'unit', combatantId: ENEMY },
    PV1F_COMBAT_CONTENT,
  ).state as StatDrivenCombatEncounterState
  const projected = { statusState: projectBattleStatusStateForViewer(next, viewer) }
  expect(rowStatuses(projected, PLAYER).map((row) => row.statusId)).toEqual(['covert', 'invisible'])
  expect(rowStatuses(projected, ENEMY)).toEqual([])
  expect(rowStatuses(next, ENEMY)).toEqual(rowStatuses(state, ENEMY))
  const enemy = deriveParticipantBattleViewerEntitlement(next.tactical.battle.combatants, [ENEMY])
  expect(
    rowStatuses({ statusState: projectBattleStatusStateForViewer(next, enemy) }, PLAYER),
  ).toEqual([])
})

it.each(['once-per-action', 'once-per-round'] as const)(
  'projects owner-only %s availability from captured usage',
  (limit) => {
    const base = encounter()
    const behavior = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability
      .behaviors[0]!
    const source = captureCombatAbilitySource({
      schemaVersion: 1,
      sourceInstanceId: 'private-usage-source',
      ownerCombatantId: PLAYER,
      abilityId: 'fixture.limited',
      contentVersion: 1,
      sourceKind: 'discipline-skill',
      sourceDisciplineId: 'vanguard',
      tags: ['attack'],
      definition: { schemaVersion: 1, behaviors: [{ ...behavior, activationLimits: [limit] }] },
    })
    const state = reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources({ ...base, abilityUsageLimitPolicyVersion: 1 }, [source]),
      base.statBridge,
    )
    state.abilityRuntime = {
      ...state.abilityRuntime!,
      usage: [
        {
          key: combatAbilityUsageKey(state, source, source.definition.behaviors[0]!),
          rootActionId: 'private-command',
          commandId: 'private-command',
          ownerCycle: 0,
          round: state.tactical.battle.round,
          battleId: state.tactical.battle.battleId,
        },
      ],
    }
    const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
      PLAYER,
    ])
    const before = JSON.stringify(state)
    const row = projectBattleManualActionTargets(state, viewer)[0]!
    expect(row.usageLimitReached).toBe(true)
    expect(resolveBattleCapturedSkill({ id: source.abilityId } as never, [row])?.unavailable).toBe(
      true,
    )
    expect(row.report?.limits).toContain(
      limit === 'once-per-action' ? 'Once per battle' : 'Once per round',
    )
    expect(JSON.stringify(row)).not.toMatch(
      /private-command|private-usage-source|ownerCycle|rootActionId/,
    )
    const later = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: { ...state.tactical.battle, round: state.tactical.battle.round + 1 },
      },
    }
    expect(projectBattleManualActionTargets(later, viewer)[0]!.usageLimitReached).toBe(
      limit === 'once-per-action' ? true : undefined,
    )
    expect(
      projectBattleManualActionTargets(state, createSpectatorBattleViewerEntitlement()),
    ).toEqual([])
    expect(
      projectBattleManualActionTargets(
        state,
        deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [ENEMY]),
      ),
    ).toEqual([])
    expect(JSON.stringify(state)).toBe(before)
  },
)

it('projects finite remaining uses only to the controlling owner without private ledger identities', () => {
  const base = encounter()
  const behavior = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability
    .behaviors[0]!
  const source = captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: 'private-finite-source',
    ownerCombatantId: PLAYER,
    abilityId: 'fixture.finite',
    contentVersion: 1,
    sourceKind: 'discipline-skill',
    sourceDisciplineId: 'vanguard',
    tags: ['attack'],
    definition: { schemaVersion: 1, behaviors: [{ ...behavior, maximumUsesPerBattle: 3 }] },
  })
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(base, [source]),
    base.statBridge,
  )
  const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
    PLAYER,
  ])
  expect(projectBattleManualActionTargets(state, viewer)[0]).toMatchObject({
    maximumUsesPerBattle: 3,
    remainingUses: 3,
  })
  state.abilityRuntime = {
    ...state.abilityRuntime!,
    usage: [
      {
        key: combatAbilityUsageKey(state, source, source.definition.behaviors[0]!),
        usageCount: 2,
        rootActionId: 'private-command',
        commandId: 'private-command',
        ownerCycle: 0,
        round: state.tactical.battle.round,
        battleId: state.tactical.battle.battleId,
      },
    ],
  }
  const row = projectBattleManualActionTargets(state, viewer)[0]!
  expect(row).toMatchObject({ maximumUsesPerBattle: 3, remainingUses: 1 })
  expect(row.report?.limits).toContain('3 uses per battle')
  expect(JSON.stringify(row)).not.toMatch(
    /private-finite-source|private-command|usageCount|rootActionId/,
  )
  expect(projectBattleManualActionTargets(state, createSpectatorBattleViewerEntitlement())).toEqual(
    [],
  )
  expect(
    projectBattleManualActionTargets(
      state,
      deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [ENEMY]),
    ),
  ).toEqual([])
})
it('projects effective numeric defense and owner Jump geometry without changing captured base profiles', () => {
  const base = encounter()
  const source = captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: 'private-stat-source',
    ownerCombatantId: PLAYER,
    abilityId: 'fixture.stats',
    contentVersion: 1,
    sourceKind: 'discipline-skill',
    sourceDisciplineId: 'vanguard',
    tags: [],
    definition: {
      schemaVersion: 1,
      behaviors: [
        {
          id: 'passive',
          activation: 'ongoing',
          mode: 'modifier',
          classification: 'utility',
          costs: [],
          cooldown: null,
          requirements: null,
          targeting: null,
          effects: [
            {
              id: 'jump',
              payload: { type: 'stat-bonus', recipient: 'actor', stat: 'jump', amount: 1 },
            },
            {
              id: 'defense',
              payload: {
                type: 'stat-bonus',
                recipient: 'actor',
                stat: 'physical-defense',
                amount: 10,
              },
            },
          ],
        },
      ],
    },
  })
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(base, [source]),
    base.statBridge,
  )
  const before = JSON.stringify(state)
  const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
    PLAYER,
  ])
  const projected = projectBattleSnapshot(state, viewer)
  const baseDefense = state.statBridge.combatants.find((row) => row.combatantId === PLAYER)!.armor!
  expect(projected.statBridge.combatants.find((row) => row.combatantId === PLAYER)!.armor).toBe(
    baseDefense + 10,
  )
  const profileId = state.tactical.placements.find(
    (row) => row.combatantId === PLAYER,
  )!.movementProfileId
  const baseJump = state.tactical.movementProfiles.find(
    (row) => row.id === profileId,
  )!.maxElevationStep
  expect(
    projected.tactical.movementProfiles.find((row) => row.id === profileId)!.maxElevationStep,
  ).toBe(baseJump + 1)
  expect(JSON.stringify(projected)).not.toContain('private-stat-source')
  expect(JSON.stringify(state)).toBe(before)
})

it('rebuilds visible Damage Up scope without inheriting a concealed stacked application', () => {
  for (const publicScope of [undefined, ['ice'] as const]) {
    const state = encounter()
    state.effectStackingPolicyVersion = 1
    const visibility = { kind: 'team-only' as const, teamId: 'team:b' }
    state.pendingEffects = [
      {
        actorId: ENEMY,
        actionId: 'hidden.covert',
        recipientIds: [ENEMY],
        affectedTiles: [],
        effect: { type: 'apply-status', recipient: 'actor', statusId: 'covert', stacks: 1 },
        activationRound: 2,
        content: PV1F_COMBAT_CONTENT,
        sourceCommandVisibility: visibility,
      },
    ]
    state.statusState = state.statusState.map((row) =>
      row.combatantId === PLAIN_ENEMY
        ? {
            ...row,
            statuses: [
              {
                ...status('inspired', PLAIN_ENEMY),
                stacks: 2,
                potencyBasisPoints: 5000,
                damageTypes: ['fire'],
                applicationModifiers: [
                  {
                    stacks: 1,
                    sourceCombatantId: PLAIN_ENEMY,
                    potencyBasisPoints: 2000,
                    ...(publicScope ? { damageTypes: publicScope } : {}),
                  },
                  {
                    stacks: 1,
                    sourceCombatantId: ENEMY,
                    potencyBasisPoints: 5000,
                    damageTypes: ['fire'],
                    sourceCommandVisibility: visibility,
                  },
                ],
              },
            ],
          }
        : row,
    )
    const before = JSON.stringify(state)
    for (const viewer of [
      createSpectatorBattleViewerEntitlement(),
      deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAYER]),
    ]) {
      const visible = projectBattleStatusStateForViewer(state, viewer)
        .find((row) => row.combatantId === PLAIN_ENEMY)!
        .statuses.find((row) => row.statusId === 'inspired')!
      expect(visible).toMatchObject({ stacks: 1, potencyBasisPoints: 2000 })
      expect(visible.damageTypes).toEqual(publicScope)
      expect(visible.applicationModifiers).toHaveLength(1)
      expect(JSON.stringify(visible)).not.toContain('fire')
    }
    expect(JSON.stringify(state)).toBe(before)
  }
})

it('projects current Range Up/Down target reach without mutating frozen definitions or historical captures', () => {
  const base = encounter()
  const basic = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability
    .behaviors[0]!
  const source = captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: 'range-projection-source',
    ownerCombatantId: PLAYER,
    abilityId: 'fixture.range',
    contentVersion: 1,
    sourceKind: 'discipline-skill',
    sourceDisciplineId: 'vanguard',
    tags: ['attack'],
    definition: {
      schemaVersion: 1,
      behaviors: [
        { ...basic, id: 'range-strike', targeting: { ...basic.targeting!, maximumRange: 2 } },
      ],
    },
  })
  const initial = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(base, [source]),
    base.statBridge,
  )
  const viewer = deriveParticipantBattleViewerEntitlement(initial.tactical.battle.combatants, [
    PLAYER,
  ])
  const state = {
    ...initial,
    rangeModifierPolicyVersion: 1 as const,
    statusState: initial.statusState.map((row) =>
      row.combatantId === PLAYER
        ? {
            ...row,
            statuses: [
              { ...status('range-up', PLAYER), rangeTiles: 4 },
              { ...status('range-down', PLAYER), rangeTiles: 1 },
            ],
          }
        : row,
    ),
  }
  const frozen = JSON.stringify(state.capturedAbilitySources)
  expect(projectBattleManualActionTargets(state, viewer)[0]!.target.maximumRange).toBe(5)
  expect(
    projectBattleManualActionTargets(
      { ...state, rangeModifierPolicyVersion: undefined },
      viewer,
    )[0]!.target.maximumRange,
  ).toBe(2)
  expect(JSON.stringify(state.capturedAbilitySources)).toBe(frozen)
})
