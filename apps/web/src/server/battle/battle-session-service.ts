import 'server-only'

import { createHash, randomInt, randomUUID } from 'node:crypto'

import type { BattleSessionRepository } from '@aurevane/db/battle-session'
import type { CharacterRepository } from '@aurevane/db/character'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import {
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
  createTacticalBattleState,
  moveCurrentCombatant,
  selectCurrentFinalFacing,
  type CombatTile,
} from '@aurevane/game-core/combat/board'
import {
  P2_3_COMBAT_CONTENT,
  P2_3_GUARD_ACTION,
  P2_3_UNARMED_ATTACK_PROFILE,
  createBasicAttackDefinition,
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from '@aurevane/game-core/combat/actions'
import { AurevaneError } from '@aurevane/game-core/errors'
import type { BattleIntent } from '@aurevane/validation/combat/battle-session'

const P2_4_RULES_VERSION = 1
const P2_4_CONTENT_VERSION = 1
const P2_4_BASIC_ATTACK = createBasicAttackDefinition(P2_3_UNARMED_ATTACK_PROFILE)
const P2_4_ACTIONS: readonly CombatActionDefinition[] = [P2_4_BASIC_ATTACK, P2_3_GUARD_ACTION]

type ProjectedBattleState = Omit<CombatEncounterState['tactical']['battle'], 'rng'>
type ProjectedTacticalState = Omit<CombatEncounterState['tactical'], 'battle'> & {
  battle: ProjectedBattleState
}

export type BattleSessionProjection = Omit<CombatEncounterState, 'tactical'> & {
  tactical: ProjectedTacticalState
}

export interface BattleSessionView {
  battleSessionId: string
  battleVersion: number
  snapshot: BattleSessionProjection
  replayed: boolean
}

export interface CreateBattleSessionCommand {
  userId: string
  characterId: string
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
}

function invalidBattleIntent(): AurevaneError {
  return new AurevaneError(
    'INVALID_REQUEST',
    'That battle intent is not legal in the current state.',
  )
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

function createVerticalSliceEncounter(characterId: string): CombatEncounterState {
  const playerCombatantId = `character:${characterId}`
  const recruitCombatantId = 'recruit:p2-4-1'
  const battleId = `battle:${randomUUID()}`
  const rngSeed = randomInt(1, 0x1_0000_0000)

  const battle = startBattle(
    createPendingBattle({
      battleId,
      rulesVersion: P2_4_RULES_VERSION,
      contentVersion: P2_4_CONTENT_VERSION,
      rngSeed,
      combatants: [
        {
          id: playerCombatantId,
          teamId: 'players',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
        },
        {
          id: recruitCombatantId,
          teamId: 'opponents',
          initiative: 5,
          baseMovementBudget: 3,
          hp: 80,
          maxHp: 80,
          mp: 25,
          maxMp: 25,
        },
      ],
    }),
  ).state

  const tiles: CombatTile[] = []
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      tiles.push({
        position: { x, y },
        elevation: 0,
        terrainId: x === 2 && y === 1 ? 'rough-ground' : 'open-ground',
      })
    }
  }

  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 5,
      height: 3,
      terrains: P2_2_VERTICAL_SLICE_TERRAINS,
      tiles,
      movementProfiles: [P2_2_ORDINARY_GROUND_PROFILE],
      placements: [
        {
          combatantId: playerCombatantId,
          position: { x: 0, y: 1 },
          facing: 'east',
          movementProfileId: P2_2_ORDINARY_GROUND_PROFILE.id,
        },
        {
          combatantId: recruitCombatantId,
          position: { x: 4, y: 1 },
          facing: 'west',
          movementProfileId: P2_2_ORDINARY_GROUND_PROFILE.id,
        },
      ],
    }),
  )
}

function readPersistedEncounter(snapshot: unknown): CombatEncounterState {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw persistenceInvalid()
  }

  try {
    const candidate = snapshot as CombatEncounterState
    const issues = validateCombatEncounterState(candidate)
    if (issues.length > 0) throw persistenceInvalid()
    return candidate
  } catch (error) {
    if (error instanceof AurevaneError) throw error
    throw persistenceInvalid()
  }
}

