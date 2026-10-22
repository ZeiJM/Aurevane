'use client'

import { useState } from 'react'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  ABILITY_DEFINITION_BUDGET,
  validateAbilityDefinition,
  type AbilityBehavior,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import {
  COMBAT_TAG_REGISTRY,
  type CombatTagPayload,
} from '@aurevane/game-core/combat/combat-tag-registry'
import { AbilityNumber, AbilitySelect } from './ability-editor-fields'
import { AbilityRequirementEditor } from './ability-requirement-editor'
import { effectSubjects } from './ability-effect-editor'
import {
  AbilityEffectEditor,
  defaultAbilityPayload,
  rebindSimpleEffectRequirement,
} from './ability-effect-editor'
import { AbilityTargetingEditor } from './ability-targeting-editor'
import { AbilityGroundEditor } from './skill-ground-editor'
import styles from './combat-content-editor.module.css'
import { EffectTagLabel } from '../../character/compact-skill-effect-summary'
import { combatEffectPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
import {
  SIMPLE_AUTOMATIC_TRIGGER_OPTIONS,
  createSimpleRequirement,
  readSimpleRequirement,
  simpleRequirementSubjects,
  simpleAutomaticTargetSubjects,
} from '@aurevane/game-core/combat/combat-simple-requirements'

const limits = ['once-per-action', 'once-per-owner-turn', 'once-per-round'] as const
const limitNames = ['Once per action', 'Once per owner turn', 'Once per round']
const base = () => ({
  ...structuredClone(
    defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!,
  ),
  requirementMode: 'simple' as const,
})
function nextId(prefix: string, existing: readonly { id: string }[]) {
  for (let index = 1; index <= 1024; index++) {
    const id = `${prefix}-${index}`
    if (!existing.some((row) => row.id === id)) return id
  }
  throw new Error('Ability authoring identity budget exceeded.')
}

export function rebindSimpleRequirement(value: AbilityBehavior): AbilityBehavior {
  const selected =
    value.requirementMode === 'simple' ? readSimpleRequirement(value.requirements) : null
  const allowed = simpleRequirementSubjects(value)
  let next =
    selected && selected.tagId !== 'none' && !allowed.includes(selected.subject)
      ? {
          ...value,
          requirements: createSimpleRequirement(
            selected.tagId,
            allowed.find((subject) => subject !== 'owner') ?? 'owner',
            selected.percent ?? 50,
          ),
        }
      : value
  if (
    next.requirementMode === 'simple' &&
    next.activation === 'automatic' &&
    next.mode === 'action'
  ) {
    const shape = next.targeting?.shape.kind
    if (shape === 'circle' || shape === 'all') {
      const { automaticTarget: _binding, ...area } = next
      void _binding
      next = area
    } else {
      const subjects = simpleAutomaticTargetSubjects(next)
      if (
        subjects.length &&
        (!next.automaticTarget || !subjects.includes(next.automaticTarget.subject))
      ) {
        const preferred = SIMPLE_AUTOMATIC_TRIGGER_OPTIONS.find(
          ({ id }) => id === next.automaticTrigger,
        )?.targetSubject
        next = {
          ...next,
          automaticTarget: {
            subject: preferred && subjects.includes(preferred) ? preferred : subjects[0]!,
          },
        }
      }
    }
  }
  return {
    ...next,
    effects: next.effects.map((effect) => rebindSimpleEffectRequirement(effect, next)),
  }
}

function AbilityGroupEditor({
  value,
  onChange,
  notes,
  onNote,
  allowEffectDescriptions,
}: {
  value: AbilityBehavior
  onChange: (next: AbilityBehavior) => void
  allowEffectDescriptions: boolean
  notes: Readonly<Record<string, string | null>>
  onNote: (id: string, text: string) => void
}) {
  type PaletteTag = CombatTagPayload['type'] | 'conditional-cleanse'
  const [requestedTag, setRequestedTag] = useState<PaletteTag>('damage')
  const nativeTags = COMBAT_TAG_REGISTRY.filter((tag) =>
    tag.combinations.some(
      (combination) =>
        combination.activation === value.activation && combination.mode === value.mode,
    ),
  ).map((tag) => tag.id)
  const availableTags: PaletteTag[] = nativeTags.includes('remove-status')
    ? [...nativeTags, 'conditional-cleanse']
    : nativeTags
  const newTag = availableTags.includes(requestedTag) ? requestedTag : availableTags[0]
  const automaticSubjects =
    value.requirementMode === 'simple'
      ? simpleAutomaticTargetSubjects(value)
      : (['owner', 'triggering', 'selected', 'affected'] as const)
  const automaticArea =
    value.targeting?.shape.kind === 'circle' || value.targeting?.shape.kind === 'all'
  return (
    <div className={styles.effectList}>
      <div className={styles.typedGrid}>
        <AbilitySelect
          label="Group activation"
          value={value.activation}
          options={['manual', 'automatic', 'ongoing']}
          onChange={(activation) => {
            const next = { ...value, activation }
            if (activation === 'ongoing') {
              next.mode = 'modifier'
              next.classification = 'utility'
              delete next.attackFamily
              next.costs = []
              next.cooldown = null
              next.targeting = null
            }
            if (activation === 'automatic' && next.mode === 'action')
              next.automaticTarget ??= { subject: 'selected' }
            if (activation !== 'automatic') {
              delete next.automaticTarget
              delete next.automaticTrigger
            }
            onChange(rebindSimpleRequirement(next))
          }}
        />
        <AbilitySelect
          label="Group mode"
          value={value.mode}
          options={value.activation === 'ongoing' ? ['modifier'] : ['action', 'modifier']}
          onChange={(mode) => {
            const next = {
              ...value,
              mode,
              targeting: mode === 'modifier' ? null : (value.targeting ?? base().targeting),
            }
            if (mode === 'modifier') {
              delete next.automaticTarget
              delete next.automaticTrigger
            } else if (value.activation === 'automatic')
              next.automaticTarget = { subject: 'selected' }
            onChange(rebindSimpleRequirement(next))
          }}
        />
        <AbilitySelect
          label="Group classification"
          value={value.classification}
          options={['attack', 'recovery', 'utility']}
          onChange={(classification) => {
            const next = { ...value, classification }
            if (classification === 'attack') next.attackFamily ??= 'physical'
            else delete next.attackFamily
            onChange(next)
          }}
        />
        {value.classification === 'attack' ? (
          <AbilitySelect
            label="Attack family"
            value={value.attackFamily ?? 'physical'}
            options={['physical', 'mystic']}
            onChange={(attackFamily) => onChange({ ...value, attackFamily })}
          />
        ) : null}
        {value.activation !== 'ongoing' ? (
          <>
            {(['ap', 'mp', 'hp'] as const).map((resource) => (
              <AbilityNumber
                key={resource}
                label={`${resource.toUpperCase()} cost`}
                value={value.costs.find((cost) => cost.resource === resource)?.amount ?? 0}
                onChange={(amount) =>
                  onChange({
                    ...value,
                    costs: [
                      ...value.costs.filter((cost) => cost.resource !== resource),
                      { resource, amount },
                    ],
                  })
                }
              />
            ))}
            <AbilityNumber
              label="Cooldown (owner turns; 0 means none)"
              value={value.cooldown?.ownerTurns ?? 0}
              onChange={(ownerTurns) =>
                onChange({
                  ...value,
                  cooldown:
                    ownerTurns === 0 ? null : { key: value.cooldown?.key ?? value.id, ownerTurns },
                })
              }
            />
          </>
        ) : null}
        {value.activation === 'automatic' && value.mode === 'action' && !automaticArea ? (
          automaticSubjects.length ? (
            <AbilitySelect
              label="Automatic target subject"
              value={value.automaticTarget?.subject ?? automaticSubjects[0]!}
              options={automaticSubjects}
              optionLabels={{
                owner: 'Self',
                triggering: 'Triggering unit',
                selected: 'Action target',
                affected: 'Affected unit',
              }}
              onChange={(subject) => onChange({ ...value, automaticTarget: { subject } })}
            />
          ) : (
            <p className={styles.fieldHint}>
              Choose Self targeting or an activation with an available target.
            </p>
          )
        ) : null}
        <AbilitySelect
          label="Accuracy rule"
          value={value.accuracy?.kind ?? 'standard'}
          options={['standard', 'fixed']}
          onChange={(kind) => {
            const next = { ...value }
            if (kind === 'standard') delete next.accuracy
            else next.accuracy = { kind, chanceBasisPoints: 10000 }
            onChange(next)
          }}
        />
        {value.accuracy?.kind === 'fixed' ? (
          <AbilityNumber
            label="Fixed hit chance (%)"
            value={value.accuracy.chanceBasisPoints / 100}
            max={100}
            step={0.01}
            onChange={(percent) =>
              onChange({
                ...value,
                accuracy: { kind: 'fixed', chanceBasisPoints: Math.round(percent * 100) },
              })
            }
          />
        ) : null}
      </div>
      {value.requirementMode === 'simple' &&
      value.activation === 'automatic' &&
      value.mode === 'action' ? (
        <AbilitySelect
          label="Automatic activation"
          value={value.automaticTrigger ?? 'condition-entry'}
          options={['condition-entry', ...SIMPLE_AUTOMATIC_TRIGGER_OPTIONS.map(({ id }) => id)]}
          optionLabels={{
            'condition-entry': 'When requirement becomes true',
            ...Object.fromEntries(
              SIMPLE_AUTOMATIC_TRIGGER_OPTIONS.map(({ id, label }) => [id, label]),
            ),
          }}
          onChange={(trigger) => {
            const bindingUnavailable =
              !value.automaticTarget ||
              !simpleAutomaticTargetSubjects(value).includes(value.automaticTarget.subject)
            const next = { ...value }
            if (bindingUnavailable) delete next.automaticTarget
            if (trigger === 'condition-entry') delete next.automaticTrigger
            else next.automaticTrigger = trigger
            const selected = readSimpleRequirement(next.requirements)
            if (selected && selected.tagId !== 'none' && selected.subject !== 'owner') {
              const subject =
                simpleRequirementSubjects(next).find((subject) => subject !== 'owner') ?? 'owner'
              next.requirements = createSimpleRequirement(
                selected.tagId,
                subject,
                selected.percent ?? 50,
              )
            }
            onChange(rebindSimpleRequirement(next))
          }}
        />
      ) : null}
      <fieldset className={styles.typedGroup}>
        <legend>Usage limits</legend>
        <div className={styles.typedGrid}>
          {limits.map((limit, index) => (
            <label className={styles.checkField} key={limit}>
              <input
                type="checkbox"
                aria-label={limitNames[index]}
                checked={value.activationLimits?.includes(limit) ?? false}
                onChange={(event) =>
                  onChange({
                    ...value,
                    activationLimits: event.currentTarget.checked
                      ? [...(value.activationLimits ?? []), limit]
                      : (value.activationLimits?.filter((entry) => entry !== limit) ?? []),
                  })
                }
              />
              {limitNames[index]}
            </label>
          ))}
        </div>
      </fieldset>
      <AbilityRequirementEditor
        behavior={value}
        value={value.requirements}
        onChange={(requirements) => onChange({ ...value, requirements })}
      />
      {value.requirementMode !== 'simple' ? (
        <button
          type="button"
          onClick={() => onChange({ ...value, requirementMode: 'simple', requirements: null })}
        >
          Use tag requirements
        </button>
      ) : null}
      <fieldset className={styles.typedGroup}>
        <legend>Effect requirements</legend>
        <p className={styles.fieldHint}>
          Conditions here gate only the indicated effect, not the whole Skill. They stay
          executable modular requirements and appear in the Requirements report.
        </p>
        {value.effects.map((effect, index) => {
          const allowedSubjects = effectSubjects(effect.payload, value)
          return allowedSubjects.length ? (
            <div key={effect.id} data-effect-requirement={effect.id}>
              <AbilityRequirementEditor
                label={`Effect ${index + 1} · ${effect.payload.type} requirement`}
                value={effect.requirements ?? null}
                simple={readSimpleRequirement(effect.requirements ?? null) !== null}
                allowedSubjects={allowedSubjects}
                onChange={(requirements) =>
                  onChange({
                    ...value,
                    effects: value.effects.map((row) =>
                      row.id === effect.id ? { ...row, requirements } : row,
                    ),
                  })
                }
              />
            </div>
          ) : null
        })}
      </fieldset>
      {value.targeting ? (
        <AbilityTargetingEditor
          value={value.targeting}
          onChange={(targeting) => onChange(rebindSimpleRequirement({ ...value, targeting }))}
        />
      ) : null}
      <fieldset className={styles.typedGroup}>
        <legend>Ordered group effects</legend>
        <div className={styles.effectList}>
          {value.effects.map((effect, index) => (
            <article className={styles.effectCard} key={effect.id} data-ability-effect={effect.id}>
              <header className={styles.effectHeader}>
                <strong>
                  Effect {index + 1} ·{' '}
                  <EffectTagLabel
                    label={
                      effect.payload.type === 'remove-status'
                        ? combatEffectPresentationTags(effect.payload)[0]!
                        : effect.payload.type
                    }
                  />
                </strong>
                <div className={styles.effectActions}>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => {
                      const effects = [...value.effects]
                      ;[effects[index - 1], effects[index]] = [effects[index]!, effects[index - 1]!]
                      onChange({ ...value, effects })
                    }}
                  >
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    disabled={index === value.effects.length - 1}
                    onClick={() => {
                      const effects = [...value.effects]
                      ;[effects[index + 1], effects[index]] = [effects[index]!, effects[index + 1]!]
                      onChange({ ...value, effects })
                    }}
                  >
                    ↓ Down
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...value,
                        effects: value.effects.filter((row) => row.id !== effect.id),
                      })
                    }
                  >
                    Remove effect
                  </button>
                </div>
              </header>
              <AbilityEffectEditor
                behavior={value}
                value={effect}
                onChange={(next) =>
                  onChange({
                    ...value,
                    effects: value.effects.map((row) => (row.id === effect.id ? next : row)),
                  })
                }
              />
              {allowEffectDescriptions ? (
                <label className={styles.field}>
                  <span>Player-facing effect description</span>
                  <input
                    aria-label="Effect description"
                    maxLength={240}
                    value={notes[effect.id] ?? ''}
                    placeholder="Use the standard effect explanation"
                    onChange={(event) => onNote(effect.id, event.currentTarget.value)}
                  />
                </label>
              ) : null}
            </article>
          ))}
        </div>
        <div className={styles.effectActions}>
          {newTag ? (
            <AbilitySelect
              label="New group effect"
              value={newTag}
              options={availableTags}
              optionLabels={{
                'conditional-cleanse': 'Conditional Cleanse',
                'remove-status': 'Cleanse / Dispel',
              }}
              onChange={setRequestedTag}
            />
          ) : null}
          <button
            type="button"
            disabled={
              !newTag || value.effects.length >= ABILITY_DEFINITION_BUDGET.maximumEffectsPerBehavior
            }
            onClick={() => {
              if (newTag)
                onChange({
                  ...value,
                  effects: [
                    ...value.effects,
                    { id: nextId('effect', value.effects), payload: defaultAbilityPayload(newTag) },
                  ],
                })
            }}
          >
            Add group effect
          </button>
        </div>
      </fieldset>
      <AbilityGroundEditor value={value} onChange={onChange} />
    </div>
  )
}

