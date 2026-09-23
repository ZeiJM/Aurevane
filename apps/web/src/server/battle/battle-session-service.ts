import 'server-only'

import { createHash, randomInt, randomUUID } from 'node:crypto'

import type {
  BattleSessionCommitRecord,
  BattleSessionRepository,
} from '@aurevane/db/battle-session'
import type { TransactionalCommandResult } from '@aurevane/db/transactional-command'
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import { calculateCharacterBuildDerivedStats } from '@aurevane/game-core/character/discipline-build'
import { calculateDerivedStats } from '@aurevane/game-core/character/derived-stats'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import {
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
  createTacticalBattleState,
} from '@aurevane/game-core/combat/board'
import { executePv1fEssenceSkill } from '@aurevane/game-core/combat/essence'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import {
  calculatePv1fBasicAttackDamage,
  createPv1fTemporaryResources,
  executePv1fAction,
  executePv1fCopiedSkill,
  executePv1fMatureSkill,
  executePv1fMovement,
  finishPv1fTurn,
  preparePv1fTurnEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  createCharacterDerivedCombatProfile,
  createStatDrivenCombatEncounterState,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from '@aurevane/game-core/combat/stat-driven-combat'
import {
  getTacticalHallArena,
  type TacticalHallArenaId,
} from '@aurevane/game-core/combat/tactical-hall-arenas'
import { getTacticalHallRecord } from '@aurevane/game-core/combat/tactical-hall-records'
import { AurevaneError, StaleBattleVersionError } from '@aurevane/game-core/errors'
import {
  createBattleSessionChangedInvalidation,
  type BattleSessionChangedInvalidation,
} from '@aurevane/realtime'
import type {
  BattleAiDifficulty,
  BattleHallRecordId,
  BattleIntent,
} from '@aurevane/validation/combat/battle-session'

import type {
  CharacterActiveBuildRecord,
  CharacterBuildRepository,
} from '../character/character-build-service'
import { loadCharacterCommittedBuildSnapshot } from '../character/character-build-service'
import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'
import { battleActionResourceIssue } from './battle-action-resource-availability'
import {
  buildBattlePrivacyJournalInput,
  type BattlePrivacyCommandKind,
} from './battle-history-privacy'
import {
  projectBattleEffectStateForViewer,
  projectBattleStatusStateForViewer,
} from './battle-live-viewer-projection'
import {
  battleBuildAuthorityForCombatant,
  createBattleBuildAuthoritySnapshot,
  createResolvedBattleBuildAuthoritySnapshot,
  parseBattleBuildAuthoritySnapshot,
  resolveBattleDisciplineSkillDefinition,
  resolveBattleEssenceDefinition,
  type BattleBuildAuthoritySnapshot,
} from './battle-build-authority'
import {
  deriveParticipantBattleViewerEntitlement,
  type BattleViewerEntitlement,
} from './battle-viewer-entitlement'
import {
  resolveBattleCopiedSkillCommand,
  resolveBattleSkillCopyContext,
} from './battle-skill-copy-authority'

const PV1F_RULES_VERSION = 3
const PV1F_CONTENT_VERSION = 2
const PV1F_RECRUIT_MOVEMENT_UNITS = 10
const PV1F_RECRUIT_OFFENSIVE_BENCHMARK = calculateDerivedStats({
  attributes: {
    might: 5,
    finesse: 5,
    vitality: 5,
    agility: 5,
    intellect: 5,
    resolve: 5,
  },
  level: 1,
})

export type BattleAuthoritativeEncounterState = StatDrivenCombatEncounterState & {
  buildAuthority?: BattleBuildAuthoritySnapshot
}

type ProjectedBattleState = Omit<BattleAuthoritativeEncounterState['tactical']['battle'], 'rng'>
type ProjectedTacticalState = Omit<BattleAuthoritativeEncounterState['tactical'], 'battle'> & {
  battle: ProjectedBattleState
}
export type BattleSessionProjection = Omit<BattleAuthoritativeEncounterState, 'tactical'> & {
  tactical: ProjectedTacticalState
}

export interface BattleSessionView {
  battleSessionId: string
  battleVersion: number
  snapshot: BattleSessionProjection
  replayed: boolean
  invalidation: BattleSessionChangedInvalidation | null
}

export interface CreateBattleSessionCommand {
  userId: string
  characterId: string
  arenaId?: TacticalHallArenaId
  aiDifficulty?: BattleAiDifficulty
  battleHallRecordId?: BattleHallRecordId
  idempotencyKey: string
}

export interface SubmitBattleIntentCommand {
  userId: string
  battleSessionId: string
  expectedBattleVersion: number
  idempotencyKey: string
  intent: BattleIntent
}

export interface BattleSessionService {
  createSession(command: CreateBattleSessionCommand): Promise<BattleSessionView>
  getSession(userId: string, battleSessionId: string): Promise<BattleSessionView>
  submitIntent(command: SubmitBattleIntentCommand): Promise<BattleSessionView>
}

interface Dependencies {
  characters: CharacterRepository
  battles: BattleSessionRepository
  builds?: CharacterBuildRepository
  combatContentResolver?: CombatContentResolver
}

function battleIntentPrivacyKind(kind: BattleIntent['kind']): BattlePrivacyCommandKind {
  if (kind === 'action') return 'action'
  if (kind === 'move') return 'move'
  if (kind === 'face') return 'face'
  return 'system'
}

function invalidBattleIntent(
  message = 'That battle command is not legal in the current state.',
): AurevaneError {
  return new AurevaneError('INVALID_REQUEST', message)
}

function battleUnavailable(): AurevaneError {
  return new AurevaneError('FORBIDDEN', 'That battle is not available to this account.')
}

function persistenceInvalid(): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The stored battle state is invalid.')
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

function authoritativeBattleHallAiDifficulty(
  battleHallRecordId: BattleHallRecordId,
): BattleAiDifficulty {
  return getTacticalHallRecord(battleHallRecordId).combinedDuel ? 'high' : 'easy'
}

function recruitScenarioProfile(
  arenaId: TacticalHallArenaId,
  difficulty: BattleAiDifficulty,
  battleHallRecordId: BattleHallRecordId,
  level: number,
): Omit<StatDrivenCombatProfile, 'combatantId'> {
  return {
    provenance: {
      kind: 'scenario',
      sourceId: `scenario:p2-7-recruit:${arenaId}:${battleHallRecordId}:${difficulty}`,
      sourceRulesVersion: PV1F_CONTENT_VERSION,
    },
    // Difficulty changes decision quality only. All three Recruit tiers obey the same visible stats.
    accuracy: 7_000,
    evasion: 800,
    armor: 20,
    ward: 20,
    jump: 1,
    level,
    physicalPower: PV1F_RECRUIT_OFFENSIVE_BENCHMARK.stats.physicalPower.value,
    mysticPower: PV1F_RECRUIT_OFFENSIVE_BENCHMARK.stats.mysticPower.value,
    criticalChance: PV1F_RECRUIT_OFFENSIVE_BENCHMARK.stats.criticalChance.value,
  }
}

function createVerticalSliceEncounter(
  character: CharacterRecord,
  arenaId: TacticalHallArenaId,
  aiDifficulty: BattleAiDifficulty,
  battleHallRecordId: BattleHallRecordId,
  committedBuild: CharacterActiveBuildRecord | null,
): StatDrivenCombatEncounterState {
  const arena = getTacticalHallArena(arenaId)
  const playerCombatantId = `character:${character.id}`
  const recruitCombatantId = 'recruit:p2-4-1'
  const attributes = {
    might: character.might,
    finesse: character.finesse,
    vitality: character.vitality,
    agility: character.agility,
    intellect: character.intellect,
    resolve: character.resolve,
  }
  const derived = committedBuild
    ? calculateCharacterBuildDerivedStats({
        attributes,
        level: character.level,
        primaryDefinition: committedBuild.primaryDefinition,
        primaryProfile: committedBuild.primaryProfile,
      })
    : calculateDerivedStats({ attributes, level: character.level })
  const playerProfile = createCharacterDerivedCombatProfile(
    playerCombatantId,
    character.id,
    character.level,
    derived,
  )
  const recruitProfile: StatDrivenCombatProfile = {
    combatantId: recruitCombatantId,
    ...recruitScenarioProfile(arenaId, aiDifficulty, battleHallRecordId, character.level),
  }
  const playerMovementProfile = {
    ...P2_2_ORDINARY_GROUND_PROFILE,
    id: `character-ground:${character.id}`,
    maxElevationStep: derived.stats.jump.value,
  }
  const playerAttackDamage = calculatePv1fBasicAttackDamage({
    physicalPower: derived.stats.physicalPower.value,
  })
  const recruitAttackDamage = calculatePv1fBasicAttackDamage({
    physicalPower: PV1F_RECRUIT_OFFENSIVE_BENCHMARK.stats.physicalPower.value,
  })

  const battle = startBattle(
    createPendingBattle({
      battleId: `battle:${randomUUID()}`,
      rulesVersion: PV1F_RULES_VERSION,
      contentVersion: PV1F_CONTENT_VERSION,
      rngSeed: randomInt(1, 0x1_0000_0000),
      combatants: [
        {
          id: playerCombatantId,
          teamId: 'players',
          initiative: derived.stats.initiative.value,
          baseMovementBudget: derived.stats.movement.value,
          hp: derived.stats.maxHp.value,
          maxHp: derived.stats.maxHp.value,
          mp: derived.stats.maxMp.value,
          maxMp: derived.stats.maxMp.value,
          temporaryResources: createPv1fTemporaryResources(playerAttackDamage),
        },
        {
          id: recruitCombatantId,
          teamId: 'opponents',
          initiative: 5,
          baseMovementBudget: PV1F_RECRUIT_MOVEMENT_UNITS,
          hp: 80,
          maxHp: 80,
          mp: 25,
          maxMp: 25,
          temporaryResources: createPv1fTemporaryResources(recruitAttackDamage),
        },
      ],
    }),
  ).state

  const encounter = createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: arena.width,
      height: arena.height,
      terrains: P2_2_VERTICAL_SLICE_TERRAINS,
      tiles: arena.tiles,
      movementProfiles: [playerMovementProfile, P2_2_ORDINARY_GROUND_PROFILE],
      placements: [
        {
          combatantId: playerCombatantId,
          position: arena.playerSpawn,
          facing: 'east',
          movementProfileId: playerMovementProfile.id,
        },
        {
          combatantId: recruitCombatantId,
          position: arena.recruitSpawn,
          facing: 'west',
          movementProfileId: P2_2_ORDINARY_GROUND_PROFILE.id,
        },
      ],
    }),
  )

  return preparePv1fTurnEconomy(
    createStatDrivenCombatEncounterState(encounter, [playerProfile, recruitProfile]),
  )
}