function projectBattleSnapshot(state: CombatEncounterState): BattleSessionProjection {
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
  state: CombatEncounterState,
  controlledCombatantIds: readonly string[],
): void {
  if (controlledCombatantIds.length === 0) {
    throw persistenceInvalid()
  }

  const uniqueIds = new Set(controlledCombatantIds)
  if (uniqueIds.size !== controlledCombatantIds.length) {
    throw persistenceInvalid()
  }

  for (const combatantId of controlledCombatantIds) {
    if (!state.tactical.battle.combatants.some((combatant) => combatant.id === combatantId)) {
      throw persistenceInvalid()
    }
  }
}

function assertPlayerControlledTurn(
  state: CombatEncounterState,
  controlledCombatantIds: readonly string[],
): void {
  const battle = state.tactical.battle
  const turn = battle.currentTurn
  if (battle.lifecycle !== 'active' || !turn) {
    throw invalidBattleIntent()
  }

  if (!battle.combatants.some((combatant) => combatant.id === turn.combatantId)) {
    throw persistenceInvalid()
  }
  if (!controlledCombatantIds.includes(turn.combatantId)) {
    throw new AurevaneError(
      'FORBIDDEN',
      'Player battle intents are only accepted during a player-controlled turn.',
    )
  }
}

function findAction(actionId: string): CombatActionDefinition {
  const action = P2_4_ACTIONS.find((candidate) => candidate.id === actionId)
  if (!action) throw invalidBattleIntent()
  return action
}

function resolveIntent(
  state: CombatEncounterState,
  intent: BattleIntent,
): { state: CombatEncounterState; events: readonly unknown[] } {
  try {
    if (intent.kind === 'move') {
      const transition = moveCurrentCombatant(state.tactical, intent.path)
      return {
        state: createCombatEncounterState(transition.state, state.statusState),
        events: transition.events,
      }
    }

    if (intent.kind === 'face') {
      const transition = selectCurrentFinalFacing(state.tactical, intent.facing)
      return {
        state: createCombatEncounterState(transition.state, state.statusState),
        events: transition.events,
      }
    }

    if (intent.kind === 'end-turn') {
      return endCombatTurn(state, P2_3_COMBAT_CONTENT)
    }

    return executeCombatAction(
      state,
      findAction(intent.actionId),
      intent.target,
      P2_3_COMBAT_CONTENT,
    )
  } catch (error) {
    if (error instanceof AurevaneError) throw error
    throw invalidBattleIntent()
  }
}

export function createBattleSessionService({
  characters,
  battles,
}: Dependencies): BattleSessionService {
  return {
    async createSession(command) {
      const character = await characters.findByOwnerSlot(command.userId, 0)
      if (!character || character.id !== command.characterId) {
        throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
      }

      const encounter = createVerticalSliceEncounter(character.id)
      const battle = encounter.tactical.battle
      const persisted = await battles.createBattleSession({
        actorKey: command.userId,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint: fingerprint({
          command: 'battle.create.v1',
          userId: command.userId,
          characterId: command.characterId,
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
      }
    },

    async submitIntent(command) {
      const current = await battles.findBattleSession(command.userId, command.battleSessionId)
      if (!current) throw battleUnavailable()

      const state = readPersistedEncounter(current.snapshot)
      assertControlledCombatantProjection(state, current.controlledCombatantIds)

      const requestFingerprint = fingerprint({
        command: 'battle.intent.v1',
        battleSessionId: command.battleSessionId,
        expectedBattleVersion: command.expectedBattleVersion,
        intent: command.intent,
      })

      if (current.battleVersion !== command.expectedBattleVersion) {
        const replayOrStale = await battles.commitBattleIntent({
          actorKey: command.userId,
          idempotencyKey: command.idempotencyKey,
          requestFingerprint,
          userId: command.userId,
          battleSessionId: command.battleSessionId,
          expectedBattleVersion: command.expectedBattleVersion,
          nextSnapshot: current.snapshot,
          events: [],
        })

        return {
          battleSessionId: replayOrStale.result.battleSessionId,
          battleVersion: replayOrStale.result.battleVersion,
          snapshot: projectBattleSnapshot(readPersistedEncounter(replayOrStale.result.snapshot)),
          replayed: replayOrStale.replayed,
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
      }
    },
  }
}
