import type { ResonanceDefinitionV2 } from './resonance-v2'
import { resonanceSkillMatcherDescription } from './resonance-skill-matcher'

/** Append current wording and eligibility; saved versions retain their original matchers. */
export function createClarifiedResonanceVersion(
  definition: ResonanceDefinitionV2,
): ResonanceDefinitionV2 {
  const previousSetup = definition.trigger.setup
  const setup =
    previousSetup?.sourceDisciplineId === 'chronist'
      ? { sourceDisciplineId: 'chronist', matchMode: 'any-skill' as const, requiredTags: [] }
      : previousSetup
  const trigger = resonanceSkillMatcherDescription(definition.trigger.trigger)
  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    description: setup
      ? `Setup: ${resonanceSkillMatcherDescription(setup)}. Trigger: ${trigger}. The next Discipline Skill must match the Trigger to consume the setup and gain the Result.`
      : `Trigger: ${trigger}. No setup is required. The matching Skill gains the Result.`,
    trigger: { ...definition.trigger, setup },
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...definition.authoring.validationTags,
        'owner-clarified-resonance-matchers',
      ],
    },
  }
}
