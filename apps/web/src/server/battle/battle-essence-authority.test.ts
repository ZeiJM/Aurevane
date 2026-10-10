import type {
  BattleSessionCommitRecord,
  BattleSessionRepository,
  BattleSessionRecord,
  CommitBattleIntentInput,
  CreateBattleSessionInput,
} from '@aurevane/db/battle-session'
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
} from '@aurevane/game-core/combat/essence'
import {
  finishPv1fTurn,
  pv1fCooldownForMatureSkill,
  readPv1fActionEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { readSkillCooldown } from '@aurevane/game-core/combat/skill-cooldowns'
import {
  resonanceSnapshotReference,
  resolveResonanceForPair,
} from '@aurevane/game-core/combat/resonance'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type {
  CharacterActiveBuildRecord,
  CharacterBuildRepository,
  CharacterCommittedBuildSnapshotRecord,
} from '@/server/character/character-build-service'

import {
  createBattleSessionService,
  type BattleAuthoritativeEncounterState,
} from './battle-session-service'
import { createViewerSafeBattleLogService } from './battle-log-service'
import {
  deriveParticipantBattleViewerEntitlement,
  createSpectatorBattleViewerEntitlement,
} from './battle-viewer-entitlement'
import { createBattlePreviewService } from './battle-preview-service'
import { createBattleAbortService } from './battle-abort-service'
import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { convertV5ResonanceToV2 } from '@aurevane/game-core/combat/resonance-v2'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const CREATED_AT = '2026-09-04T03:45:00.000Z'
const PLAYER_ID = `character:${CHARACTER_ID}`

it('actual practice abort retains the exact archived source and truth without startup activation or maintenance', async () => {
  const original = resolveEssenceForBuild('vanguard', null)!
  const ability: AbilityDefinition = {
    schemaVersion: 1,
    behaviors: [
      {
        id: 'maintained',
        activation: 'ongoing',
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
            payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 15000 },
          },
        ],
      },
      ...(['manual', 'automatic'] as const).map((activation) => ({
        id: activation === 'manual' ? 'heal' : 'initial',
        activation,
        mode: 'action' as const,
        classification: 'recovery' as const,
        costs: [{ resource: 'mp' as const, amount: 1 }],
        cooldown: null,
        activationLimits: ['once-per-battle' as const],
        requirements: null,
        targeting: {
          kind: 'self' as const,
          teamPolicy: 'self' as const,
          friendlyFire: 'allies-only' as const,
          shape: { kind: 'single' as const },
          minimumRange: 0,
          maximumRange: 0,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          maximumSelections: 1,
        },
        effects: [
          {
            id: 'heal',
            payload: { type: 'healing' as const, recipient: 'actor' as const, amount: 1 },
          },
        ],
      })),
    ],
  }
  const published = {
    ...original,
    contentVersion: 77,
    skill: { ...original.skill, contentVersion: 77 },
    ability,
  }
  const resolver: CombatContentResolver = {
    resolveCurrentSkillDefinition: async (id) => resolveMatureSkillVersion(id),
    resolvePinnedSkillDefinition: async (id, version) => resolveMatureSkillVersion(id, version),
    resolveCurrentEssenceDefinition: async () => structuredClone(published),
    resolvePinnedEssenceDefinition: async () => structuredClone(published),
  }
  const battles = battleRepository()
  const service = createBattleSessionService({
    characters: characterRepository(),
    battles: battles.repository,
    builds: buildRepository(pureSnapshot()).repository,
    combatContentResolver: resolver,
  })
  await service.createSession({
    userId: USER_ID,
    characterId: CHARACTER_ID,
    idempotencyKey: '88888888-8888-4888-8888-888888888888',
  })
  await service.submitIntent({
    userId: USER_ID,
    battleSessionId: SESSION_ID,
    expectedBattleVersion: 1,
    idempotencyKey: '77777777-7777-4777-8777-777777777777',
    intent: {
      kind: 'action',
      actionId: original.essenceId,
      behaviorId: 'heal',
      target: { kind: 'self' },
    },
  })
  const created = battles.record!.snapshot as BattleAuthoritativeEncounterState
  expect(created.abilityRuntime!.usage).toHaveLength(2)
  expect(created.abilityRuntime!.conditionTruth).toHaveLength(1)
  expect(created.abilityRuntime!.maintained).toHaveLength(1)
  battles.replaceSnapshot(JSON.parse(JSON.stringify(created)))
  const view = await createBattleAbortService(battles.repository).abortPractice({
    userId: USER_ID,
    battleSessionId: SESSION_ID,
    expectedBattleVersion: 2,
    idempotencyKey: '99999999-9999-4999-8999-999999999999',
  })
  const saved = battles.record!.snapshot as BattleAuthoritativeEncounterState
  expect(saved.tactical.battle.lifecycle).toBe('abandoned')
  expect(saved.capturedAbilitySources).toEqual(created.capturedAbilitySources)
  expect(saved.abilityRuntime!.maintained).toEqual([])
  expect(saved.abilityRuntime!.usage).toEqual(created.abilityRuntime!.usage)
  expect(saved.abilityRuntime!.conditionTruth).toEqual(created.abilityRuntime!.conditionTruth)
  expect(saved.buildAuthority).toEqual(created.buildAuthority)
  for (const key of Object.keys(created).filter(
    (key) => key.endsWith('PolicyVersion') || key === 'effectTimingPolicy',
  ))
    expect(saved[key as keyof typeof saved]).toEqual(created[key as keyof typeof created])
  expect(battles.commitBattleIntent).toHaveBeenCalledTimes(2)
  expect(battles.commitBattleIntent.mock.calls[1]![0].events).toEqual([
    expect.objectContaining({ event: 'battle_abandoned' }),
  ])
  expect(JSON.stringify(view)).not.toMatch(/capturedAbilitySources|abilityRuntime|sourceInstanceId/)
})

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