function validateBattleBuildAuthorityCoverage(
  state: StatDrivenCombatEncounterState,
  authority: BattleBuildAuthoritySnapshot,
): void {
  const characterProfiles = state.statBridge.combatants.filter(
    (profile) => profile.provenance.kind === 'character-derived',
  )
  if (characterProfiles.length !== authority.combatants.length) throw persistenceInvalid()

  for (const profile of characterProfiles) {
    const build = battleBuildAuthorityForCombatant(authority, profile.combatantId)
    if (
      !build ||
      profile.provenance.sourceId !== `character:${build.characterId}` ||
      build.combatantId !== profile.combatantId
    ) {
      throw persistenceInvalid()
    }
  }
}

function readPersistedEncounter(snapshot: unknown): BattleAuthoritativeEncounterState {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw persistenceInvalid()
  }
  try {
    const candidate = snapshot as BattleAuthoritativeEncounterState
    const issues = validateStatDrivenCombatEncounterState(candidate)
    if (issues.length > 0) throw persistenceInvalid()

    if (!Object.prototype.hasOwnProperty.call(candidate, 'buildAuthority')) return candidate
    const authority = parseBattleBuildAuthoritySnapshot(candidate.buildAuthority)
    if (!authority) throw persistenceInvalid()
    validateBattleBuildAuthorityCoverage(candidate, authority)
    return { ...candidate, buildAuthority: authority }
  } catch (error) {
    if (error instanceof AurevaneError) throw error
    throw persistenceInvalid()
  }
}

