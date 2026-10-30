import type { CombatContentKind } from '@aurevane/db/combat-content'
import {
  automaticDamageDefinitionIssues,
  combatDamageForAuthoring,
} from '@/lib/combat-damage-authoring'
import {
  validateSkillDefinition as validateHistoricalSkill,
  validateEssenceAuthoringDefinition as validateHistoricalEssence,
  validateResonanceAuthoringDefinition as validateHistoricalResonance,
} from './combat-content-authoring-validation'
import type { CombatContentValidationResult } from './combat-content-authoring-service'

/** Current editable requests add authoring rules; immutable cohort/capture validators stay exact. */
function current(
  kind: CombatContentKind,
  definition: unknown,
  validate: (value: unknown) => CombatContentValidationResult,
): CombatContentValidationResult {
  const projected = combatDamageForAuthoring(kind, definition)
  const result = validate(projected)
  const issues = [...result.issues, ...automaticDamageDefinitionIssues(kind, projected)]
  return { ...result, valid: result.valid && !issues.length, issues }
}
export const validateSkillDefinition = (definition: unknown) =>
  current('skill', definition, validateHistoricalSkill)
export const validateEssenceAuthoringDefinition = (definition: unknown) =>
  current('essence', definition, validateHistoricalEssence)
export const validateResonanceAuthoringDefinition = (definition: unknown) =>
  current('resonance', definition, validateHistoricalResonance)