function pureSnapshot(): CharacterCommittedBuildSnapshotRecord {
  const essence = resolveEssenceForBuild('vanguard', null)
  if (!essence) throw new Error('Expected representative Vanguard Essence.')
  return {
    schemaVersion: 2,
    buildVersion: 7,
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
    secondary: null,
    disciplineSkills: [],
    extensions: {
      resonance: null,
      essence: essenceSnapshotReference(essence),
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

function mixedSnapshot(): CharacterCommittedBuildSnapshotRecord {
  const resonance = resolveResonanceForPair('vanguard', 'lifebinder')
  return {
    schemaVersion: 2,
    buildVersion: 8,
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
    secondary: { disciplineId: 'lifebinder', definitionVersion: 1 },
    disciplineSkills: [],
    extensions: {
      resonance: resonance ? resonanceSnapshotReference(resonance) : null,
      essence: null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

function activeBuildFor(
  snapshot: CharacterCommittedBuildSnapshotRecord,
): CharacterActiveBuildRecord {
  return {
    characterId: CHARACTER_ID,
    schemaVersion: 2,
    buildVersion: snapshot.buildVersion,
    primaryDefinition: {
      id: snapshot.primary.disciplineId,
      definitionVersion: snapshot.primary.definitionVersion,
      name: 'Vanguard',
      summary: 'Front-line pressure and durable physical control.',
      enabledForPrimary: true,
      enabledForSecondary: true,
    },
    primaryProfile: {
      disciplineId: snapshot.primary.disciplineId,
      profileVersion: snapshot.primary.profileVersion,
      statOffsets: {
        maxHp: 20,
        physicalPower: 2,
        armor: 5,
        ward: 1,
        initiative: -1,
      },
    },
    secondaryDefinition: snapshot.secondary
      ? {
          id: snapshot.secondary.disciplineId,
          definitionVersion: snapshot.secondary.definitionVersion,
          name: 'Lifebinder',
          summary: 'Mystic sustain and restorative control.',
          enabledForPrimary: true,
          enabledForSecondary: true,
        }
      : null,
    primaryAttunementLockedUntil: null,
    secondaryAttunementLockedUntil: null,
    attunementPolicy: {
      version: 2,
      primaryCooldownSeconds: 0,
      secondaryCooldownSeconds: 0,
    },
    serverNow: CREATED_AT,
    updatedAt: CREATED_AT,
  }
}

function characterRepository(): CharacterRepository {
  return {
    findByOwnerSlot: vi.fn(async () => characterRecord()),
    createBaseCharacter: vi.fn(async () => {
      throw new Error('Not used by the P3.6 battle authority test.')
    }),
  }
}

function buildRepository(initial: CharacterCommittedBuildSnapshotRecord) {
  let snapshot = initial
  const loadCommittedBuildSnapshot = vi.fn(async () => snapshot)
  const repository: CharacterBuildRepository = {
    findActiveBuild: vi.fn(async () => activeBuildFor(snapshot)),
    listDisciplines: vi.fn(async () => []),
    listLearnedSkills: vi.fn(async () => []),
    listEquippedDisciplineSkills: vi.fn(async () => []),
    loadCommittedBuildSnapshot,
    changeDisciplines: vi.fn(async () => {
      throw new Error('Not used by the P3.6 battle authority test.')
    }),
    saveSupportAction: vi.fn(async () => ({ buildVersion: 2, replayed: false })),
    saveDisciplineSkills: vi.fn(async () => {
      throw new Error('Not used by the P3.6 battle authority test.')
    }),
  }
  return {
    repository,
    loadCommittedBuildSnapshot,
    replace(next: CharacterCommittedBuildSnapshotRecord) {
      snapshot = next
    },
  }
}

function battleRepository() {
  let record: BattleSessionRecord | null = null
  const createBattleSession = vi.fn(async (input: CreateBattleSessionInput) => {
    const state = input.initialSnapshot as BattleAuthoritativeEncounterState
    record = {
      battleSessionId: SESSION_ID,
      battleId: input.battleId,
      battleVersion: 1,
      rulesVersion: input.rulesVersion,
      contentVersion: input.contentVersion,
      lifecycle: state.tactical.battle.lifecycle,
      snapshot: input.initialSnapshot,
      controlledCombatantIds: [PLAYER_ID],
      updatedAt: CREATED_AT,
    }
    return {
      replayed: false,
      result: {
        battleSessionId: SESSION_ID,
        battleVersion: 1,
        snapshot: input.initialSnapshot,
        createdAt: CREATED_AT,
      },
    }
  })
  const findBattleSession = vi.fn(async () => record)
  const findBattleIntentReplay = vi.fn<BattleSessionRepository['findBattleIntentReplay']>(
    async (): Promise<BattleSessionCommitRecord | null> => null,
  )
  const commitBattleIntent = vi.fn(async (input: CommitBattleIntentInput) => {
    if (!record) throw new Error('Expected an existing battle session.')
    record = {
      ...record,
      battleVersion: input.expectedBattleVersion + 1,
      snapshot: input.nextSnapshot,
      updatedAt: CREATED_AT,
    }
    return {
      replayed: false,
      result: {
        battleSessionId: input.battleSessionId,
        battleVersion: input.expectedBattleVersion + 1,
        snapshot: input.nextSnapshot,
        committedAt: CREATED_AT,
      },
    }
  })
  const repository: BattleSessionRepository = {
    createBattleSession,
    findBattleSession,
    findBattleIntentReplay,
    commitBattleIntent,
  }
  return {
    repository,
    createBattleSession,
    commitBattleIntent,
    findBattleIntentReplay,
    get record() {
      return record
    },
    replaceSnapshot(snapshot: unknown) {
      if (!record) throw new Error('Expected an existing battle session.')
      record = { ...record, snapshot }
    },
  }
}

function positionPlayerAdjacent(state: BattleAuthoritativeEncounterState) {
  const tactical = {
    ...state.tactical,
    placements: state.tactical.placements.map((placement) =>
      placement.combatantId === PLAYER_ID ? { ...placement, position: { x: 3, y: 1 } } : placement,
    ),
  }
  const deterministicBridge = {
    ...state.statBridge,
    combatants: state.statBridge.combatants.map((profile) =>
      profile.combatantId === PLAYER_ID
        ? { ...profile, accuracy: 10_000, criticalChance: 0 }
        : profile.combatantId === 'recruit:p2-4-1'
          ? { ...profile, evasion: 0 }
          : profile,
    ),
  }
  const base = reattachStatDrivenCombatBridge(
    createCombatEncounterState(tactical, state.statusState),
    deterministicBridge,
  )
  return state.buildAuthority ? { ...base, buildAuthority: state.buildAuthority } : base
}

it('creates immutable published Essence behaviors and uses their exact bundle through preview, commit and reconnect', async () => {
  const original = structuredClone(resolveEssenceForBuild('vanguard', null)!)
  const ability: AbilityDefinition = {
    schemaVersion: 1,
    behaviors: [
      {
        id: 'strike',
        activation: 'manual',
        mode: 'action',
        classification: 'attack',
        attackFamily: 'physical',
        costs: [
          { resource: 'ap', amount: 11 },
          { resource: 'mp', amount: 2 },
          { resource: 'hp', amount: 1 },
        ],
        cooldown: null,
        requirements: null,
        targeting: { ...original.skill.target, maximumSelections: 1 },
        accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
        effects: [{ id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 3 } }],
      },
      {
        id: 'extra',
        activation: 'manual',
        mode: 'modifier',
        classification: 'attack',
        attackFamily: 'physical',
        costs: [
          { resource: 'ap', amount: 7 },
          { resource: 'mp', amount: 1 },
          { resource: 'hp', amount: 2 },
        ],
        cooldown: null,
        requirements: null,
        targeting: null,
        effects: [{ id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 2 } }],
      },
      {
        id: 'extra-z',
        activation: 'manual',
        mode: 'modifier',
        classification: 'attack',
        attackFamily: 'physical',
        costs: [],
        cooldown: null,
        requirements: null,
        targeting: null,
        effects: [{ id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 1 } }],
      },
      {
        id: 'start',
        activation: 'automatic',
        mode: 'action',
        classification: 'recovery',
        costs: [{ resource: 'mp', amount: 1 }],
        cooldown: null,
        requirements: { kind: 'event', eventType: 'battle_started', phase: 'after' },
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
        effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
      },
    ],
  }
  let published = {
    ...original,
    contentVersion: 77,
    ability,
    skill: { ...original.skill, contentVersion: 77 },
  }
  const resolver: CombatContentResolver = {
    resolveCurrentSkillDefinition: async (id) => resolveMatureSkillVersion(id),
    resolvePinnedSkillDefinition: async (id, version) => resolveMatureSkillVersion(id, version),
    resolveCurrentEssenceDefinition: async () => structuredClone(published),
    resolvePinnedEssenceDefinition: async () => structuredClone(published),
  }
  const builds = buildRepository(pureSnapshot()),
    battles = battleRepository()
  const service = createBattleSessionService({
    characters: characterRepository(),
    battles: battles.repository,
    builds: builds.repository,
    combatContentResolver: resolver,
  })
  await service.createSession({
    userId: USER_ID,
    characterId: CHARACTER_ID,
    idempotencyKey: '88888888-8888-4888-8888-888888888888',
  })
  const created = battles.record!.snapshot as BattleAuthoritativeEncounterState
  const startup = battles.createBattleSession.mock.calls[0]![0].startup!
  expect(startup.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ event: 'mp_spent', amount: 1 }),
      expect.objectContaining({ event: 'combat_action_used', actionId: original.essenceId }),
    ]),
  )
  expect(startup.startSnapshot).not.toHaveProperty('abilityRuntime')
  expect(startup.privacyJournal.commandVisibility).toEqual({ kind: 'public' })
  expect(created.capturedAbilitySources).toHaveLength(1)
  const source = created.capturedAbilitySources![0]!
  expect(source.sourceKind).toBe('essence')
  expect(source.contentVersion).toBe(77)
  expect(Object.isFrozen(source.definition)).toBe(true)
  expect(created.tactical.battle.combatants.find((row) => row.id === PLAYER_ID)!.mp).toBe(
    created.tactical.battle.combatants.find((row) => row.id === PLAYER_ID)!.maxMp - 1,
  )
  const positioned = { ...created, tactical: positionPlayerAdjacent(created).tactical }
  battles.replaceSnapshot(JSON.parse(JSON.stringify(positioned)))
  published = {
    ...published,
    enabled: false,
    ability: {
      ...ability,
      behaviors: ability.behaviors.map((row) => ({
        ...row,
        costs: [{ resource: 'ap', amount: 99 }],
      })),
    },
  }
  const intent = {
    kind: 'action' as const,
    actionId: original.essenceId,
    behaviorId: 'strike',
    target: { kind: 'unit' as const, combatantId: 'recruit:p2-4-1' },
    manualModifiers: [
      { sourceInstanceId: source.sourceInstanceId, behaviorId: 'extra-z' },
      { sourceInstanceId: source.sourceInstanceId, behaviorId: 'extra' },
    ],
  }
  const before = JSON.stringify(battles.record!.snapshot)
  for (const manualModifiers of [
    [intent.manualModifiers[0]!, intent.manualModifiers[0]!],
    [{ sourceInstanceId: 'foreign.source', behaviorId: 'extra' }],
  ]) {
    await expect(
      service.submitIntent({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
        idempotencyKey: '11111111-9999-4999-8999-999999999999',
        intent: { ...intent, manualModifiers },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
    expect(JSON.stringify(battles.record!.snapshot)).toBe(before)
  }
  const preview = await createBattlePreviewService(battles.repository, resolver).previewIntent({
    userId: USER_ID,
    battleSessionId: SESSION_ID,
    expectedBattleVersion: 1,
    intent,
  })
  expect(preview.preview).toMatchObject({
    kind: 'action',
    legal: true,
    actionEconomyCost: 18,
    mpCost: 3,
  })
  expect(JSON.stringify(preview)).not.toMatch(
    /effectOrigin|sourceInstanceId|abilityParticipants|sourceCommandVisibility/,
  )
  expect(JSON.stringify(battles.record!.snapshot)).toBe(before)
  await service.submitIntent({
    userId: USER_ID,
    battleSessionId: SESSION_ID,
    expectedBattleVersion: 1,
    idempotencyKey: '99999999-9999-4999-8999-999999999999',
    intent,
  })
  const next = battles.record!.snapshot as BattleAuthoritativeEncounterState
  expect(readPv1fActionEconomy(next)!.current).toBe(82)
  expect(next.capturedAbilitySources![0]!.definition).toEqual(ability)
  expect(next.abilityRuntime!.nextCommandSequence).toBe(2)
  const committedInput = battles.commitBattleIntent.mock.calls[0]![0]
  battles.findBattleIntentReplay.mockImplementation(async (retry) =>
    retry.requestFingerprint === committedInput.requestFingerprint
      ? { battleSessionId: SESSION_ID, battleVersion: 2, snapshot: next, committedAt: CREATED_AT }
      : null,
  )
  const persistedBeforeReplay = JSON.stringify(battles.record!.snapshot)
  const replay = await service.submitIntent({
    userId: USER_ID,
    battleSessionId: SESSION_ID,
    expectedBattleVersion: 1,
    idempotencyKey: '99999999-9999-4999-8999-999999999999',
    intent: { ...intent, manualModifiers: [...intent.manualModifiers].reverse() },
  })
  expect(replay.replayed).toBe(true)
  expect(battles.commitBattleIntent).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(battles.record!.snapshot)).toBe(persistedBeforeReplay)

  const publicView = await service.getSession(USER_ID, SESSION_ID)
  expect(JSON.stringify(publicView)).not.toMatch(
    /capturedAbilitySources|conditionTruth|accuracyRule|effectEligibleRecipientIds|abilityParticipants/,
  )
})

it('projects startup Automatic children with their own Covert visibility through actual history DTOs', async () => {
  const original = structuredClone(resolveEssenceForBuild('vanguard', null)!)
  const self = {
    kind: 'self' as const,
    teamPolicy: 'self' as const,
    friendlyFire: 'allies-only' as const,
    shape: { kind: 'single' as const },
    minimumRange: 0,
    maximumRange: 0,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
    maximumSelections: 1,
  }
  const base = {
    activation: 'automatic' as const,
    mode: 'action' as const,
    classification: 'utility' as const,
    costs: [],
    cooldown: null,
    requirements: { kind: 'event' as const, eventType: 'battle_started', phase: 'after' as const },
    targeting: self,
  }
  const ability: AbilityDefinition = {
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        id: 'a-hide',
        effects: [
          {
            id: 'covert',
            timing: 'instant',
            payload: { type: 'apply-status', recipient: 'actor', statusId: 'covert', stacks: 1 },
          },
        ],
      },
      {
        ...base,
        id: 'z-recover',
        classification: 'recovery',
        costs: [{ resource: 'mp', amount: 1 }],
        effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
      },
    ],
  }
  const published = {
    ...original,
    contentVersion: 77,
    ability,
    skill: { ...original.skill, contentVersion: 77 },
  }
  const resolver: CombatContentResolver = {
    resolveCurrentSkillDefinition: async (id) => resolveMatureSkillVersion(id),
    resolvePinnedSkillDefinition: async (id, version) => resolveMatureSkillVersion(id, version),
    resolveCurrentEssenceDefinition: async () => published,
    resolvePinnedEssenceDefinition: async () => published,
  }
  const battles = battleRepository()
  await createBattleSessionService({
    characters: characterRepository(),
    battles: battles.repository,
    builds: buildRepository(pureSnapshot()).repository,
    combatContentResolver: resolver,
  }).createSession({
    userId: USER_ID,
    characterId: CHARACTER_ID,
    idempotencyKey: '88888888-8888-4888-8888-888888888888',
  })
  const creation = battles.createBattleSession.mock.calls[0]![0]
  const startup = creation.startup!
  const state = creation.initialSnapshot as BattleAuthoritativeEncounterState
  const hiddenReceipts = startup.events.flatMap((event, eventIndex) =>
    (event as { sourceCommandVisibility?: unknown }).sourceCommandVisibility ? [eventIndex] : [],
  )
  expect(startup.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sourceCommandVisibility: expect.anything() }),
    ]),
  )
  expect(startup.privacyJournal.commandVisibility).toEqual({ kind: 'public' })
  for (const eventIndex of hiddenReceipts)
    expect(startup.privacyJournal.eventVisibilityOverrides).toContainEqual({
      eventIndex,
      visibility: {
        kind: 'team-only',
        teamId: state.tactical.battle.combatants.find((row) => row.id === PLAYER_ID)!.teamId,
      },
    })
  const records = startup.events.map((event, eventIndex) => ({
    battleVersion: 1,
    eventIndex,
    event,
    createdAt: CREATED_AT,
  }))
  const actorTeamId = state.tactical.battle.combatants.find((row) => row.id === PLAYER_ID)!.teamId
  const journal = {
    ...startup.privacyJournal,
    battleVersion: 1,
    actorCombatantId: PLAYER_ID,
    actorTeamId,
    eventCount: records.length,
  }
  const views = [
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [PLAYER_ID]),
    deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['recruit:p2-4-1']),
    createSpectatorBattleViewerEntitlement(),
  ]
  for (const [index, viewer] of views.entries()) {
    const log = await createViewerSafeBattleLogService(
      { findBattleEvents: async () => records },
      {
        findBattleHistoryPrivacy: async () => ({
          viewer,
          journals: [journal],
          buildAuthority: state.buildAuthority,
        }),
      },
      resolver,
    ).getLog(USER_ID, SESSION_ID)
    expect(JSON.stringify(log)).not.toMatch(
      /effectOrigin|abilityParticipants|sourceCommandVisibility|sourceInstanceId|conditionTruth/,
    )
    expect(log.entries.filter((entry) => entry.eventType === 'combat_action_used')).toHaveLength(
      index === 0 ? 2 : 1,
    )
    expect(log.entries.filter((entry) => entry.eventType === 'mp_spent')).toHaveLength(
      index === 0 ? 1 : 0,
    )
    if (index === 0) expect(JSON.stringify(log)).toContain(original.essenceId)
    else {
      expect(JSON.stringify(log)).not.toContain('z-recover')
      expect(log.entries.filter((entry) => entry.eventType === 'mp_spent')).toHaveLength(0)
    }
  }
})