function deriveBattleViewerEntitlement(
  state: BattleAuthoritativeEncounterState,
  controlledCombatantIds: readonly string[],
): BattleViewerEntitlement {
  try {
    return deriveParticipantBattleViewerEntitlement(
      state.tactical.battle.combatants,
      controlledCombatantIds,
    )
  } catch {
    throw persistenceInvalid()
  }
}

function projectBattleSnapshot(
  state: BattleAuthoritativeEncounterState,
  viewer: BattleViewerEntitlement,
): BattleSessionProjection {
  const battle = state.tactical.battle
  return {
    ...state,
    statusState: projectBattleStatusStateForViewer(state, viewer),
    ...(state.effectState ? { effectState: projectBattleEffectStateForViewer(state, viewer) } : {}),
    tactical: {
      ...state.tactical,
      battle: {
        schemaVersion: battle.schemaVersion,
        battleId: battle.battleId,
        rulesVersion: battle.rulesVersion,
        contentVersion: battle.contentVersion,
        lifecycle: battle.lifecycle,
        combatants: battle.combatants,
        initiativeOrder: battle.initiativeOrder,
        ...(battle.roundInitiativeModifiers
          ? { roundInitiativeModifiers: battle.roundInitiativeModifiers }
          : {}),
        round: battle.round,
        turnNumber: battle.turnNumber,
        currentTurn: battle.currentTurn,
      },
    },
  }
}

