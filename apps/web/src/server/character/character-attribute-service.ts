import 'server-only'

import { createHash } from 'node:crypto'

import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributes,
} from '@aurevane/game-core/character/creation'
import {
  foundationDisciplineAttributePolicy,
  validateAttributeAllocation,
} from '@aurevane/game-core/character/attribute-allocation'
import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import { AurevaneError } from '@aurevane/game-core/errors'

export type CharacterAttributeChangeMode = 'spend' | 'reset' | 'convert'

export interface CharacterAttributeAllocationView {
  characterId: string
  attributes: CharacterAttributes
  baseAttributes: CharacterAttributes
  level: number
  pointPool: number
  personalPointPool: number
  spentPoints: number
  unspentPoints: number
  conversionRequired: boolean
  resetWindowStartedAt: string | null
  resetUsed: number
  resetRemaining: number
  resetRenewsAt: string | null
  serverNow: string
}

export interface CommitCharacterAttributeAllocationInput {
  userId: string
  characterId: string
  mode: CharacterAttributeChangeMode
  attributes: CharacterAttributes
  idempotencyKey: string
  requestFingerprint: string
}

export interface CharacterAttributeRepository {
  loadAllocation(
    userId: string,
    characterId: string,
  ): Promise<CharacterAttributeAllocationView | null>
  commitAllocation(
    input: CommitCharacterAttributeAllocationInput,
  ): Promise<{ allocation: CharacterAttributeAllocationView; replayed: boolean }>
}

export async function loadCharacterAttributeAllocation(
  userId: string,
  character: PersistedCharacter,
  repository: CharacterAttributeRepository,
): Promise<CharacterAttributeAllocationView> {
  const allocation = await repository.loadAllocation(userId, character.id)
  if (!allocation) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Character attribute allocation is unavailable right now.',
    )
  }
  return allocation
}

export async function commitCharacterAttributeAllocation(
  userId: string,
  character: PersistedCharacter,
  input: {
    mode: CharacterAttributeChangeMode
    attributes: CharacterAttributes
    idempotencyKey: string
    primaryDisciplineId: string
  },
  repository: CharacterAttributeRepository,
): Promise<{ allocation: CharacterAttributeAllocationView; replayed: boolean }> {
  if (!['spend', 'reset', 'convert'].includes(input.mode)) {
    throw new AurevaneError('INVALID_REQUEST', 'Choose a valid attribute allocation action.')
  }
  if (!isUuid(input.idempotencyKey)) {
    throw new AurevaneError('INVALID_REQUEST', 'The attribute request key is invalid.')
  }

  const current = await loadCharacterAttributeAllocation(userId, character, repository)
  const policy = foundationDisciplineAttributePolicy(input.primaryDisciplineId)
  if (!policy) {
    throw new AurevaneError('INVALID_REQUEST', 'The active Primary Discipline is unavailable.')
  }
  const issues = validateAttributeAllocation({
    attributes: input.attributes,
    level: current.level,
    policy,
    requireFullPool: input.mode === 'reset' || input.mode === 'convert',
  })
  if (issues.length > 0) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      issues[0]?.message ?? 'That attribute allocation is invalid.',
    )
  }

  if (input.mode === 'convert') {
    if (!current.conversionRequired) {
      throw new AurevaneError('INVALID_REQUEST', 'Core Stat conversion is already complete.')
    }
  } else if (current.conversionRequired) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Redistribute your Core Stats once before spending or resetting points.',
    )
  }

  if (input.mode === 'spend') {
    for (const attributeId of CHARACTER_ATTRIBUTE_IDS) {
      if (input.attributes[attributeId] < current.attributes[attributeId]) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Spending earned points cannot reduce an existing attribute. Use Reset Attributes to redistribute.',
        )
      }
    }
    if (sumAttributes(input.attributes) <= current.spentPoints) {
      throw new AurevaneError('INVALID_REQUEST', 'Assign at least one available attribute point.')
    }
  } else if (input.mode === 'reset' && current.resetRemaining <= 0) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'No attribute resets remain in the current 30-day window.',
    )
  }

  const requestFingerprint = `sha256:${createHash('sha256')
    .update(
      JSON.stringify({
        command: 'character.attributes.allocate.v2',
        characterId: character.id,
        mode: input.mode,
        attributes: input.attributes,
        primaryDisciplineId: input.primaryDisciplineId,
      }),
    )
    .digest('hex')}`

  return repository.commitAllocation({
    userId,
    characterId: character.id,
    mode: input.mode,
    attributes: input.attributes,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint,
  })
}

function sumAttributes(attributes: CharacterAttributes): number {
  return CHARACTER_ATTRIBUTE_IDS.reduce((total, attributeId) => total + attributes[attributeId], 0)
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
