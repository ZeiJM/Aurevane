import 'server-only'

import { createHash, randomInt, randomUUID } from 'node:crypto'

import type { BattleSessionRepository } from '@aurevane/db/battle-session'
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import { calculateDerivedStats } from '@aurevane/game-core/character/derived-stats'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import {
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
  createTacticalBattleState,
} from '@aurevane/game-core/combat/board'
import { executePv1fEssenceSkill } from '@aurevane/game-core/combat/essence'
import {
  calculatePv1fBasicAttackDamage,
  createPv1fTemporaryResources,
  executePv1fAction,
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

import type { CharacterBuildRepository } from '../character/character-build-service'
import { loadCharacterCommittedBuildSnapshot } from '../character/character-build-service'
import { battleActionResourceIssue } from './battle-action-resource-availability'
import {
  battleBuildAuthorityForCombatant,
  createBattleBuildAuthoritySnapshot,
  parseBattleBuildAuthoritySnapshot,
  resolveBattleEssenceDefinition,
  type BattleBuildAuthoritySnapshot,
} from './battle-build-authority'

const PV1F_RULES_VERSION = 2
const PV1F_CONTENT_VERSION = 2
const PV1F_BASE_MOVEMENT_UNITS = 10

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

function recruitScenarioProfile(
  arenaId: TacticalHallArenaId,
  difficulty: BattleAiDifficulty,
  battleHallRecordId: BattleHallRecordId,
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
  }
}

function createVerticalSliceEncounter(
  character: CharacterRecord,
  arenaId: TacticalHallArenaId,
  aiDifficulty: BattleAiDifficulty,
  battleHallRecordId: BattleHallRecordId,
): StatDrivenCombatEncounterState {
  const arena = getTacticalHallArena(arenaId)
  const playerCombatantId = `character:${character.id}`
  const recruitCombatantId = 'recruit:p2-4-1'
  const derived = calculateDerivedStats({
    attributes: {
      might: character.might,
      finesse: character.finesse,
      vitality: character.vitality,
      agility: character.agility,
      intellect: character.intellect,
      resolve: character.resolve,
    },
    level: character.level,
  })
  const playerProfile = createCharacterDerivedCombatProfile(
    playerCombatantId,
    character.id,
    derived,
  )
  const recruitProfile: StatDrivenCombatProfile = {
    combatantId: recruitCombatantId,
    ...recruitScenarioProfile(arenaId, aiDifficulty, battleHallRecordId),
  }
  const playerMovementProfile = {
    ...P2_2_ORDINARY_GROUND_PROFILE,
    id: `character-ground:${character.id}`,
    maxElevationStep: derived.stats.jump.value,
  }
  const playerAttackDamage = calculatePv1fBasicAttackDamage({
    level: character.level,
    might: character.might,
    finesse: character.finesse,
  })
  const recruitAttackDamage = calculatePv1fBasicAttackDamage({
    level: 1,
    might: 5,
    finesse: 5,
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
          baseMovementBudget: PV1F_BASE_MOVEMENT_UNITS,
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
          baseMovementBudget: PV1F_BASE_MOVEMENT_UNITS,
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

function projectBattleSnapshot(state: BattleAuthoritativeEncounterState): BattleSessionProjection {
  const battle = state.tactical.battle
  return {
    ...state,
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
        round: battle.round,
        turnNumber: battle.turnNumber,
        currentTurn: battle.currentTurn,
      },
    },
  }
}

function assertControlledCombatantProjection(
  state: BattleAuthoritativeEncounterState,
  controlledCombatantIds: readonly string[],
): void {
  if (
    controlledCombatantIds.length === 0 ||
    new Set(controlledCombatantIds).size !== controlledCombatantIds.length
  ) {
    throw persistenceInvalid()
  }
  for (const combatantId of controlledCombatantIds) {
    if (!state.tactical.battle.combatants.some((combatant) => combatant.id === combatantId)) {
      throw persistenceInvalid()
    }
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

function resolveIntent(
  state: BattleAuthoritativeEncounterState,
  intent: BattleIntent,
): { state: BattleAuthoritativeEncounterState; events: readonly unknown[] } {
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
}: Dependencies): BattleSessionService {
  return {
    async createSession(command) {
      const character = await findOwnedCharacter(characters, command.userId, command.characterId)
      if (!character) {
        throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
      }

      const arenaId = command.arenaId ?? 'basic-training-floor'
      const aiDifficulty = command.aiDifficulty ?? 'standard'
      const battleHallRecordId = command.battleHallRecordId ?? 'recruit-sparring'
      const baseEncounter = createVerticalSliceEncounter(
        character,
        arenaId,
        aiDifficulty,
        battleHallRecordId,
      )
      const encounter: BattleAuthoritativeEncounterState = builds
        ? {
            ...baseEncounter,
            buildAuthority: createBattleBuildAuthoritySnapshot('pve', [
              {
                combatantId: `character:${character.id}`,
                characterId: character.id,
                snapshot: await loadCharacterCommittedBuildSnapshot(
                  command.userId,
                  character.id,
                  builds,
                ),
              },
            ]),
          }
        : baseEncounter
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

      return {
        battleSessionId: persisted.result.battleSessionId,
        battleVersion: persisted.result.battleVersion,
        snapshot: projectBattleSnapshot(readPersistedEncounter(persisted.result.snapshot)),
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
      assertControlledCombatantProjection(snapshot, persisted.controlledCombatantIds)
      return {
        battleSessionId: persisted.battleSessionId,
        battleVersion: persisted.battleVersion,
        snapshot: projectBattleSnapshot(snapshot),
        replayed: false,
        invalidation: null,
      }
    },

    async submitIntent(command) {
      const current = await battles.findBattleSession(command.userId, command.battleSessionId)
      if (!current) throw battleUnavailable()
      const state = readPersistedEncounter(current.snapshot)
      assertControlledCombatantProjection(state, current.controlledCombatantIds)
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

        return {
          battleSessionId: replay.battleSessionId,
          battleVersion: replay.battleVersion,
          snapshot: projectBattleSnapshot(readPersistedEncounter(replay.snapshot)),
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
      const resolved = resolveIntent(state, command.intent)
      const committed = await battles.commitBattleIntent({
        actorKey: command.userId,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint,
        userId: command.userId,
        battleSessionId: command.battleSessionId,
        expectedBattleVersion: command.expectedBattleVersion,
        nextSnapshot: resolved.state,
        events: resolved.events,
      })

      return {
        battleSessionId: committed.result.battleSessionId,
        battleVersion: committed.result.battleVersion,
        snapshot: projectBattleSnapshot(readPersistedEncounter(committed.result.snapshot)),
        replayed: committed.replayed,
        invalidation: createBattleSessionChangedInvalidation({
          battleSessionId: committed.result.battleSessionId,
          battleVersion: committed.result.battleVersion,
          occurredAt: committed.result.committedAt,
          reason: 'state_changed',
        }),
      }
    },
  }
}