export function projectCommittedBattleSession(
  committed: TransactionalCommandResult<BattleSessionCommitRecord>,
  controlledCombatantIds: readonly string[],
): BattleSessionView {
  const state = readPersistedEncounter(committed.result.snapshot)
  const viewer = deriveBattleViewerEntitlement(state, controlledCombatantIds)
  return {
    battleSessionId: committed.result.battleSessionId,
    battleVersion: committed.result.battleVersion,
    snapshot: projectBattleSnapshot(state, viewer),
    replayed: committed.replayed,
    invalidation: createBattleSessionChangedInvalidation({
      battleSessionId: committed.result.battleSessionId,
      battleVersion: committed.result.battleVersion,
      occurredAt: committed.result.committedAt,
      reason: 'state_changed',
    }),
  }
}

function assertPlayerControlledTurn(
  state: BattleAuthoritativeEncounterState,
  controlledCombatantIds: readonly string[],
): void {
  const battle = state.tactical.battle
  const turn = battle.currentTurn
  if (battle.lifecycle !== 'active' || !turn) throw invalidBattleIntent()
  if (!controlledCombatantIds.includes(turn.combatantId)) {
    throw new AurevaneError(
      'FORBIDDEN',
      'Player battle commands are accepted only during the selected character’s turn.',
    )
  }
}

function preserveBuildAuthority(
  source: BattleAuthoritativeEncounterState,
  transition: { state: StatDrivenCombatEncounterState; events: readonly unknown[] },
): { state: BattleAuthoritativeEncounterState; events: readonly unknown[] } {
  return {
    state: source.buildAuthority
      ? { ...transition.state, buildAuthority: source.buildAuthority }
      : transition.state,
    events: transition.events,
  }
}

