'use client'

import type { AbilityBehavior, RequirementNode } from '@aurevane/game-core/combat/combat-definition'
import { ABILITY_REQUIREMENT_BUDGET } from '@aurevane/game-core/combat/combat-requirements'
import {
  COMBAT_REQUIREMENT_STATUS_OPTIONS,
  COMBAT_REQUIREMENT_DISCIPLINE_OPTIONS,
  COMBAT_REQUIREMENT_ACTION_TAG_OPTIONS,
  COMBAT_REQUIREMENT_EVENT_OPTIONS,
} from '@aurevane/game-core/combat/combat-requirement-modules'
import { AbilityNumber, AbilitySelect } from './ability-editor-fields'
import { AbilityRequirementModulesEditor } from './ability-requirement-modules-editor'
import { SimpleAbilityRequirementEditor } from './simple-ability-requirement-editor'
import {
  readSimpleRequirement,
  simpleRequirementSubjects,
} from '@aurevane/game-core/combat/combat-simple-requirements'
import styles from './combat-content-editor.module.css'

const kinds = [
  'none',
  'all',
  'any',
  'status-set',
  'resource-state',
  'resource-change',
  'resource-threshold-crossing',
  'subject-relation',
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
    case 'status-set':
      return {
        kind: 'any',
        children: [{ kind: 'status-presence', subject: 'owner', statusId: 'burn', present: true }],
      }
    case 'resource-change':
      return { kind, subject: 'affected', resource: 'mp', direction: 'gained', minimumAmount: 1 }
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
    case 'subject-relation':
      return { kind, subject: 'triggering', otherSubject: 'owner', relation: 'same-unit' }
    case 'prime-presence':
      return { kind, subject: 'owner', present: true }
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
  behavior,
  primitiveOnly = false,
  simple = false,
  conditionOnly = false,
  lockedKind = false,
  lockedActionClassification = false,
  lockedActionTags = [],
  allowedSubjects = subjects,
}: {
  value: RequirementNode | null
  onChange: (value: RequirementNode | null) => void
  label?: string
  depth?: number
  behavior?: AbilityBehavior
  primitiveOnly?: boolean
  simple?: boolean
  conditionOnly?: boolean
  lockedKind?: boolean
  lockedActionClassification?: boolean
  lockedActionTags?: readonly string[]
  allowedSubjects?: readonly (typeof subjects)[number][]
}) {
  const node = value
  if (
    !primitiveOnly &&
    depth === 0 &&
    (behavior?.requirementMode === 'simple' ||
      simple ||
      (behavior?.activation === 'manual' && readSimpleRequirement(value) !== null))
  )
    return (
      <SimpleAbilityRequirementEditor
        value={value}
        onChange={onChange}
        label={label}
        targetUnavailableReason={
          behavior &&
          behavior.activation === 'manual' &&
          !simpleRequirementSubjects(behavior).includes('selected')
            ? 'A whole-ability Requirement can check Self here because this action selects an area or tile, not a unit. Use Target Requirement aim below to explicitly choose a Single unit, when supported. Tile-only effects keep their required targeting.'
            : undefined
        }
        allowedSubjects={behavior ? simpleRequirementSubjects(behavior) : allowedSubjects}
      />
    )
  const statusSet =
    node?.kind === 'any' &&
    node.children.length > 0 &&
    node.children.every(
      (child) =>
        child.kind === 'status-presence' &&
        child.present &&
        child.subject ===
          (node.children[0] as Extract<RequirementNode, { kind: 'status-presence' }>).subject,
    )
      ? (node.children as readonly Extract<RequirementNode, { kind: 'status-presence' }>[])
      : null
  if (behavior && !primitiveOnly && depth === 0)
    return (
      <AbilityRequirementModulesEditor
        value={value}
        behavior={behavior}
        onChange={onChange}
        label={label}
      />
    )
  return (
    <fieldset className={styles.typedGroup}>
      <legend>{label}</legend>
      <AbilitySelect
        label="Requirement kind"
        value={statusSet ? 'status-set' : (node?.kind ?? 'none')}
        options={
          lockedKind && node
            ? [node.kind]
            : conditionOnly
              ? [
                  'none',
                  'all',
                  'any',
                  'status-set',
                  'resource-state',
                  'status-presence',
                  'prime-presence',
                ]
              : kinds
        }
        optionLabels={{
          none: 'None',
          all: 'All conditions',
          any: 'Any condition',
          'status-set': 'Any status tag',
          'resource-state': 'Resource threshold',
          'resource-change': 'Resource change',
          'resource-threshold-crossing': 'Resource crossing',
          'status-presence': 'Status tag',
          'prime-presence': 'Primed',
          'subject-relation': 'Unit relation',
          event: 'Event',
          action: 'Action tags',
        }}
        onChange={(kind) => onChange(initial(kind))}
      />
      {node && 'subject' in node ? (
        <AbilitySelect
          label="Requirement subject"
          value={node.subject}
          options={allowedSubjects}
          optionLabels={{
            owner: 'Self',
            selected: 'Target',
            affected: 'Affected unit',
            triggering: 'Triggering unit',
          }}
          onChange={(subject) => onChange({ ...node, subject })}
        />
      ) : null}
      {node && !statusSet && (node.kind === 'all' || node.kind === 'any') ? (
        <div className={styles.effectList}>
          {depth < ABILITY_REQUIREMENT_BUDGET.maximumDepth ? (
            node.children.map((child, index) => (
              <AbilityRequirementEditor
                key={index}
                label={`Condition ${index + 1}`}
                value={child}
                depth={depth + 1}
                conditionOnly={conditionOnly}
                allowedSubjects={allowedSubjects}
                primitiveOnly
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
      {statusSet ? (
        <div className={styles.typedGrid}>
          <AbilitySelect
            label="Status set subject"
            value={statusSet[0]!.subject}
            options={allowedSubjects}
            onChange={(subject) =>
              onChange({ kind: 'any', children: statusSet.map((child) => ({ ...child, subject })) })
            }
          />
          <fieldset className={styles.typedGroup}>
            <legend>Any selected status tag</legend>
            {[
              ...COMBAT_REQUIREMENT_STATUS_OPTIONS,
              ...statusSet
                .filter(
                  (child) =>
                    !COMBAT_REQUIREMENT_STATUS_OPTIONS.some(
                      (option) => option.id === child.statusId,
                    ),
                )
                .map((child) => ({
                  id: child.statusId,
                  label: `${child.statusId} (captured unsupported tag)`,
                })),
            ].map((option) => (
              <label key={option.id}>
                <input
                  type="checkbox"
                  aria-label={`Any status tag ${option.label}`}
                  checked={statusSet.some((child) => child.statusId === option.id)}
                  disabled={statusSet.length === 1 && statusSet[0]!.statusId === option.id}
                  onChange={(event) =>
                    onChange({
                      kind: 'any',
                      children: event.currentTarget.checked
                        ? [
                            ...statusSet,
                            {
                              kind: 'status-presence',
                              subject: statusSet[0]!.subject,
                              statusId: option.id,
                              present: true,
                            },
                          ]
                        : statusSet.filter((child) => child.statusId !== option.id),
                    })
                  }
                />
                {option.label}
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}
      {node?.kind === 'subject-relation' ? (
        <div className={styles.typedGrid}>
          <AbilitySelect
            label="Other requirement subject"
            value={node.otherSubject}
            options={allowedSubjects}
            onChange={(otherSubject) => onChange({ ...node, otherSubject })}
          />
          <AbilitySelect
            label="Subject relation"
            value={node.relation}
            options={['same-unit', 'ally', 'enemy']}
            onChange={(relation) => onChange({ ...node, relation })}
          />
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
            onChange={(amount) => {
              if (
                amount < 0 ||
                (node.basisPoints === undefined ? !Number.isSafeInteger(amount) : amount > 100)
              )
                return
              onChange(
                node.basisPoints === undefined
                  ? { ...node, amount }
                  : { ...node, basisPoints: Math.round(amount * 100) },
              )
            }}
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
            <AbilitySelect
              label="Required status tag"
              value={node.statusId}
              options={COMBAT_REQUIREMENT_STATUS_OPTIONS.map((option) => option.id)}
              optionLabels={Object.fromEntries(
                COMBAT_REQUIREMENT_STATUS_OPTIONS.map((option) => [option.id, option.label]),
              )}
              onChange={(statusId) => onChange({ ...node, statusId })}
            />
          ) : (
            <AbilitySelect
              label="Primed scope"
              value={node.abilityId ?? 'any'}
              options={node.abilityId ? ['any', node.abilityId] : ['any']}
              optionLabels={{
                any: 'Any Controlled skill',
                ...(node.abilityId
                  ? { [node.abilityId]: `${node.abilityId} (captured specific skill)` }
                  : {}),
              }}
              onChange={(scope) => {
                const next = { ...node }
                if (scope === 'any') delete next.abilityId
                else next.abilityId = scope
                onChange(next)
              }}
            />
          )}
        </div>
      ) : null}
      {node?.kind === 'event' ? (
        <AbilitySelect
          label="Trigger event"
          value={`${node.eventType}:${node.phase}`}
          options={COMBAT_REQUIREMENT_EVENT_OPTIONS.map((option) => option.id)}
          optionLabels={Object.fromEntries(
            COMBAT_REQUIREMENT_EVENT_OPTIONS.map((option) => [option.id, option.label]),
          )}
          onChange={(id) => {
            const option = COMBAT_REQUIREMENT_EVENT_OPTIONS.find((option) => option.id === id)!
            onChange({ kind: 'event', eventType: option.eventType, phase: option.phase })
          }}
        />
      ) : null}
      {node?.kind === 'resource-change' ? (
        <div className={styles.typedGrid}>
          <AbilitySelect
            label="Changed resource"
            value={node.resource}
            options={resources}
            onChange={(resource) => onChange({ ...node, resource })}
          />
          <AbilitySelect
            label="Resource change direction"
            value={node.direction}
            options={['gained', 'lost']}
            onChange={(direction) => onChange({ ...node, direction })}
          />
          <AbilityNumber
            label="Minimum resource change"
            value={node.minimumAmount}
            min={1}
            onChange={(minimumAmount) => onChange({ ...node, minimumAmount })}
          />
        </div>
      ) : null}
      {node?.kind === 'action' ? (
        <div className={styles.typedGrid}>
          <AbilitySelect
            label="Required action classification"
            value={node.classification ?? ''}
            options={
              lockedActionClassification
                ? [node.classification ?? '']
                : [
                    ...(node.attackFamily || node.sourceDisciplineId || node.requiredTags?.length
                      ? ['' as const]
                      : []),
                    'attack',
                    'recovery',
                    'utility',
                  ]
            }
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
            options={[
              ...(node.classification || node.sourceDisciplineId || node.requiredTags?.length
                ? ['' as const]
                : []),
              'physical',
              'mystic',
            ]}
            onChange={(attackFamily) => {
              const next = { ...node }
              if (attackFamily) next.attackFamily = attackFamily
              else delete next.attackFamily
              onChange(next)
            }}
          />
          <AbilitySelect
            label="Required source Discipline"
            value={node.sourceDisciplineId ?? ''}
            options={[
              ...(node.classification || node.attackFamily || node.requiredTags?.length
                ? ['']
                : []),
              ...COMBAT_REQUIREMENT_DISCIPLINE_OPTIONS.map((option) => option.id),
            ]}
            optionLabels={Object.fromEntries(
              COMBAT_REQUIREMENT_DISCIPLINE_OPTIONS.map((option) => [option.id, option.label]),
            )}
            onChange={(sourceDisciplineId) => {
              const next = { ...node }
              if (sourceDisciplineId) next.sourceDisciplineId = sourceDisciplineId
              else delete next.sourceDisciplineId
              onChange(next)
            }}
          />
          <fieldset className={styles.typedGroup}>
            <legend>Required action tags</legend>
            {[
              ...COMBAT_REQUIREMENT_ACTION_TAG_OPTIONS,
              ...(node.requiredTags ?? [])
                .filter(
                  (id) => !COMBAT_REQUIREMENT_ACTION_TAG_OPTIONS.some((option) => option.id === id),
                )
                .map((id) => ({ id, label: `${id} (captured unsupported tag)` })),
            ].map((option) => (
              <label key={option.id}>
                <input
                  type="checkbox"
                  aria-label={`Require action tag ${option.label}`}
                  checked={node.requiredTags?.includes(option.id) ?? false}
                  disabled={
                    lockedActionTags.includes(option.id) ||
                    (node.requiredTags?.length === 1 &&
                      node.requiredTags[0] === option.id &&
                      !node.classification &&
                      !node.attackFamily &&
                      !node.sourceDisciplineId)
                  }
                  onChange={(event) => {
                    const tags = (node.requiredTags ?? []).filter((tag) => tag !== option.id)
                    const next = { ...node }
                    const selected = event.currentTarget.checked ? [...tags, option.id] : tags
                    if (selected.length) next.requiredTags = selected
                    else delete next.requiredTags
                    onChange(next)
                  }}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}
    </fieldset>
  )
}
