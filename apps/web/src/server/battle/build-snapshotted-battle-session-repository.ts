import 'server-only'

import { createHash } from 'node:crypto'

import type {
  BattleSessionRepository,
  CreateBattleSessionInput,
} from '@aurevane/db/battle-session'
import {
  attachCombatBuildBridge,
  type CombatBuildBridgeEntry,
} from '@aurevane/game-core/combat/build-snapshot'
import {
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError } from '@aurevane/game-core/errors'

import { loadCharacterCombatBuildSnapshot } from '@/server/character/character-combat-build-snapshot'
import type { CharacterBuildRepository } from '@/server/character/character-build-service'

interface Dependencies {
  battles: BattleSessionRepository
  builds: CharacterBuildRepository
}

export function createBuildSnapshottedBattleSessionRepository({
  battles,
  builds,
}: Dependencies): BattleSessionRepository {
  return {
    async createBattleSession(input) {
      const state = parseEncounter(input.initialSnapshot)
      const characterParticipants = input.participants.filter(
        (participant) => participant.characterId !== null,
      )
      if (characterParticipants.length === 0) {
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'A new battle must have at least one committed character build snapshot.',
        )
      }

      const entries: CombatBuildBridgeEntry[] = []
      for (const participant of characterParticipants) {
        const characterId = participant.characterId
        if (!characterId) continue
        entries.push({
          combatantId: participant.combatantId,
          characterId,
          snapshot: await loadCharacterCombatBuildSnapshot(input.userId, characterId, builds),
        })
      }
      const initialSnapshot = attachCombatBuildBridge(state, entries)
      return battles.createBattleSession({
        ...input,
        requestFingerprint: freezeFingerprint(input, entries),
        initialSnapshot,
      })
    },
    findBattleSession(userId, battleSessionId) {
      return battles.findBattleSession(userId, battleSessionId)
    },
    findBattleIntentReplay(input) {
      return battles.findBattleIntentReplay(input)
    },
    commitBattleIntent(input) {
      return battles.commitBattleIntent(input)
    },
  }
}

function parseEncounter(value: unknown): StatDrivenCombatEncounterState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidInitialSnapshot()
  }
  const state = value as StatDrivenCombatEncounterState
  if (validateStatDrivenCombatEncounterState(state).length > 0) throw invalidInitialSnapshot()
  return state
}

function freezeFingerprint(
  input: CreateBattleSessionInput,
  entries: readonly CombatBuildBridgeEntry[],
): string {
  const builds = [...entries]
    .sort((left, right) => left.combatantId.localeCompare(right.combatantId))
    .map((entry) => ({
      combatantId: entry.combatantId,
      characterId: entry.characterId,
      fingerprint: entry.snapshot.fingerprint,
      sourceBuildVersion: entry.snapshot.sourceBuildVersion,
    }))
  return `sha256:${createHash('sha256')
    .update(
      JSON.stringify({
        command: 'battle.create.build-snapshot.v1',
        requestFingerprint: input.requestFingerprint,
        builds,
      }),
    )
    .digest('hex')}`
}

function invalidInitialSnapshot(): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The new battle snapshot is invalid.')
}
