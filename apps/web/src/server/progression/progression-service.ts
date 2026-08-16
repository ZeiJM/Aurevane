import 'server-only'

import { createHash } from 'node:crypto'

import type { CharacterXpGrantRecord, ProgressionRepository } from '@aurevane/db/progression'
import {
  createCharacterLevelUpEvent,
  validateLevelProgressionCurve,
  type CharacterLevelUpEvent,
  type CharacterXpGrantSourceKind,
  type LevelProgressionCurve,
} from '@aurevane/game-core/character/progression'
import { AurevaneError } from '@aurevane/game-core/errors'

export const CHARACTER_XP_GRANT_PERMISSION = 'character.xp.grant' as const

const stableTagPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/
const sourceKinds = new Set<CharacterXpGrantSourceKind>(['system', 'gameplay', 'support', 'owner'])

export interface XpGrantAuthority {
  actorKey: string
  permissions: readonly string[]
}

export interface GrantCharacterXpCommand {
  authority: XpGrantAuthority
  characterId: string
  idempotencyKey: string
  sourceKind: CharacterXpGrantSourceKind
  sourceId: string
  reasonTag: string
  amount: number
}

export interface GrantCharacterXpOutcome {
  grant: CharacterXpGrantRecord
  replayed: boolean
  levelUpEvent: CharacterLevelUpEvent | null
}

export async function loadLevelProgressionCurve(
  progressionCycle: number,
  repository: ProgressionRepository,
): Promise<LevelProgressionCurve> {
  if (!Number.isInteger(progressionCycle) || progressionCycle <= 0) {
    throw new AurevaneError('INVALID_REQUEST', 'The progression cycle was not valid.')
  }

  const record = await repository.loadCurveForCycle(progressionCycle)
  const curve: LevelProgressionCurve = {
    version: record.version,
    maxLevel: record.maxLevel,
    cumulativeXpByLevel: record.cumulativeXpByLevel,
  }
  if (validateLevelProgressionCurve(curve).length > 0) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Progression data is unavailable right now.')
  }

  return curve
}

export async function grantCharacterXp(
  command: GrantCharacterXpCommand,
  repository: ProgressionRepository,
): Promise<GrantCharacterXpOutcome> {
  validateAuthority(command.authority)
  validateGrantCommand(command)

  const requestFingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        characterId: command.characterId,
        sourceKind: command.sourceKind,
        sourceId: command.sourceId,
        reasonTag: command.reasonTag,
        amount: command.amount,
      }),
    )
    .digest('hex')

  const outcome = await repository.grantCharacterXp({
    actorKey: command.authority.actorKey,
    commandName: 'character.grant_xp.v1',
    idempotencyKey: command.idempotencyKey,
    requestFingerprint,
    characterId: command.characterId,
    authorityKey: command.authority.actorKey,
    sourceKind: command.sourceKind,
    sourceId: command.sourceId,
    reasonTag: command.reasonTag,
    amount: command.amount,
  })

  if (
    outcome.result.characterId !== command.characterId ||
    outcome.result.authorityKey !== command.authority.actorKey ||
    outcome.result.sourceKind !== command.sourceKind ||
    outcome.result.sourceId !== command.sourceId ||
    outcome.result.reasonTag !== command.reasonTag ||
    outcome.result.requestedAmount !== command.amount
  ) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Progression data is unavailable right now.')
  }

  return {
    grant: outcome.result,
    replayed: outcome.replayed,
    levelUpEvent: outcome.replayed
      ? null
      : createCharacterLevelUpEvent({
          characterId: outcome.result.characterId,
          progressionCycle: outcome.result.progressionCycle,
          curveVersion: outcome.result.curveVersion,
          levelBefore: outcome.result.levelBefore,
          levelAfter: outcome.result.levelAfter,
        }),
  }
}

function validateAuthority(authority: XpGrantAuthority): void {
  if (
    !authority.actorKey.trim() ||
    authority.actorKey.length > 160 ||
    !authority.permissions.includes(CHARACTER_XP_GRANT_PERMISSION)
  ) {
    throw new AurevaneError('FORBIDDEN', 'This server operation cannot grant character XP.')
  }
}

function validateGrantCommand(command: GrantCharacterXpCommand): void {
  if (!sourceKinds.has(command.sourceKind)) {
    throw new AurevaneError('INVALID_REQUEST', 'The XP source category was not valid.')
  }

  if (!isStableTag(command.sourceId, 160) || !isStableTag(command.reasonTag, 120)) {
    throw new AurevaneError('INVALID_REQUEST', 'The XP grant provenance was not valid.')
  }

  if (!Number.isSafeInteger(command.amount) || command.amount <= 0) {
    throw new AurevaneError('INVALID_REQUEST', 'XP grant amount must be a positive whole number.')
  }
}

function isStableTag(value: string, maximumLength: number): boolean {
  return value.length > 0 && value.length <= maximumLength && stableTagPattern.test(value)
}
