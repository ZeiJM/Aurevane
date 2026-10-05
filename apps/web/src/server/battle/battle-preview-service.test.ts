import type {
  BattleSessionRecord,
  BattleSessionRepository,
  CommitBattleIntentInput,
  CreateBattleSessionInput,
} from '@aurevane/db/battle-session'
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import {
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import { evaluatePv1fMatureSkill } from '@aurevane/game-core/combat/pv1f-action-economy'
import * as previewServiceExports from './battle-preview-service'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { moveCurrentCombatant } from '@aurevane/game-core/combat/board'
import {
  finishPv1fTurn,
  preparePv1fTurnEconomy,
  PV1F_ACTION_ECONOMY_RESOURCE_KEY,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  reattachStatDrivenCombatBridge,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createBattlePreviewService } from './battle-preview-service'
import { createBattleSessionService } from './battle-session-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const CREATED_AT = '2026-08-17T12:00:00.000Z'

function characterRecord(): CharacterRecord {
  return {
    id: CHARACTER_ID,
    userId: USER_ID,
    slotIndex: 0,
    rulesVersion: 1,
    name: 'Wayfarer',
    nameKey: 'wayfarer',
    presentationId: 'androgynous',
    pronounPresetId: 'they_them',
    portraitRef: 'portrait.starter.wayfarer-01',
    starterAppearanceRef: 'appearance.starter.roadworn',
    foundationDisciplineId: 'vanguard',
    might: 6,
    finesse: 6,
    vitality: 6,
    agility: 6,
    intellect: 6,
    resolve: 6,
    level: 1,
    xp: 0,
    progressionCycle: 1,
    createdAt: CREATED_AT,
    cycleStartedAt: CREATED_AT,
    lastActiveAt: CREATED_AT,
  }
}

function createCharacterRepository(): CharacterRepository {
  return {
    findByOwnerSlot: vi.fn(async () => characterRecord()),
    createBaseCharacter: vi.fn(async () => {
      throw new Error('Not used by P2.5 preview tests.')
    }),
  }
}

function createBattleRepository() {
  const createBattleSession = vi.fn(async (input: CreateBattleSessionInput) => ({
    replayed: false,
    result: {
      battleSessionId: SESSION_ID,
      battleVersion: 1,
      snapshot: input.initialSnapshot,
      createdAt: CREATED_AT,
    },
  }))
  const findBattleSession = vi.fn(async (): Promise<BattleSessionRecord | null> => null)
  const findBattleIntentReplay = vi.fn(async () => null)
  const commitBattleIntent = vi.fn(async (input: CommitBattleIntentInput) => ({
    replayed: false,
    result: {
      battleSessionId: input.battleSessionId,
      battleVersion: input.expectedBattleVersion + 1,
      snapshot: input.nextSnapshot,
      committedAt: CREATED_AT,
    },
  }))
  const repository: BattleSessionRepository = {
    createBattleSession,
    findBattleSession,
    findBattleIntentReplay,
    commitBattleIntent,
  }

  return {
    repository,
    createBattleSession,
    findBattleSession,
    findBattleIntentReplay,
    commitBattleIntent,
  }
}

async function createFixture() {
  const battles = createBattleRepository()
  const sessionService = createBattleSessionService({
    characters: createCharacterRepository(),
    battles: battles.repository,
  })
  await sessionService.createSession({
    userId: USER_ID,
    characterId: CHARACTER_ID,
    idempotencyKey: '44444444-4444-4444-8444-444444444444',
  })
  const creation = battles.createBattleSession.mock.calls[0]?.[0]
  if (!creation) throw new Error('Expected initial battle creation.')
  const snapshot = creation.initialSnapshot as StatDrivenCombatEncounterState
  const record: BattleSessionRecord = {
    battleSessionId: SESSION_ID,
    battleId: snapshot.tactical.battle.battleId,
    battleVersion: 1,
    rulesVersion: snapshot.tactical.battle.rulesVersion,
    contentVersion: snapshot.tactical.battle.contentVersion,
    lifecycle: snapshot.tactical.battle.lifecycle,
    snapshot,
    controlledCombatantIds: [`character:${CHARACTER_ID}`],
    updatedAt: CREATED_AT,
  }
  battles.findBattleSession.mockResolvedValue(record)

  return {
    battles,
    service: createBattlePreviewService(battles.repository),
    sessionService,
    snapshot,
    record,
  }
}

function withMovedPlayer(state: StatDrivenCombatEncounterState): StatDrivenCombatEncounterState {
  // Position the forecast fixture adjacent without exceeding the current 2-tile movement cap.
  const tactical = {
    ...state.tactical,
    placements: state.tactical.placements.map((placement) =>
      placement.combatantId === `character:${CHARACTER_ID}`
        ? { ...placement, position: { x: 2, y: 1 } }
        : placement,
    ),
  }
  const transition = moveCurrentCombatant(tactical, [
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ])
  return reattachStatDrivenCombatBridge(
    createCombatEncounterState(transition.state, state.statusState),
    state.statBridge,
  )
}

describe('P2.5 authoritative battle preview service', () => {
  it('previews legal movement without calling the commit boundary', async () => {
    const { battles, service } = await createFixture()

    const result = await service.previewIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      intent: {
        kind: 'move',
        path: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ],
      },
    })

    expect(result.preview).toMatchObject({
      kind: 'move',
      legal: true,
      cost: 1,
      movementRemainingAfter: 1,
      actionEconomyCost: 20,
      actionEconomyBefore: 100,
      actionEconomyAfter: 80,
      issues: [],
    })
    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('persists Guard cooldown and rejects repeated Guard forecasts and commits after reload', async () => {
    const { battles, service, sessionService, record } = await createFixture()
    const intent = { kind: 'action', actionId: 'basic.guard', target: { kind: 'self' } } as const
    const command = {
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      intent,
    }
    expect((await service.previewIntent(command)).preview).toMatchObject({ legal: true })
    await sessionService.submitIntent({
      ...command,
      idempotencyKey: '55555555-5555-4555-8555-555555555555',
    })
    const commit = battles.commitBattleIntent.mock.calls[0]?.[0]
    if (!commit) throw new Error('Expected Guard commit input.')
    const restored = JSON.parse(
      JSON.stringify(commit.nextSnapshot),
    ) as StatDrivenCombatEncounterState
    const actor = restored.tactical.battle.combatants.find(
      (entry) => entry.id === `character:${CHARACTER_ID}`,
    )!
    expect(actor.temporaryResources).toContainEqual({
      key: 'p3.skill-cooldown.basic.guard',
      current: 3,
      maximum: 3,
    })
    battles.findBattleSession.mockResolvedValue({ ...record, battleVersion: 2, snapshot: restored })
    const repeated = { ...command, expectedBattleVersion: 2 }
    expect((await service.previewIntent(repeated)).preview).toMatchObject({
      legal: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'cooldown-active' })]),
    })
    await expect(
      sessionService.submitIntent({
        ...repeated,
        idempotencyKey: '66666666-6666-4666-8666-666666666666',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      message: expect.stringContaining('cooling down'),
    })
    expect(battles.commitBattleIntent).toHaveBeenCalledTimes(1)
  })

  it('returns useful movement legality reasons instead of pretending a path can commit', async () => {
    const { service } = await createFixture()

    const result = await service.previewIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      intent: {
        kind: 'move',
        path: [
          { x: 0, y: 1 },
          { x: 4, y: 1 },
        ],
      },
    })

    expect(result.preview).toMatchObject({
      kind: 'move',
      legal: false,
      issues: [expect.objectContaining({ code: 'non-adjacent-step' })],
    })
  })

  it.each([
    [100, true, 20],
    [79, false, 0],
  ] as const)(
    'previews two rough tiles as two MOVE steps with %i AP and affordability %j',
    async (ap, legal, remainingAp) => {
      const { service, snapshot, record, battles } = await createFixture()
      const rough = snapshot.tactical.terrains.find((terrain) => terrain.traversalCost === 2)!
      const path = [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ]
      const modified = {
        ...snapshot,
        tactical: {
          ...snapshot.tactical,
          tiles: snapshot.tactical.tiles.map((tile) => ({
            ...tile,
            terrainId: path
              .slice(1)
              .some((position) => position.x === tile.position.x && position.y === tile.position.y)
              ? rough.id
              : tile.terrainId,
          })),
        },
      }
      const prepared = preparePv1fTurnEconomy(modified)
      const actor = prepared.tactical.battle.combatants.find(
        (combatant) => combatant.id === `character:${CHARACTER_ID}`,
      )!
      actor.temporaryResources = actor.temporaryResources.map((resource) =>
        resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY ? { ...resource, current: ap } : resource,
      )
      battles.findBattleSession.mockResolvedValue({ ...record, snapshot: prepared })
      const result = await service.previewIntent({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
        intent: { kind: 'move', path },
      })
      expect(result.preview).toMatchObject({
        legal,
        cost: 2,
        terrainCost: 4,
        movementRemainingAfter: 0,
        actionEconomyCost: 80,
        actionEconomyAfter: remainingAp,
        issues: legal ? [] : [expect.objectContaining({ code: 'insufficient-action-economy' })],
      })
      expect(battles.commitBattleIntent).not.toHaveBeenCalled()
    },
  )

  it('uses the stat-driven attack forecast without consuming authoritative RNG', async () => {
    const { battles, service, snapshot, record } = await createFixture()
    const adjacent = withMovedPlayer(snapshot)
    battles.findBattleSession.mockResolvedValue({ ...record, snapshot: adjacent })
    const rngBefore = adjacent.tactical.battle.rng

    const result = await service.previewIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      intent: {
        kind: 'action',
        actionId: 'basic.attack.unarmed.basic',
        target: { kind: 'unit', combatantId: 'recruit:p2-4-1' },
      },
    })

    expect(result.preview).toMatchObject({
      kind: 'action',
      legal: true,
      actionId: 'basic.attack.unarmed.basic',
      primaryCombatantId: 'recruit:p2-4-1',
      hitChanceBasisPoints: expect.any(Number),
      defenseKind: 'armor',
      defenseRating: 20,
      mitigatedBaseDamage: expect.any(Number),
      issues: [],
    })
    expect(adjacent.tactical.battle.rng).toEqual(rngBefore)
    expect(result).not.toHaveProperty('snapshot')
    expect(JSON.stringify(result)).not.toContain('rng')
    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('previews the authored final-facing blocker before End Turn', async () => {
    const { service } = await createFixture()

    const result = await service.previewIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      intent: { kind: 'end-turn' },
    })

    expect(result.preview).toMatchObject({
      kind: 'end-turn',
      legal: false,
      issues: [
        expect.objectContaining({
          code: 'choose-final-facing',
          message: expect.stringContaining('Choose North, East, South, or West'),
        }),
      ],
    })
  })

  it('previews final facing as the turn-ending command without mutating stored state', async () => {
    const { battles, service } = await createFixture()

    const result = await service.previewIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      intent: { kind: 'face', facing: 'east' },
    })

    expect(result.preview).toEqual({
      kind: 'face',
      legal: true,
      facing: 'east',
      endsTurn: true,
      issues: [],
    })
    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('rejects a stale preview with the current authoritative version', async () => {
    const { battles, service, record } = await createFixture()
    battles.findBattleSession.mockResolvedValue({ ...record, battleVersion: 4 })

    await expect(
      service.previewIntent({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
        intent: { kind: 'face', facing: 'east' },
      }),
    ).rejects.toMatchObject({ code: 'STALE_VERSION', currentVersion: 4 })
    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('does not provide planning authority during an opponent-controlled turn', async () => {
    const { battles, service, snapshot, record } = await createFixture()
    const opponentTurn = finishPv1fTurn(snapshot, 'east').state
    expect(opponentTurn.tactical.battle.currentTurn?.combatantId).toBe('recruit:p2-4-1')
    battles.findBattleSession.mockResolvedValue({ ...record, snapshot: opponentTurn })

    await expect(
      service.previewIntent({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
        intent: { kind: 'face', facing: 'west' },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

it('transports scheduled Guard identity and lifetime without committing or changing stored mechanics', async () => {
  const { battles, service, snapshot } = await createFixture()
  const before = structuredClone(snapshot)
  const result = await service.previewIntent({
    userId: USER_ID,
    battleSessionId: SESSION_ID,
    expectedBattleVersion: 1,
    intent: { kind: 'action', actionId: 'basic.guard', target: { kind: 'self' } },
  })
  expect(result.preview).toMatchObject({
    kind: 'action',
    legal: true,
    projectedEffects: expect.arrayContaining([
      expect.objectContaining({
        effectType: 'apply-status',
        statusId: 'guarded',
        after: 'pending',
        activationRound: 2,
        remainingOwnerTurnEnds: 2,
      }),
    ]),
  })
  if (result.preview.kind !== 'action') throw new Error('Expected action preview')
  expect(result.preview.projectedEvents?.some((event) => event.event === 'status_applied')).toBe(
    false,
  )
  expect(snapshot).toEqual(before)
  expect(battles.commitBattleIntent).not.toHaveBeenCalled()
})

it('redacts current Copy forecasts from a concealed hostile donor while keeping allied details', async () => {
  const { snapshot } = await createFixture()
  const actorId = `character:${CHARACTER_ID}`
  const donorId = 'recruit:p2-4-1'
  snapshot.copyPolicyVersion = 1
  snapshot.effectTimingPolicy = { version: 1, modes: { copy: 'instant' } }
  snapshot.statusState = snapshot.statusState.map((entry) =>
    entry.combatantId === donorId
      ? {
          ...entry,
          statuses: [
            {
              statusId: 'covert',
              statusVersion: 1,
              stacks: 1,
              remainingOwnerTurnStarts: 2,
              sourceCombatantId: donorId,
            },
            {
              statusId: 'guarded',
              statusVersion: 1,
              stacks: 2,
              remainingOwnerTurnStarts: 2,
              sourceCombatantId: donorId,
            },
          ],
        }
      : entry,
  )
  snapshot.effectState = {
    ongoingRecovery: [
      {
        kind: 'hp',
        targetCombatantId: donorId,
        sourceCombatantId: donorId,
        sourceActionId: 'concealed.recovery',
        amountPerTick: 9,
        remainingFutureTicks: 3,
      },
    ],
    barriers: [
      {
        targetCombatantId: donorId,
        sourceCombatantId: donorId,
        sourceActionId: 'concealed.barrier',
        amount: 40,
        applicationOrder: 1,
      },
    ],
    poison: [],
    burn: [],
    bleed: [],
    temporarySkills: [],
    damageHistory: [],
  }
  const base = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
  const skill: MatureSkillDefinition = {
    ...base,
    effects: [{ type: 'copy', recipient: 'primary-unit' }],
    target: {
      ...base.target,
      teamPolicy: 'any',
      maximumRange: 10,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    accuracyMode: 'automatic',
  }
  const evaluated = evaluatePv1fMatureSkill(snapshot, skill, { kind: 'unit', combatantId: donorId })
  expect(evaluated.evaluation.legal).toBe(true)
  const project = (
    previewServiceExports as unknown as {
      projectBeneficialCopyPreview?: (
        state: typeof snapshot,
        action: typeof evaluated.action,
        evaluation: typeof evaluated.evaluation,
      ) => Pick<typeof evaluated.evaluation, 'projectedEffects' | 'projectedEvents'>
    }
  ).projectBeneficialCopyPreview
  const publicPreview = project?.(snapshot, evaluated.action, evaluated.evaluation)
  expect(publicPreview?.projectedEffects).toEqual([
    {
      effectType: 'copy-statuses',
      statusId: 'beneficial-copy',
      combatantId: actorId,
      before: 'none',
      after: 'concealed',
    },
  ])
  expect(publicPreview?.projectedEvents).toEqual([])
  expect(JSON.stringify(publicPreview)).not.toContain('recovery:hp:9:3')
  expect(JSON.stringify(publicPreview)).not.toContain('barrier:40')
  const allied = {
    ...snapshot,
    tactical: {
      ...snapshot.tactical,
      battle: {
        ...snapshot.tactical.battle,
        combatants: snapshot.tactical.battle.combatants.map((unit) =>
          unit.id === donorId
            ? {
                ...unit,
                teamId: snapshot.tactical.battle.combatants.find((unit) => unit.id === actorId)!
                  .teamId,
              }
            : unit,
        ),
      },
    },
  }
  expect(project?.(allied, evaluated.action, evaluated.evaluation)?.projectedEffects).toEqual(
    evaluated.evaluation.projectedEffects,
  )
})
