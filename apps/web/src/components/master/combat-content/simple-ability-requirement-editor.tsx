'use client'

import type {
  AbilityRequirementSubject,
  RequirementNode,
} from '@aurevane/game-core/combat/combat-requirements'
import {
  SIMPLE_REQUIREMENT_TAG_OPTIONS,
  createSimpleRequirement,
  readSimpleRequirement,
} from '@aurevane/game-core/combat/combat-simple-requirements'
import { AbilityNumber, AbilitySelect } from './ability-editor-fields'
import styles from './combat-content-editor.module.css'

/** The tag is executable configuration; the target identifies whose state is checked. */
export function SimpleAbilityRequirementEditor({
  value,
  onChange,
  label = 'Requirements',
  targetUnavailableReason,
  allowedSubjects = ['owner', 'selected'],
}: {
  value: RequirementNode | null
  onChange: (value: RequirementNode | null) => void
  label?: string
  targetUnavailableReason?: string
  allowedSubjects?: readonly AbilityRequirementSubject[]
}) {
  const selected = readSimpleRequirement(value)
  const subject = selected?.subject ?? allowedSubjects[0] ?? 'owner'
  return (
    <fieldset className={styles.typedGroup} data-simple-requirements="true">
      <legend>{label}</legend>
      <div className={styles.typedGrid}>
        <AbilitySelect
          label="Requirement tag"
          value={selected?.tagId ?? 'unsupported'}
          options={SIMPLE_REQUIREMENT_TAG_OPTIONS.map(({ id }) => id)}
          optionLabels={Object.fromEntries(
            SIMPLE_REQUIREMENT_TAG_OPTIONS.map(({ id, label }) => [id, label]),
          )}
          onChange={(tagId) =>
            onChange(
              createSimpleRequirement(
                tagId,
                allowedSubjects.includes(subject) ? subject : (allowedSubjects[0] ?? 'owner'),
                selected?.percent ?? 50,
              ),
            )
          }
        />
        {selected && selected.tagId !== 'none' ? (
          <>
            <AbilitySelect
              label="Requirement target"
              value={subject}
              options={
                targetUnavailableReason && !allowedSubjects.includes('selected')
                  ? [...allowedSubjects, 'selected']
                  : allowedSubjects
              }
              disabledOptions={targetUnavailableReason ? ['selected'] : []}
              optionLabels={{
                owner: 'Self',
                selected: targetUnavailableReason ? 'Target (requires a selected unit)' : 'Target',
                affected: 'Target',
                triggering: 'Target',
              }}
              onChange={(next) => {
                if (allowedSubjects.includes(next))
                  onChange(createSimpleRequirement(selected.tagId, next, selected.percent ?? 50))
              }}
            />
            {selected.percent !== undefined ? (
              <AbilityNumber
                label="Requirement value (%)"
                value={selected.percent}
                min={0}
                max={100}
                step={0.01}
                onChange={(percent) => {
                  if (
                    !Number.isFinite(percent) ||
                    percent < 0 ||
                    percent > 100 ||
                    Math.round(percent * 100) / 100 !== percent
                  )
                    return
                  onChange(createSimpleRequirement(selected.tagId, subject, percent))
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>
      {targetUnavailableReason ? (
        <p className={styles.fieldHint}>{targetUnavailableReason}</p>
      ) : null}
      {!selected ? (
        <p role="alert">Choose a requirement tag to replace this unsupported rule.</p>
      ) : null}
    </fieldset>
  )
}