async function resolveIntent(
  state: BattleAuthoritativeEncounterState,
  intent: BattleIntent,
  combatContentResolver?: CombatContentResolver,
): Promise<{ state: BattleAuthoritativeEncounterState; events: readonly unknown[] }> {
  try {
    if (intent.kind === 'move') {
      return preserveBuildAuthority(state, executePv1fMovement(state, intent.path))
    }
    if (intent.kind === 'action') {
      const resourceIssue = battleActionResourceIssue(state, intent)
      if (resourceIssue) throw invalidBattleIntent(resourceIssue.message)

      const actorId = state.tactical.battle.currentTurn?.combatantId
      const build = actorId ? battleBuildAuthorityForCombatant(state.buildAuthority, actorId) : null
      const essence = actorId ? resolveBattleEssenceDefinition(state.buildAuthority, actorId) : null
      const copiedCommand = actorId
        ? await resolveBattleCopiedSkillCommand(
            state,
            actorId,
            intent.actionId,
            combatContentResolver,
          )
        : null
      if (copiedCommand) {
        if (!copiedCommand.definition || !state.buildAuthority) throw persistenceInvalid()
        const copyContext =
          copiedCommand.definition.effects.some((effect) => effect.type === 'copy') &&
          intent.target.kind === 'unit'
            ? await resolveBattleSkillCopyContext(
                state,
                actorId ?? '',
                intent.target.combatantId,
                combatContentResolver,
              )
            : undefined
        if (copyContext === null) throw persistenceInvalid()
        return preserveBuildAuthority(
          state,
          executePv1fCopiedSkill(
            state,
            copiedCommand.definition,
            intent.target,
            state.buildAuthority.combatContext,
            copyContext,
          ),
        )
      }
      if (build && essence && intent.actionId === essence.skill.id && state.buildAuthority) {
        return preserveBuildAuthority(
          state,
          executePv1fEssenceSkill({
            state,
            essence,
            primaryDisciplineId: build.primary.disciplineId,
            secondaryDisciplineId: build.secondary?.disciplineId ?? null,
            combatContext: state.buildAuthority.combatContext,
            selection: intent.target,
          }),
        )
      }

      const taggedTechnique = build?.disciplineSkills.find(
        (reference) => reference.skillId === intent.actionId,
      )
      if (taggedTechnique && state.buildAuthority) {
        const definition = await resolveBattleDisciplineSkillDefinition(
          state.buildAuthority,
          actorId ?? '',
          taggedTechnique.skillId,
          combatContentResolver,
        )
        if (!definition) {
          if (state.buildAuthority.catalogVersion === 3) throw persistenceInvalid()
          throw invalidBattleIntent('That tagged Technique is no longer available.')
        }
        const copyContext =
          definition.effects.some((effect) => effect.type === 'copy') &&
          intent.target.kind === 'unit'
            ? await resolveBattleSkillCopyContext(
                state,
                actorId ?? '',
                intent.target.combatantId,
                combatContentResolver,
              )
            : undefined
        if (copyContext === null) throw persistenceInvalid()
        return preserveBuildAuthority(
          state,
          executePv1fMatureSkill(
            state,
            definition,
            intent.target,
            state.buildAuthority.combatContext,
            copyContext ? { copyContext } : {},
          ),
        )
      }
      if (resolveMatureSkillVersion(intent.actionId)) {
        throw invalidBattleIntent('That Technique is not tagged in this battle build.')
      }

      return preserveBuildAuthority(state, executePv1fAction(state, intent.actionId, intent.target))
    }
    if (intent.kind === 'face') {
      return preserveBuildAuthority(state, finishPv1fTurn(state, intent.facing))
    }
    throw invalidBattleIntent('Choose a final facing direction to finish the turn.')
  } catch (error) {
    if (error instanceof AurevaneError) throw error
    throw invalidBattleIntent(error instanceof Error ? error.message : undefined)
  }
}

