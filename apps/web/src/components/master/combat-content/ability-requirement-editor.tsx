'use client'

import type { RequirementNode } from '@aurevane/game-core/combat/combat-definition'
import { ABILITY_REQUIREMENT_BUDGET } from '@aurevane/game-core/combat/combat-requirements'
import { AbilityNumber, AbilitySelect, AbilityText } from './ability-editor-fields'
import styles from './combat-content-editor.module.css'

const kinds = [
  'none',
  'all',
  'any',
  'resource-state',
  'resource-threshold-crossing',
  'status-presence',
  'prime-presence',
  'event',
  'action',
] as const
const subjects = ['owner', 'selected', 'affected', 'triggering'] as const
const resources = ['ap', 'mp', 'hp'] as const
function initial(kind: (typeof kinds)[number]): RequirementNode | null {
  switch (kind) {
    case 'none':
      return null
    case 'all':
    case 'any':
      return {
        kind,
        children: [
          {
            kind: 'resource-state',
            subject: 'owner',
            resource: 'mp',
            comparison: 'at-least',
            amount: 1,
          },
        ],
      }
    case 'resource-state':
      return { kind, subject: 'owner', resource: 'mp', comparison: 'at-least', amount: 1 }
    case 'resource-threshold-crossing':
      return {
        kind,
        subject: 'owner',
        resource: 'hp',
        direction: 'below',
        thresholdBasisPoints: 5000,
      }
    case 'status-presence':
      return { kind, subject: 'owner', statusId: 'guarded', present: true }
    case 'prime-presence':
      return { kind, subject: 'owner', abilityId: '', present: true }
    case 'event':
      return { kind, eventType: 'combat_action_used', phase: 'after' }
    case 'action':
      return { kind, classification: 'attack' }
  }
}

