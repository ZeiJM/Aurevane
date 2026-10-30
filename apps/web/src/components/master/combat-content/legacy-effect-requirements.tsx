'use client'

import {
  validateAbilityDefinition,
  type AbilityBehavior,
  type RequirementNode,
} from '@aurevane/game-core/combat/combat-definition'
import { simpleRequirementSubjects } from '@aurevane/game-core/combat/combat-simple-requirements'
import { abilityRequirementDescription } from '../../character/ability-detail-presentation'
import styles from './combat-content-editor.module.css'

function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${fingerprint(entry)}`)
      .join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}

function withoutEffectConditions(value: AbilityBehavior): AbilityBehavior {
  return {
    ...value,
    effects: value.effects.map((effect) => {
      if (!effect.requirements) return effect
      const { requirements: _legacy, ...retained } = effect
      void _legacy
      return retained
    }),
  }
}

/** Legacy predicates remain executable until the author explicitly promotes or removes them. */
export function LegacyEffectRequirements({
  value,
  onChange,
}: {
  value: AbilityBehavior
  onChange: (next: AbilityBehavior) => void
}) {
  const retained = value.effects.filter((effect) => effect.requirements)
  if (!retained.length) return null
  const requirement = retained[0]!.requirements!
  const promoted = { ...withoutEffectConditions(value), requirements: requirement }
  const availableSubjects = simpleRequirementSubjects(value)
  function hasUnavailableSubject(node: RequirementNode): boolean {
    if (node.kind === 'all' || node.kind === 'any') return node.children.some(hasUnavailableSubject)
    return (
      ('subject' in node && !availableSubjects.includes(node.subject)) ||
      (node.kind === 'subject-relation' && !availableSubjects.includes(node.otherSubject))
    )
  }
  const conflict = retained.some(
    (effect) => fingerprint(effect.requirements) !== fingerprint(requirement),
  )
    ? 'These effects have different conditions. Choose the whole-ability Requirement above, then explicitly remove the retained conditions when ready.'
    : value.requirements && fingerprint(value.requirements) !== fingerprint(requirement)
      ? 'The current whole-ability Requirement differs from these conditions. Keep or change it above, then explicitly remove the retained conditions when ready.'
      : hasUnavailableSubject(requirement) ||
          validateAbilityDefinition({ schemaVersion: 1, behaviors: [promoted] }).length
        ? 'These conditions are incompatible with whole-ability activation or the current configuration. An affected-unit condition cannot become an area-wide Requirement. Choose a compatible Requirement above, then explicitly remove the retained conditions when ready.'
        : null
  const unconditionalCount = value.effects.length - retained.length
  return (
    <fieldset className={styles.typedGroup} data-legacy-effect-requirements="true">
      <legend>Retained effect conditions</legend>
      <p className={styles.fieldHint}>
        Saved conditions still apply only to their original effects. Opening this editor or editing
        parameters keeps them unchanged. Manage Requirements for the complete activation above.
      </p>
      <ul>
        {retained.map((effect) => (
          <li key={effect.id}>
            Effect {value.effects.indexOf(effect) + 1}:{' '}
            {abilityRequirementDescription(effect.requirements!, value)}
          </li>
        ))}
      </ul>
      {conflict ? (
        <p role="status">{conflict}</p>
      ) : (
        <p className={styles.fieldHint}>
          Applying the matching condition makes it a prerequisite for every effect in this behavior
          group and removes the old effect conditions.
          {unconditionalCount
            ? ` This also gates ${unconditionalCount} currently unconditional effect(s).`
            : ''}
        </p>
      )}
      <button
        type="button"
        disabled={!!conflict}
        onClick={() => {
          if (!conflict) onChange(promoted)
        }}
      >
        Apply matching conditions to whole ability
      </button>
      <p className={styles.fieldHint}>
        Removing retained conditions makes those effects depend only on the whole-ability
        Requirement above. This changes this draft; captured versions keep their original rules.
      </p>
      <button type="button" onClick={() => onChange(withoutEffectConditions(value))}>
        Remove all retained effect conditions
      </button>
    </fieldset>
  )
}
