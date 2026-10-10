import {
  validateResonanceDefinition,
  canonicalResonancePair,
  type AnyResonanceDefinition,
} from './resonance'
import type { CombatActionSourceType } from './actions'
import { assertNever, type CombatActionSourceKind } from './combat-kernel-types'
import type { CombatEncounterState } from './actions'
import type { MatureSkillDefinition } from './mature-skills'
import { validateMatureSkillDefinition } from './mature-skills'
import {
  captureCombatAbilitySource,
  type CapturedCombatAbilitySource,
} from './combat-behavior-capture'

export function canonicalCombatActionSourceKind(
  sourceType: CombatActionSourceType,
): CombatActionSourceKind {
  switch (sourceType) {
    case 'basic-attack':
    case 'basic-action':
      return 'basic'
    case 'discipline-skill':
      return 'discipline-skill'
    case 'scenario':
      return 'scenario'
    case 'test':
      return 'test'
    default:
      return assertNever(sourceType, 'CombatActionSourceType')
  }
}

/** Encounter captures outrank later catalogue objects, including mutated same-version rows. */
export function capturedMatureSkillAbilitySource(
  state: CombatEncounterState,
  definition: MatureSkillDefinition,
  ownerCombatantId = state.tactical.battle.currentTurn?.combatantId,
): CapturedCombatAbilitySource | null {
  if (!ownerCombatantId) return null
  if (!state.tactical.battle.combatants.some((unit) => unit.id === ownerCombatantId))
    throw new TypeError('captured-source-owner-unavailable')
  const stored = state.capturedAbilitySources?.find(
    (source) => source.ownerCombatantId === ownerCombatantId && source.abilityId === definition.id,
  )
  if (stored) {
    if (stored.contentVersion !== definition.contentVersion)
      throw new TypeError('captured-source-version-mismatch')
    return captureCombatAbilitySource(stored)
  }
  if (!Object.hasOwn(definition, 'ability')) return null
  const issues = validateMatureSkillDefinition(definition)
  if (issues.length > 0)
    throw new TypeError(`Invalid mature Skill definition: ${issues.join(', ')}.`)
  if (!definition.enabled) throw new RangeError('That mature Skill version is disabled.')
  return captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: JSON.stringify([
      'skill',
      ownerCombatantId,
      definition.id,
      definition.contentVersion,
    ]),
    ownerCombatantId,
    abilityId: definition.id,
    contentVersion: definition.contentVersion,
    sourceKind: definition.tags.includes('essence') ? 'essence' : 'discipline-skill',
    sourceDisciplineId: definition.sourceDisciplineId,
    tags: definition.tags,
    definition: definition.ability!,
  })
}

/** Pair ownership is encoded in the immutable source identity, never inferred as one Discipline. */
export function capturedResonanceAbilitySource(
  state: CombatEncounterState,
  ownerCombatantId: string,
  definition: AnyResonanceDefinition,
  disciplinePair: readonly [string, string],
): CapturedCombatAbilitySource | null {
  if (!state.tactical.battle.combatants.some((unit) => unit.id === ownerCombatantId))
    throw new TypeError('captured-source-owner-unavailable')
  const pair = canonicalResonancePair(disciplinePair[0], disciplinePair[1])
  const sourceInstanceId = JSON.stringify([
    'resonance',
    ownerCombatantId,
    ...pair,
    definition.id,
    definition.contentVersion,
  ])
  const stored = state.capturedAbilitySources?.find(
    (source) =>
      source.sourceKind === 'resonance' &&
      source.ownerCombatantId === ownerCombatantId &&
      source.abilityId === definition.id,
  )
  if (stored) {
    if (stored.contentVersion !== definition.contentVersion)
      throw new TypeError('captured-source-version-mismatch')
    if (stored.sourceInstanceId !== sourceInstanceId)
      throw new TypeError('captured-source-pair-mismatch')
    return captureCombatAbilitySource(stored)
  }
  if (!Object.hasOwn(definition, 'ability')) return null
  const issues = validateResonanceDefinition(definition)
  if (issues.length) throw new TypeError(`Invalid Resonance definition: ${issues.join(', ')}.`)
  if (!definition.enabled) throw new RangeError('That Resonance version is disabled.')
  if (definition.disciplinePair[0] !== pair[0] || definition.disciplinePair[1] !== pair[1])
    throw new TypeError('captured-source-pair-mismatch')
  return captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId,
    ownerCombatantId,
    abilityId: definition.id,
    contentVersion: definition.contentVersion,
    sourceKind: 'resonance',
    tags: [],
    definition: definition.ability!,
  })
}