it.each(['skill', 'resonance-v1', 'resonance-v2'] as const)(
  'routes actual published %s capture through create, pure preview, commit and JSON reconnect',
  async (kind) => {
    const self = {
      kind: 'self' as const,
      teamPolicy: 'self' as const,
      friendlyFire: 'allies-only' as const,
      shape: { kind: 'single' as const },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      maximumSelections: 1,
    }
    const ability: AbilityDefinition = {
      schemaVersion: 1,
      behaviors: [
        {
          id: 'restore',
          activation: 'manual',
          mode: 'action',
          classification: 'recovery',
          costs: [
            { resource: 'ap', amount: 12 },
            { resource: 'mp', amount: 2 },
          ],
          cooldown: null,
          activationLimits: ['once-per-battle'],
          requirements: null,
          targeting: self,
          effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
        },
      ],
    }
    const skill = {
      ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
      contentVersion: 77,
      ability,
    }
    const builtin = resolveResonanceForPair('vanguard', 'lifebinder', 1)!
    let resonance = {
      ...(kind === 'resonance-v2' ? convertV5ResonanceToV2(builtin) : builtin),
      contentVersion: 77,
      ability,
    }
    let currentSkill = skill
    const build =
      kind === 'skill'
        ? {
            ...pureSnapshot(),
            disciplineSkills: [
              {
                slotIndex: 1 as const,
                skillId: skill.id,
                contentVersion: resolveMatureSkillVersion(skill.id)!.contentVersion,
                sourceDisciplineId: skill.sourceDisciplineId,
              },
            ],
          }
        : mixedSnapshot()
    const resolver: CombatContentResolver = {
      resolveCurrentSkillDefinition: async () => structuredClone(currentSkill),
      resolvePinnedSkillDefinition: async () => structuredClone(currentSkill),
      resolveCurrentResonanceDefinition: async () => structuredClone(resonance),
      resolvePinnedResonanceDefinition: async () => structuredClone(resonance),
    }
    if (kind === 'skill') {
      delete resolver.resolveCurrentResonanceDefinition
      delete resolver.resolvePinnedResonanceDefinition
    }
    const battles = battleRepository()
    const service = createBattleSessionService({
      characters: characterRepository(),
      battles: battles.repository,
      builds: buildRepository(build).repository,
      combatContentResolver: resolver,
    })
    await service.createSession({
      userId: USER_ID,
      characterId: CHARACTER_ID,
      idempotencyKey: '88888888-8888-4888-8888-888888888888',
    })
    const created = battles.record!.snapshot as BattleAuthoritativeEncounterState
    const source = created.capturedAbilitySources![0]!
    expect(source).toMatchObject({
      contentVersion: 77,
      sourceKind: kind === 'skill' ? 'discipline-skill' : 'resonance',
    })
    expect(Object.isFrozen(source.definition)).toBe(true)
    battles.replaceSnapshot(JSON.parse(JSON.stringify(created)))
    currentSkill = { ...currentSkill, enabled: false, ability: { ...ability, behaviors: [] } }
    resonance = { ...resonance, enabled: false, ability: { ...ability, behaviors: [] } }
    const intent = {
      kind: 'action' as const,
      actionId: source.abilityId,
      behaviorId: 'restore',
      target: { kind: 'self' as const },
    }
    const before = JSON.stringify(battles.record!.snapshot)
    const preview = await createBattlePreviewService(battles.repository, resolver).previewIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      intent,
    })
    expect(preview.preview).toMatchObject({ legal: true, mpCost: 2, actionEconomyCost: 12 })
    expect(JSON.stringify(battles.record!.snapshot)).toBe(before)
    await service.submitIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      idempotencyKey: '99999999-9999-4999-8999-999999999999',
      intent,
    })
    const committed = battles.record!.snapshot as BattleAuthoritativeEncounterState
    expect(readPv1fActionEconomy(committed)!.current).toBe(88)
    expect(committed.capturedAbilitySources![0]!.definition).toEqual(ability)
    battles.replaceSnapshot(JSON.parse(JSON.stringify(committed)))
    const repeated = await createBattlePreviewService(battles.repository, resolver).previewIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 2,
      intent,
    })
    expect(repeated.preview.legal).toBe(false)
    expect(JSON.stringify(await service.getSession(USER_ID, SESSION_ID))).not.toMatch(
      /capturedAbilitySources|conditionTruth|effectOrigin|abilityParticipants/,
    )
  },
)