async function findOwnedCharacter(
  repository: CharacterRepository,
  userId: string,
  characterId: string,
): Promise<CharacterRecord | null> {
  if (repository.findByOwnerId) {
    return repository.findByOwnerId(userId, characterId)
  }

  // Compatibility path for the pre-PV-1F isolated tests, which model only base slot 0.
  const legacy = await repository.findByOwnerSlot(userId, 0)
  return legacy?.id === characterId ? legacy : null
}

export function createBattleSessionService({
  characters,
  battles,
  builds,
  combatContentResolver,
}: Dependencies): BattleSessionService {
  return {
    async createSession(command) {
      const [characterResult, committedBuildResult, committedBuildSnapshotResult] =
        await Promise.allSettled([
          findOwnedCharacter(characters, command.userId, command.characterId),
          builds
            ? builds.findActiveBuild(command.userId, command.characterId)
            : Promise.resolve(null),
          builds
            ? loadCharacterCommittedBuildSnapshot(command.userId, command.characterId, builds)
            : Promise.resolve(null),
        ])
      if (characterResult.status === 'rejected') throw characterResult.reason
      const character = characterResult.value
      if (!character) {
        throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
      }

      if (committedBuildResult.status === 'rejected') throw committedBuildResult.reason
      if (committedBuildSnapshotResult.status === 'rejected') {
        throw committedBuildSnapshotResult.reason
      }
      const committedBuild = committedBuildResult.value
      const committedBuildSnapshot = committedBuildSnapshotResult.value

      if (builds && (!committedBuild || !committedBuildSnapshot)) {
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'The committed character build is unavailable right now.',
        )
      }

      const battleHallRecordId = command.battleHallRecordId ?? 'recruit-sparring'
      const arenaId =
        battleHallRecordId === 'mastery-trial'
          ? getTacticalHallRecord(battleHallRecordId).defaultArenaId
          : (command.arenaId ?? 'basic-training-floor')
      // Battle Hall difficulty is server-owned: full duels always use High AI,
      // while guided/legacy teaching records stay Easy regardless of client input.
      const aiDifficulty = authoritativeBattleHallAiDifficulty(battleHallRecordId)
      const baseEncounter = createVerticalSliceEncounter(
        character,
        arenaId,
        aiDifficulty,
        battleHallRecordId,
        committedBuild,
      )
      let encounter: BattleAuthoritativeEncounterState = baseEncounter
      if (builds) {
        if (!committedBuildSnapshot) {
          throw new AurevaneError(
            'PERSISTENCE_UNAVAILABLE',
            'The committed character build is unavailable right now.',
          )
        }
        encounter = {
          ...baseEncounter,
          buildAuthority: combatContentResolver
            ? await createResolvedBattleBuildAuthoritySnapshot(
                'pve',
                [
                  {
                    combatantId: `character:${character.id}`,
                    characterId: character.id,
                    snapshot: committedBuildSnapshot,
                  },
                ],
                combatContentResolver,
              )
            : createBattleBuildAuthoritySnapshot('pve', [
                {
                  combatantId: `character:${character.id}`,
                  characterId: character.id,
                  snapshot: committedBuildSnapshot,
                },
              ]),
        }
      }
      const battle = encounter.tactical.battle
      const persisted = await battles.createBattleSession({
        actorKey: command.userId,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint: fingerprint({
          command: 'battle.create.v4',
          userId: command.userId,
          characterId: command.characterId,
          arenaId,
          aiDifficulty,
          battleHallRecordId,
        }),
        userId: command.userId,
        battleId: battle.battleId,
        rulesVersion: battle.rulesVersion,
        contentVersion: battle.contentVersion,
        initialSnapshot: encounter,
        participants: [
          {
            combatantId: `character:${character.id}`,
            participantRole: 'player',
            characterId: character.id,
          },
          {
            combatantId: 'recruit:p2-4-1',
            participantRole: 'opponent',
            characterId: null,
          },
        ],
      })
      const persistedState = readPersistedEncounter(persisted.result.snapshot)
      const viewer = deriveBattleViewerEntitlement(persistedState, [`character:${character.id}`])

      return {
        battleSessionId: persisted.result.battleSessionId,
        battleVersion: persisted.result.battleVersion,
        snapshot: projectBattleSnapshot(persistedState, viewer),
        replayed: persisted.replayed,
        invalidation: createBattleSessionChangedInvalidation({
          battleSessionId: persisted.result.battleSessionId,
          battleVersion: persisted.result.battleVersion,
          occurredAt: persisted.result.createdAt,
          reason: 'created',
        }),
      }
    },

    async getSession(userId, battleSessionId) {
      const persisted = await battles.findBattleSession(userId, battleSessionId)
      if (!persisted) throw battleUnavailable()
      const snapshot = readPersistedEncounter(persisted.snapshot)
      if (
        snapshot.tactical.battle.battleId !== persisted.battleId ||
        snapshot.tactical.battle.rulesVersion !== persisted.rulesVersion ||
        snapshot.tactical.battle.contentVersion !== persisted.contentVersion
      ) {
        throw persistenceInvalid()
      }
      const viewer = deriveBattleViewerEntitlement(snapshot, persisted.controlledCombatantIds)
      return {
        battleSessionId: persisted.battleSessionId,
        battleVersion: persisted.battleVersion,
        snapshot: projectBattleSnapshot(snapshot, viewer),
        replayed: false,
        invalidation: null,
      }
    },

    async submitIntent(command) {
      const current = await battles.findBattleSession(command.userId, command.battleSessionId)
      if (!current) throw battleUnavailable()
      const state = readPersistedEncounter(current.snapshot)
      deriveBattleViewerEntitlement(state, current.controlledCombatantIds)
      const requestFingerprint = fingerprint({
        command: 'battle.intent.v3',
        battleSessionId: command.battleSessionId,
        expectedBattleVersion: command.expectedBattleVersion,
        intent: command.intent,
      })

      if (current.battleVersion !== command.expectedBattleVersion) {
        const replay = await battles.findBattleIntentReplay({
          actorKey: command.userId,
          idempotencyKey: command.idempotencyKey,
          requestFingerprint,
          userId: command.userId,
          battleSessionId: command.battleSessionId,
        })

        if (!replay) {
          throw new StaleBattleVersionError(current.battleVersion)
        }

        const replayState = readPersistedEncounter(replay.snapshot)
        const replayViewer = deriveBattleViewerEntitlement(
          replayState,
          current.controlledCombatantIds,
        )
        return {
          battleSessionId: replay.battleSessionId,
          battleVersion: replay.battleVersion,
          snapshot: projectBattleSnapshot(replayState, replayViewer),
          replayed: true,
          invalidation: createBattleSessionChangedInvalidation({
            battleSessionId: replay.battleSessionId,
            battleVersion: replay.battleVersion,
            occurredAt: replay.committedAt,
            reason: 'state_changed',
          }),
        }
      }

      assertPlayerControlledTurn(state, current.controlledCombatantIds)
      const resolved = await resolveIntent(state, command.intent, combatContentResolver)
      const privacyJournal = buildBattlePrivacyJournalInput({
        before: state,
        after: resolved.state,
        commandKind: battleIntentPrivacyKind(command.intent.kind),
        events: resolved.events,
      })
      const committed = await battles.commitBattleIntent({
        actorKey: command.userId,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint,
        userId: command.userId,
        battleSessionId: command.battleSessionId,
        expectedBattleVersion: command.expectedBattleVersion,
        nextSnapshot: resolved.state,
        events: resolved.events,

        privacyJournal,
      })

      return projectCommittedBattleSession(committed, current.controlledCombatantIds)
    },
  }
}
