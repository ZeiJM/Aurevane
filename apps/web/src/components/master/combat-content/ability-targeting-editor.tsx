'use client'

import type { AbilityTargeting, AbilityEffect } from '@aurevane/game-core/combat/combat-definition'
import { SkillTargetingEditor } from './skill-targeting-editor'

/** Native and modular abilities share one geometry editor without dropping captured categories. */
export function AbilityTargetingEditor({
  value,
  effects,
  onChange,
}: {
  value: AbilityTargeting
  effects?: readonly AbilityEffect[]
  onChange(value: AbilityTargeting): void
}) {
  return (
    <SkillTargetingEditor
      value={value}
      effects={effects?.map((effect) => effect.payload)}
      onChange={(next) =>
        onChange({
          ...value,
          ...next,
          maximumSelections: next.maximumSelections ?? value.maximumSelections,
        })
      }
    />
  )
}