describe('P3.6 battle Essence authority', () => {
  it.each(['pve', 'pvp'] as const)(
    'enforces persisted Essence cooldown through preview, recast and owner-turn readiness in %s',
    async (combatContext) => {
      const builds = buildRepository(pureSnapshot())
      const battles = battleRepository()
      const service = createBattleSessionService({
        characters: characterRepository(),
        battles: battles.repository,
        builds: builds.repository,
      })
      const preview = createBattlePreviewService(battles.repository)
      await service.createSession({
        userId: USER_ID,
        characterId: CHARACTER_ID,
        idempotencyKey: '88888888-8888-4888-8888-888888888888',
      })
      const spawned = battles.record!.snapshot as BattleAuthoritativeEncounterState
      battles.replaceSnapshot({
        ...positionPlayerAdjacent(spawned),
        buildAuthority: { ...spawned.buildAuthority!, combatContext },
      })
      const essence = resolveEssenceForBuild('vanguard', null)!
      const cooldown = pv1fCooldownForMatureSkill(essence.skill, combatContext)!
      const intent = {
        kind: 'action',
        actionId: essence.skill.id,
        target: { kind: 'unit', combatantId: 'recruit:p2-4-1' },
      } as const
      const castCommand = () => ({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: battles.record!.battleVersion,
        intent,
      })
      await service.submitIntent({
        ...castCommand(),
        idempotencyKey: '99999999-9999-4999-8999-999999999999',
      })

      for (const ticksRemaining of [4, 3, 2, 1]) {
        battles.replaceSnapshot(JSON.parse(JSON.stringify(battles.record!.snapshot)))
        const persisted = battles.record!.snapshot as BattleAuthoritativeEncounterState
        const actor = persisted.tactical.battle.combatants.find((c) => c.id === PLAYER_ID)!
        expect(readSkillCooldown(actor, cooldown)).toMatchObject({ active: true, ticksRemaining })
        expect((await preview.previewIntent(castCommand())).preview).toMatchObject({
          legal: false,
          issues: expect.arrayContaining([expect.objectContaining({ code: 'cooldown-active' })]),
        })
        const before = JSON.stringify(battles.record)
        await expect(
          service.submitIntent({
            ...castCommand(),
            idempotencyKey: `aaaaaaa${ticksRemaining}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
          }),
        ).rejects.toMatchObject({
          code: 'INVALID_REQUEST',
          message: expect.stringContaining('cooling down'),
        })
        expect(JSON.stringify(battles.record)).toBe(before)
        await service.submitIntent({
          userId: USER_ID,
          battleSessionId: SESSION_ID,
          expectedBattleVersion: battles.record!.battleVersion,
          idempotencyKey: `bbbbbbb${ticksRemaining}-bbbb-4bbb-8bbb-bbbbbbbbbbbb`,
          intent: { kind: 'face', facing: 'east' },
        })
        const opponentTurn = battles.record!.snapshot as BattleAuthoritativeEncounterState
        // An opponent's legal final facing brings the clock to the next owner turn.
        const nextOwnerTurn = finishPv1fTurn(opponentTurn, 'west').state
        battles.replaceSnapshot({ ...nextOwnerTurn, buildAuthority: opponentTurn.buildAuthority })
      }
      const ready = battles.record!.snapshot as BattleAuthoritativeEncounterState
      expect(
        readSkillCooldown(
          ready.tactical.battle.combatants.find((c) => c.id === PLAYER_ID)!,
          cooldown,
        ),
      ).toMatchObject({ active: false, ticksRemaining: 0 })
      expect((await preview.previewIntent(castCommand())).preview).toMatchObject({ legal: true })
      await service.submitIntent({
        ...castCommand(),
        idempotencyKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      })
      const reused = battles.record!.snapshot as BattleAuthoritativeEncounterState
      expect(
        readSkillCooldown(
          reused.tactical.battle.combatants.find((c) => c.id === PLAYER_ID)!,
          cooldown,
        ),
      ).toMatchObject({ active: true, ticksRemaining: 4 })
    },
  )

  it('pins the committed pure build and executes Essence through that battle-owned snapshot', async () => {
    const builds = buildRepository(pureSnapshot())
    const battles = battleRepository()
    const service = createBattleSessionService({
      characters: characterRepository(),
      battles: battles.repository,
      builds: builds.repository,
    })

    const created = await service.createSession({
      userId: USER_ID,
      characterId: CHARACTER_ID,
      idempotencyKey: '44444444-4444-4444-8444-444444444444',
    })
    expect(created.snapshot.buildAuthority).toMatchObject({
      schemaVersion: 1,
      combatContext: 'pve',
      combatants: [
        {
          combatantId: PLAYER_ID,
          characterId: CHARACTER_ID,
          buildVersion: 7,
          primary: { disciplineId: 'vanguard' },
          secondary: null,
          extensions: {
            essence: {
              essenceId: 'essence.vanguard.unbroken-strike',
              skillId: 'essence.vanguard.unbroken-strike',
            },
          },
        },
      ],
    })

    const persisted = battles.record?.snapshot as BattleAuthoritativeEncounterState | undefined
    if (!persisted) throw new Error('Expected the persisted battle snapshot.')
    battles.replaceSnapshot(positionPlayerAdjacent(persisted))

    const result = await service.submitIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      idempotencyKey: '55555555-5555-4555-8555-555555555555',
      intent: {
        kind: 'action',
        actionId: 'essence.vanguard.unbroken-strike',
        target: { kind: 'unit', combatantId: 'recruit:p2-4-1' },
      },
    })

    const committed = battles.commitBattleIntent.mock.calls[0]?.[0]
    if (!committed) throw new Error('Expected the Essence battle commit.')
    const next = committed.nextSnapshot as BattleAuthoritativeEncounterState
    expect(readPv1fActionEconomy(next, PLAYER_ID)?.current).toBe(45)
    expect(next.tactical.battle.combatants.find((row) => row.id === 'recruit:p2-4-1')?.hp).toBe(110) // Physical Power now scales the pinned Essence before Armor mitigates each hit.
    expect(committed.events).toContainEqual(
      expect.objectContaining({
        event: 'skill_cooldown_started',
        actionId: 'essence.vanguard.unbroken-strike',
        ownerTurns: 3,
      }),
    )
    expect(committed.events).toContainEqual(
      expect.objectContaining({
        event: 'action_economy_spent',
        combatantId: PLAYER_ID,
        amount: 55,
        remaining: 45,
      }),
    )
    expect(result.snapshot.buildAuthority).toEqual(created.snapshot.buildAuthority)
  })

  it('does not ghost-bind a later Profile build when the battle reconnects', async () => {
    const builds = buildRepository(pureSnapshot())
    const battles = battleRepository()
    const service = createBattleSessionService({
      characters: characterRepository(),
      battles: battles.repository,
      builds: builds.repository,
    })

    const created = await service.createSession({
      userId: USER_ID,
      characterId: CHARACTER_ID,
      idempotencyKey: '66666666-6666-4666-8666-666666666666',
    })
    builds.replace(mixedSnapshot())

    const reconnected = await service.getSession(USER_ID, SESSION_ID)
    expect(builds.loadCommittedBuildSnapshot).toHaveBeenCalledTimes(1)
    expect(reconnected.snapshot.buildAuthority).toEqual(created.snapshot.buildAuthority)
    expect(reconnected.snapshot.buildAuthority?.combatants[0]?.extensions.essence?.essenceId).toBe(
      'essence.vanguard.unbroken-strike',
    )
  })

  it('pins no Essence for a mixed build and rejects fabricated Essence actions before commit', async () => {
    const builds = buildRepository(mixedSnapshot())
    const battles = battleRepository()
    const service = createBattleSessionService({
      characters: characterRepository(),
      battles: battles.repository,
      builds: builds.repository,
    })

    const created = await service.createSession({
      userId: USER_ID,
      characterId: CHARACTER_ID,
      idempotencyKey: '77777777-7777-4777-8777-777777777777',
    })
    expect(created.snapshot.buildAuthority?.combatants[0]?.extensions.essence).toBeNull()

    const before = battles.record?.snapshot as BattleAuthoritativeEncounterState | undefined
    if (!before) throw new Error('Expected the mixed battle snapshot.')
    expect(readPv1fActionEconomy(before, PLAYER_ID)?.current).toBe(100)

    await expect(
      service.submitIntent({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
        idempotencyKey: '88888888-8888-4888-8888-888888888888',
        intent: {
          kind: 'action',
          actionId: 'essence.vanguard.unbroken-strike',
          target: { kind: 'unit', combatantId: 'recruit:p2-4-1' },
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })

    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
    const after = battles.record?.snapshot as BattleAuthoritativeEncounterState | undefined
    expect(after ? readPv1fActionEconomy(after, PLAYER_ID)?.current : null).toBe(100)
  })
})