/** Edits the engine's tree directly. Predicates and conditional effect recipients stay separate. */
export function AbilityRequirementEditor({
  value,
  onChange,
  label = 'Requirements',
  depth = 0,
}: {
  value: RequirementNode | null
  onChange: (value: RequirementNode | null) => void
  label?: string
  depth?: number
}) {
  const node = value
  return (
    <fieldset className={styles.typedGroup}>
      <legend>{label}</legend>
      <AbilitySelect
        label="Requirement kind"
        value={node?.kind ?? 'none'}
        options={kinds}
        onChange={(kind) => onChange(initial(kind))}
      />
      {node && 'subject' in node ? (
        <AbilitySelect
          label="Requirement subject"
          value={node.subject}
          options={subjects}
          onChange={(subject) => onChange({ ...node, subject })}
        />
      ) : null}
      {node && (node.kind === 'all' || node.kind === 'any') ? (
        <div className={styles.effectList}>
          {depth < ABILITY_REQUIREMENT_BUDGET.maximumDepth ? (
            node.children.map((child, index) => (
              <AbilityRequirementEditor
                key={index}
                label={`Condition ${index + 1}`}
                value={child}
                depth={depth + 1}
                onChange={(next) =>
                  onChange({
                    ...node,
                    children: next
                      ? node.children.map((row, ordinal) => (ordinal === index ? next : row))
                      : node.children.filter((_, ordinal) => ordinal !== index),
                  })
                }
              />
            ))
          ) : (
            <p role="alert">
              Requirement nesting limit reached. Remove this branch to simplify it.
            </p>
          )}
          <button
            type="button"
            disabled={
              depth >= ABILITY_REQUIREMENT_BUDGET.maximumDepth || node.children.length >= 127
            }
            onClick={() =>
              onChange({ ...node, children: [...node.children, initial('resource-state')!] })
            }
          >
            Add condition
          </button>
        </div>
      ) : null}
      {node?.kind === 'resource-state' ? (
        <div className={styles.typedGrid}>
          <AbilitySelect
            label="Requirement resource"
            value={node.resource}
            options={resources}
            onChange={(resource) => onChange({ ...node, resource })}
          />
          <AbilitySelect
            label="Resource comparison"
            value={node.comparison}
            options={['at-least', 'at-most']}
            onChange={(comparison) => onChange({ ...node, comparison })}
          />
          <AbilitySelect
            label="Resource units"
            value={node.basisPoints === undefined ? 'amount' : 'percentage'}
            options={['amount', 'percentage']}
            onChange={(unit) =>
              onChange({
                kind: node.kind,
                subject: node.subject,
                resource: node.resource,
                comparison: node.comparison,
                ...(unit === 'amount' ? { amount: 0 } : { basisPoints: 0 }),
              })
            }
          />
          <AbilityNumber
            label="Resource threshold"
            value={node.basisPoints === undefined ? node.amount : node.basisPoints / 100}
            step={node.basisPoints === undefined ? 1 : 0.01}
            max={node.basisPoints === undefined ? undefined : 100}
            onChange={(amount) =>
              onChange(
                node.basisPoints === undefined
                  ? { ...node, amount }
                  : { ...node, basisPoints: Math.round(amount * 100) },
              )
            }
          />
        </div>
      ) : null}
      {node?.kind === 'resource-threshold-crossing' ? (
        <div className={styles.typedGrid}>
          <AbilitySelect
            label="Crossing resource"
            value={node.resource}
            options={resources}
            onChange={(resource) => onChange({ ...node, resource })}
          />
          <AbilitySelect
            label="Crossing direction"
            value={node.direction}
            options={['below', 'above']}
            onChange={(direction) => onChange({ ...node, direction })}
          />
          <AbilityNumber
            label="Crossing threshold (%)"
            value={node.thresholdBasisPoints / 100}
            max={100}
            step={0.01}
            onChange={(percent) =>
              onChange({ ...node, thresholdBasisPoints: Math.round(percent * 100) })
            }
          />
        </div>
      ) : null}
      {node?.kind === 'status-presence' || node?.kind === 'prime-presence' ? (
        <div className={styles.typedGrid}>
          <AbilitySelect
            label="Required presence"
            value={node.present ? 'present' : 'absent'}
            options={['present', 'absent']}
            onChange={(presence) => onChange({ ...node, present: presence === 'present' })}
          />
          {node.kind === 'status-presence' ? (
            <AbilityText
              label="Required status identity"
              value={node.statusId}
              onChange={(statusId) => onChange({ ...node, statusId })}
            />
          ) : (
            <AbilityText
              label="Primed ability identity"
              value={node.abilityId}
              onChange={(abilityId) => onChange({ ...node, abilityId })}
            />
          )}
        </div>
      ) : null}
      {node?.kind === 'event' ? (
        <div className={styles.typedGrid}>
          <AbilityText
            label="Trigger event"
            value={node.eventType}
            onChange={(eventType) => onChange({ ...node, eventType })}
          />
          <AbilitySelect
            label="Event phase"
            value={node.phase}
            options={['before', 'after']}
            onChange={(phase) => onChange({ ...node, phase })}
          />
        </div>
      ) : null}
      {node?.kind === 'action' ? (
        <div className={styles.typedGrid}>
          <AbilitySelect
            label="Required action classification"
            value={node.classification ?? ''}
            options={['', 'attack', 'recovery', 'utility']}
            onChange={(classification) => {
              const next = { ...node }
              if (classification) next.classification = classification
              else delete next.classification
              onChange(next)
            }}
          />
          <AbilitySelect
            label="Required attack family"
            value={node.attackFamily ?? ''}
            options={['', 'physical', 'mystic']}
            onChange={(attackFamily) => {
              const next = { ...node }
              if (attackFamily) next.attackFamily = attackFamily
              else delete next.attackFamily
              onChange(next)
            }}
          />
          <AbilityText
            label="Required source Discipline"
            value={node.sourceDisciplineId ?? ''}
            onChange={(sourceDisciplineId) => {
              const next = { ...node }
              if (sourceDisciplineId) next.sourceDisciplineId = sourceDisciplineId
              else delete next.sourceDisciplineId
              onChange(next)
            }}
          />
          <AbilityText
            label="Required action tags (comma separated)"
            value={node.requiredTags?.join(', ') ?? ''}
            onChange={(tags) =>
              onChange({
                ...node,
                requiredTags: tags
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      ) : null}
    </fieldset>
  )
}