/** One canonical editing surface for Skill, Essence, Resonance and Basic containers. */
export function AbilityDefinitionEditor({
  value,
  effectDescriptions,
  onChange,
  allowEffectDescriptions = true,
}: {
  value: AbilityDefinition
  allowEffectDescriptions?: boolean
  effectDescriptions?: readonly (string | null)[]
  onChange: (value: AbilityDefinition, effectDescriptions: readonly (string | null)[]) => void
}) {
  if (!value || !Array.isArray(value.behaviors))
    return (
      <p role="alert">
        This draft has an invalid Ability shape. Restore a valid definition before editing.
      </p>
    )
  const groups: readonly AbilityBehavior[] = value.behaviors
  const issues = validateAbilityDefinition(value)
  const total = groups.reduce((sum, behavior) => sum + behavior.effects.length, 0)
  const notes = Object.fromEntries(
    groups.flatMap((behavior, index) => {
      const offset = groups.slice(0, index).reduce((sum, row) => sum + row.effects.length, 0)
      return behavior.effects.map((effect, ordinal) => [
        `${behavior.id}:${effect.id}`,
        effectDescriptions && effectDescriptions.length === total
          ? (effectDescriptions[offset + ordinal] ?? null)
          : null,
      ])
    }),
  )
  const commit = (
    next: AbilityDefinition,
    override: Readonly<Record<string, string | null>> = {},
  ) =>
    onChange(
      next,
      next.behaviors.flatMap((behavior) =>
        behavior.effects.map((effect) => {
          const key = `${behavior.id}:${effect.id}`
          return Object.hasOwn(override, key) ? override[key]! : (notes[key] ?? null)
        }),
      ),
    )
  return (
    <section aria-label="Modular ability editor" className={styles.effectList}>
      <p className={styles.fieldHint}>
        Each group has its own activation, costs, Requirements and ordered effects. Changes affect
        this draft; existing battles keep their captured versions.
      </p>
      {issues.length ? (
        <div role="status">
          <strong>Resolve compatibility before publishing</strong>
          <ul>
            {issues.slice(0, 12).map((issue, index) => (
              <li key={index}>
                {issue.path}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {groups.map((behavior, index) => (
        <details
          key={behavior.id}
          open
          className={styles.typedGroup}
          data-ability-group={behavior.id}
        >
          <summary>
            Group {index + 1} · {behavior.activation} {behavior.mode}
          </summary>
          <div className={styles.effectActions}>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => {
                const behaviors = [...value.behaviors]
                ;[behaviors[index - 1], behaviors[index]] = [
                  behaviors[index]!,
                  behaviors[index - 1]!,
                ]
                commit({ ...value, behaviors })
              }}
            >
              Move group up
            </button>
            <button
              type="button"
              disabled={index === value.behaviors.length - 1}
              onClick={() => {
                const behaviors = [...value.behaviors]
                ;[behaviors[index + 1], behaviors[index]] = [
                  behaviors[index]!,
                  behaviors[index + 1]!,
                ]
                commit({ ...value, behaviors })
              }}
            >
              Move group down
            </button>
            <button
              type="button"
              disabled={value.behaviors.length <= 1}
              onClick={() =>
                commit({
                  ...value,
                  behaviors: value.behaviors.filter((row) => row.id !== behavior.id),
                })
              }
            >
              Remove group
            </button>
          </div>
          <AbilityGroupEditor
            value={behavior}
            allowEffectDescriptions={allowEffectDescriptions}
            notes={Object.fromEntries(
              behavior.effects.map((effect) => [
                effect.id,
                notes[`${behavior.id}:${effect.id}`] ?? null,
              ]),
            )}
            onChange={(next) =>
              commit({
                ...value,
                behaviors: value.behaviors.map((row) => (row.id === behavior.id ? next : row)),
              })
            }
            onNote={(id, text) =>
              commit(value, { [`${behavior.id}:${id}`]: text.trim() ? text : null })
            }
          />
        </details>
      ))}
      <button
        type="button"
        disabled={value.behaviors.length >= ABILITY_DEFINITION_BUDGET.maximumBehaviors}
        onClick={() =>
          commit({
            ...value,
            behaviors: [...value.behaviors, { ...base(), id: nextId('group', value.behaviors) }],
          })
        }
      >
        Add behavior group
      </button>
    </section>
  )
}
