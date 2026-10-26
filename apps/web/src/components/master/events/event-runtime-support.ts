import type { PersistentEventDefinition } from '@aurevane/game-core/events/persistent-event'

/** Presentation of the actual SQL capability guard; drafts remain editable. */
export function eventRuntimeBlockers(definition: PersistentEventDefinition): string[] {
  const blockers: string[] = []
  for (const phase of definition.phases) {
    for (const effect of [...phase.effects, ...phase.cleanupEffects]) {
      blockers.push(
        `${phase.name}: ${effect.type} (${effect.referenceKey}) has no production executor.`,
      )
    }
    for (const objective of phase.objectives) {
      if (!objective.worldNavigation) {
        blockers.push(
          `${phase.name}: ${objective.type} has no contribution producer. Add World guidance for navigation only, or retain it as a draft.`,
        )
      }
      if (
        phase.transition.type === 'objective-threshold' &&
        phase.transition.objectiveId === objective.id
      ) {
        blockers.push(
          `${phase.name}: World navigation does not complete objectives. Choose a manual or clock transition.`,
        )
      }
    }
  }
  if (definition.aftermathRefs.length)
    blockers.push('Aftermath references have no production executor.')
  if (definition.rewardPackageRefs.length)
    blockers.push(
      'Reward recipes have no live contribution-to-claim producer. Existing historical claims retain their XP settlement authority.',
    )
  return blockers
}
