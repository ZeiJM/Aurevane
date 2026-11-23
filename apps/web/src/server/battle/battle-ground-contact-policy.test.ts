import { omitPendingBattlePayloads } from './battle-live-viewer-projection'
import { expect, it, vi } from 'vitest'
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import type { BattleSessionRepository, CreateBattleSessionInput } from '@aurevane/db/battle-session'
import {
  validateCombatEncounterState,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEncounterState,
} from '@aurevane/game-core/combat/actions'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-combat-content'
vi.mock('server-only', () => ({}))
import { createBattleSessionService } from './battle-session-service'
const character: CharacterRecord = {
  id: '22222222-2222-4222-8222-222222222222',
  userId: '11111111-1111-4111-8111-111111111111',
  slotIndex: 0,
  rulesVersion: 1,
  name: 'Ground Tester',
  nameKey: 'ground tester',
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
  createdAt: '2026-11-01T00:00:00.000Z',
  cycleStartedAt: '2026-11-01T00:00:00.000Z',
  lastActiveAt: '2026-11-01T00:00:00.000Z',
}
it('persists the current Ground contact policy at server admission and reloads executable field schedules', async () => {
  let snapshot: unknown
  const createBattleSession = vi.fn(async (input: CreateBattleSessionInput) => {
    snapshot = input.initialSnapshot
    return {
      replayed: false,
      result: {
        battleSessionId: '33333333-3333-4333-8333-333333333333',
        battleVersion: 1,
        snapshot: input.initialSnapshot,
        createdAt: character.createdAt,
      },
    }
  })
  const service = createBattleSessionService({
    characters: {
      findByOwnerSlot: async () => character,
      createBaseCharacter: vi.fn(),
    } as unknown as CharacterRepository,
    battles: {
      createBattleSession,
      findBattleSession: vi.fn(),
      findBattleIntentReplay: vi.fn(),
      commitBattleIntent: vi.fn(),
    } as BattleSessionRepository,
  })
  await service.createSession({
    userId: character.userId,
    characterId: character.id,
    idempotencyKey: '44444444-4444-4444-8444-444444444444',
  })
  const state = JSON.parse(JSON.stringify(snapshot)) as CombatEncounterState
  expect(state.displacementOriginPolicyVersion).toBe(1)
  expect(state.groundEffectPolicyVersion).toBe(1)
  expect(state.groundContactPolicyVersion).toBe(1)
  expect(state.reversalPolicyVersion).toBe(1)
  expect(state.pierceCriticalPolicyVersion).toBe(1)
  expect(state.summonPotencyPolicyVersion).toBe(1)
  expect(validateCombatEncounterState(state)).toEqual([])
  const actorId = state.tactical.battle.currentTurn!.combatantId
  const position = state.tactical.placements.find((row) => row.combatantId === actorId)!.position
  const definition: CombatActionDefinition = {
    id: 'test.server-ground',
    version: 1,
    sourceType: 'test',
    tags: [],
    cost: { mp: 0, spendsAction: false },
    requirements: [],
    target: {
      kind: 'ground-tile',
      geometryVersion: 3,
      categories: ['ground'],
      maximumSelections: 1,
      teamPolicy: 'any',
      friendlyFire: 'all-units',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    effects: [{ type: 'healing', recipient: 'affected-units', target: 'ground', amount: 3 }],
    groundArea: {
      durationRounds: 3,
      visualPresetId: 'arcane-pulse',
      entryEffectOrdinals: [0],
      timing: 'delayed',
    },
  }
  const created = executeCombatAction(
    state,
    definition,
    { kind: 'tile', position },
    PV1F_COMBAT_CONTENT,
  )
  const reloaded = JSON.parse(JSON.stringify(created.state)) as CombatEncounterState
  expect(reloaded.groundAreas?.[0]).toMatchObject({
    contactPolicyVersion: 1,
    activationRound: state.tactical.battle.round + 2,
    entryEffectSourceOrdinals: [0],
  })
  expect(reloaded.pendingEffects ?? []).toEqual([])
  expect(validateCombatEncounterState(reloaded)).toEqual([])
})

it('omits the uncapped retired Ground source archive from public projection', () => {
  const privateState = {
    tactical: { battle: { lifecycle: 'active', round: 1 } },
    effectState: {
      ongoingRecovery: [],
      poison: [],
      bleed: [],
      burn: [],
      damageHistory: [],
      summonDamageSources: [
        {
          combatantId: 'summon:secret-owner:secret-skill',
          ownerCombatantId: 'secret-owner',
          groundContactArchiveVersion: 1,
        },
      ],
    },
  }
  const visible = omitPendingBattlePayloads(privateState as never)
  expect(visible.effectState).not.toHaveProperty('summonDamageSources')
  expect(JSON.stringify(visible)).not.toContain('secret')
  expect(JSON.stringify(visible)).not.toContain('groundContactArchiveVersion')
})

it('omits frozen encounter potential and round spending from every public Summon projection', () => {
  const state = {
    summonPotencyPolicyVersion: 1,
    tactical: { battle: { lifecycle: 'active', round: 2 } },
    effectState: {
      ongoingRecovery: [],
      poison: [],
      bleed: [],
      burn: [],
      damageHistory: [],
      summonDamageSources: [
        {
          combatantId: 'summon:private-owner:private-source',
          ownerCombatantId: 'private-owner',
          potencyBasisPoints: 4000,
          potencyPolicyVersion: 1,
          damageBudgetPerRound: 98765,
          budgetRound: 2,
          spentThisRound: 1234,
        },
      ],
    },
  }
  const projected = omitPendingBattlePayloads(state as never)
  const json = JSON.stringify(projected)
  for (const secret of [
    'private-owner',
    'private-source',
    'damageBudgetPerRound',
    'budgetRound',
    'spentThisRound',
    '98765',
    '1234',
  ])
    expect(json).not.toContain(secret)
  expect(projected.effectState).not.toHaveProperty('summonDamageSources')
})
