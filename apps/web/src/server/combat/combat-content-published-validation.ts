import type { CombatContentVersionRecord } from '@aurevane/db/combat-content'
import {
  BASIC_SKILL_IDS,
  parseBasicSkillDefinition,
  type BasicSkillId,
  type BasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { validateCombatActionDefinition } from '@aurevane/game-core/combat/combat-authoring-validation'
import {
  validateMatureSkillDefinition,
  toMaterializedCombatActionDefinition,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  validateEssenceDefinition,
  type EssenceDefinition,
} from '@aurevane/game-core/combat/essence'
import {
  validateResonanceDefinition,
  type AnyResonanceDefinition,
} from '@aurevane/game-core/combat/resonance'

export class InvalidPublishedCombatContentError extends Error {
  readonly code = 'INVALID_PUBLISHED_COMBAT_CONTENT' as const

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'InvalidPublishedCombatContentError'
  }
}

export function validatePublishedSkill(
  record: CombatContentVersionRecord,
  expectedSkillId: string,
  expectedVersion?: number,
): MatureSkillDefinition {
  if (
    record.contentKind !== 'skill' ||
    record.contentKey !== expectedSkillId ||
    (expectedVersion !== undefined && record.contentVersion !== expectedVersion)
  ) {
    throw new InvalidPublishedCombatContentError(
      `Published Skill metadata does not match ${expectedSkillId}${
        expectedVersion === undefined ? '' : `@${expectedVersion}`
      }.`,
    )
  }

  const candidate = structuredClone(record.definition) as unknown as MatureSkillDefinition
  let issues: readonly string[]
  try {
    issues = validateMatureSkillDefinition(candidate)
  } catch (error) {
    throw new InvalidPublishedCombatContentError(
      `Published Skill ${expectedSkillId}@${record.contentVersion} has an invalid definition shape.`,
      { cause: error },
    )
  }

  if (
    issues.length > 0 ||
    candidate.id !== record.contentKey ||
    candidate.contentVersion !== record.contentVersion
  ) {
    throw new InvalidPublishedCombatContentError(
      `Published Skill ${expectedSkillId}@${record.contentVersion} failed validation${
        issues.length > 0 ? `: ${issues.join(', ')}` : '.'
      }`,
    )
  }

  try {
    if (Object.hasOwn(candidate, 'ability')) return structuredClone(candidate)
    for (const context of ['pve', 'pvp'] as const) {
      validateCombatActionDefinition(
        toMaterializedCombatActionDefinition({ ...candidate, enabled: true }, context),
      )
    }
  } catch (error) {
    throw new InvalidPublishedCombatContentError(
      `Published Skill ${expectedSkillId}@${record.contentVersion} failed combat-action validation.`,
      { cause: error },
    )
  }

  return structuredClone(candidate)
}

export function validatePublishedEssence(
  record: CombatContentVersionRecord,
  expectedEssenceId: string,
  expectedVersion?: number,
): EssenceDefinition {
  if (
    record.contentKind !== 'essence' ||
    record.contentKey !== expectedEssenceId ||
    (expectedVersion !== undefined && record.contentVersion !== expectedVersion)
  ) {
    throw new InvalidPublishedCombatContentError(
      `Published Essence metadata does not match ${expectedEssenceId}${
        expectedVersion === undefined ? '' : `@${expectedVersion}`
      }.`,
    )
  }

  const candidate = structuredClone(record.definition) as unknown as EssenceDefinition
  let issues: readonly string[]
  try {
    issues = validateEssenceDefinition(candidate)
  } catch (error) {
    throw new InvalidPublishedCombatContentError(
      `Published Essence ${expectedEssenceId}@${record.contentVersion} has an invalid definition shape.`,
      { cause: error },
    )
  }
  if (
    issues.length > 0 ||
    candidate.essenceId !== record.contentKey ||
    candidate.contentVersion !== record.contentVersion ||
    candidate.skill.contentVersion !== record.contentVersion
  ) {
    throw new InvalidPublishedCombatContentError(
      `Published Essence ${expectedEssenceId}@${record.contentVersion} failed validation${
        issues.length > 0 ? `: ${issues.join(', ')}` : '.'
      }`,
    )
  }
  return structuredClone(candidate)
}

export function validatePublishedResonance(
  record: CombatContentVersionRecord,
  expectedResonanceId: string,
  expectedVersion?: number,
): AnyResonanceDefinition {
  if (
    record.contentKind !== 'resonance' ||
    record.contentKey !== expectedResonanceId ||
    (expectedVersion !== undefined && record.contentVersion !== expectedVersion)
  ) {
    throw new InvalidPublishedCombatContentError(
      `Published Resonance metadata does not match ${expectedResonanceId}${
        expectedVersion === undefined ? '' : `@${expectedVersion}`
      }.`,
    )
  }

  const candidate = structuredClone(record.definition) as unknown as AnyResonanceDefinition
  let issues: readonly string[]
  try {
    issues = validateResonanceDefinition(candidate)
  } catch (error) {
    throw new InvalidPublishedCombatContentError(
      `Published Resonance ${expectedResonanceId}@${record.contentVersion} has an invalid definition shape.`,
      { cause: error },
    )
  }
  if (
    issues.length > 0 ||
    candidate.id !== record.contentKey ||
    candidate.contentVersion !== record.contentVersion
  ) {
    throw new InvalidPublishedCombatContentError(
      `Published Resonance ${expectedResonanceId}@${record.contentVersion} failed validation${
        issues.length > 0 ? `: ${issues.join(', ')}` : '.'
      }`,
    )
  }
  return structuredClone(candidate)
}

export function isBasicSkillId(id: string): id is BasicSkillId {
  return BASIC_SKILL_IDS.includes(id as BasicSkillId)
}

export function validatePublishedBasicSkill(
  record: CombatContentVersionRecord,
  id: BasicSkillId,
  version?: number,
): BasicSkillDefinition {
  if (
    record.contentKind !== 'skill' ||
    record.contentKey !== id ||
    (version !== undefined && record.contentVersion !== version)
  )
    throw new InvalidPublishedCombatContentError(
      'Published Basic Skill metadata does not match its exact identity.',
    )
  try {
    const basic = parseBasicSkillDefinition(record.definition)
    if (basic.id !== id || basic.contentVersion !== record.contentVersion)
      throw new TypeError('Basic definition identity or version mismatch.')
    return basic
  } catch (cause) {
    throw new InvalidPublishedCombatContentError(
      `Published Basic Skill ${id}@${record.contentVersion} is invalid.`,
      { cause },
    )
  }
}
