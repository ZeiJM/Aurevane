'use client'

import {
  activeAbilityForAuthoring,
  moveWithoutSeparateAim,
  moveUsesLocalOrGlobalEffects,
  authoringAccuracyApplicable,
  authoringAddedEffectIssue,
  authoringReorderIssue,
  reorderedAuthoringEffects,
  insertAuthoringEffect,
} from '@/lib/combat-ability-authoring-compatibility'

import { newResonanceAbility } from './new-resonance-ability'
import { MasterHelp } from '../master-help'
import {
  isAuthoredElementalCompanion,
  withAuthoredElementalCompanions,
} from './elemental-companion-authoring'
import { AreaRecipientRepair } from './area-recipient-repair'
import { AbilityCostEditor } from './ability-cost-editor'
import type { AbilityEditorSection } from './ability-editor-tabs'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  ABILITY_DEFINITION_BUDGET,
  validateAbilityDefinition,
  type AbilityBehavior,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import { AbilityNumber, AbilitySelect } from './ability-editor-fields'
import { AbilityRequirementEditor } from './ability-requirement-editor'
import { AbilityEffectEditor } from './ability-effect-editor'
import { LegacyEffectRequirements } from './legacy-effect-requirements'
import {
  deriveSharedEffectAim,
  withAuthoredAreaRecipients,
  hasSelectedAimRequirement,
  withAuthoredEffectTarget,
} from '@aurevane/game-core/combat/combat-effect-target-authoring'
import { inheritedEffectTargetLabel } from './effect-target-editor'
import { AbilityTargetingEditor } from './ability-targeting-editor'
import { AbilityGroundEditor } from './skill-ground-editor'
import styles from './combat-content-editor.module.css'
import { EffectTagLabel } from '../../character/compact-skill-effect-summary'
import { EffectTagPicker } from './effect-tag-picker'
import { effectAuthoringTag } from '@aurevane/game-core/combat/combat-effect-authoring'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import {
  SIMPLE_AUTOMATIC_TRIGGER_OPTIONS,
  createSimpleRequirement,
  readSimpleRequirement,
  simpleRequirementSubjects,
  simpleAutomaticTargetSubjects,
} from '@aurevane/game-core/combat/combat-simple-requirements'

const limits = ['once-per-action', 'once-per-round'] as const
const limitNames = ['Once per action', 'Once per round']
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
  return next
}

export function withSharedEffectAim(next: AbilityBehavior): AbilityBehavior {
  if (moveWithoutSeparateAim(next)) return next
  const requiresSelectedUnit = hasSelectedAimRequirement([
    next.requirements,
    ...next.effects.map((effect) => effect.requirements),
  ])
  if (next.targeting?.shape.kind !== 'single' && requiresSelectedUnit) return next
  // A selected-unit prerequisite owns its canonical aim independently of effect recipients.
  if (next.targeting?.kind === 'unit' && requiresSelectedUnit) return rebindSimpleRequirement(next)
  return rebindSimpleRequirement({
    ...next,
    targeting: next.targeting
      ? deriveSharedEffectAim(
          next.targeting,
          next.effects
            .filter((effect) => !isAuthoredElementalCompanion(effect))
            .map((effect) => effect.payload),
          {
            requiresSelectedUnit,
          },
        )
      : null,
  })
}

function AbilityGroupEditor({
  value,
  onChange: update,
  section,
  category,
}: {
  category?: 'manual' | 'passive'
  section?: AbilityEditorSection
  value: AbilityBehavior
  onChange: (next: AbilityBehavior) => void
}) {
  const requiresSelectedUnit = hasSelectedAimRequirement([
    value.requirements,
    ...value.effects.map((effect) => effect.requirements),
  ])
  const onChange = (next: AbilityBehavior) => {
    if (next.targeting && next.targeting !== value.targeting) {
      const payloads = withAuthoredAreaRecipients(
        next.targeting,
        next.effects.map((effect) => effect.payload),
        { requiresSelectedUnit },
      )
      next = {
        ...next,
        effects: next.effects.map((effect, index) =>
          payloads[index] === effect.payload ? effect : { ...effect, payload: payloads[index]! },
        ),
      }
    }
    next = withAuthoredElementalCompanions(value, next)
    update(
      (next.targeting?.maximumSelections ?? 1) > 1 ||
        (next.targeting === value.targeting && next.effects === value.effects)
        ? next
        : withSharedEffectAim(next),
    )
  }
  const elementRepair = withAuthoredElementalCompanions(value, value)
  const show = (key: AbilityEditorSection) => !section || section === key
  const automaticSubjects =
    value.requirementMode === 'simple'
      ? simpleAutomaticTargetSubjects(value)
      : (['owner', 'triggering', 'selected', 'affected'] as const)
  const automaticArea =
    value.targeting?.shape.kind === 'circle' || value.targeting?.shape.kind === 'all'
  const categoryMismatch =
    category === 'manual'
      ? value.activation !== 'manual' || value.mode !== 'action'
      : category === 'passive' && value.activation === 'manual'
  return (
    <div className={styles.effectList}>
      {categoryMismatch ? (
        <aside role="status">
          <p>
            This draft uses different category settings. Apply the required settings and review its
            effects before committing.
          </p>
          <button
            type="button"
            onClick={() => {
              const next = { ...value }
              if (category === 'manual') {
                next.activation = 'manual'
                next.mode = 'action'
                next.targeting ??= base().targeting
                delete next.automaticTrigger
                delete next.automaticTarget
              } else {
                next.activation = 'automatic'
                if (next.mode === 'action') {
                  next.automaticTrigger = 'turn-started'
                  next.automaticTarget = {
                    subject: next.targeting?.kind === 'self' ? 'owner' : 'selected',
                  }
                }
              }
              onChange(rebindSimpleRequirement(next))
            }}
          >
            Apply category settings
          </button>
        </aside>
      ) : null}
      {elementRepair !== value ? (
        <aside role="status">
          <p>
            This recovered draft needs its required elemental tags synchronized. Other edits are
            kept.
          </p>
          <button type="button" onClick={() => onChange(elementRepair)}>
            Add required elemental tags
          </button>
        </aside>
      ) : null}
      {value.targeting ? (
        <AreaRecipientRepair
          target={value.targeting}
          effects={value.effects.map((effect) => effect.payload)}
          requiresSelectedUnit={requiresSelectedUnit}
          onChange={(payloads) =>
            onChange({
              ...value,
              effects: value.effects.map((effect, index) => ({
                ...effect,
                payload: payloads[index]!,
              })),
            })
          }
        />
      ) : null}
      <div className={`${styles.typedGrid} ${show('economy') ? styles.economyGrid : ''}`}>
        {show('details') && (
          <>
            <AbilitySelect
              label="Group activation"
              disabledOptions={
                value.effects.some((row) => ['move', 'summon'].includes(row.payload.type))
                  ? ['automatic', 'ongoing']
                  : []
              }
              displayLabel="Activation"
              disabled={Boolean(category)}
              optionLabels={{
                manual: 'Manual',
                automatic: category === 'passive' ? 'Passive' : 'Automatic',
                ongoing: category === 'passive' ? 'Passive' : 'Ongoing',
              }}
              value={value.activation}
              options={category ? [value.activation] : ['manual', 'automatic', 'ongoing']}
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
                if (activation === 'automatic' && next.mode === 'action') {
                  next.automaticTarget ??= { subject: 'selected' }
                  next.automaticTrigger ??= 'requirements-met'
                }
                if (activation !== 'automatic') {
                  delete next.automaticTarget
                  delete next.automaticTrigger
                }
                onChange(rebindSimpleRequirement(next))
              }}
            />
            <AbilitySelect
              label="Group mode"
              disabledOptions={
                value.effects.some((row) => ['move', 'summon'].includes(row.payload.type))
                  ? ['modifier']
                  : []
              }
              displayLabel="Ability type"
              disabled={Boolean(category)}
              optionLabels={{
                action: category === 'passive' ? 'Passive action' : 'Action',
                modifier: 'Passive modifier',
              }}
              value={value.mode}
              options={
                category
                  ? [value.mode]
                  : value.activation === 'ongoing'
                    ? ['modifier']
                    : ['action', 'modifier']
              }
              onChange={(mode) => {
                const next = {
                  ...value,
                  mode,
                  targeting: mode === 'modifier' ? null : (value.targeting ?? base().targeting),
                }
                if (mode === 'modifier') {
                  delete next.automaticTarget
                  delete next.automaticTrigger
                } else if (value.activation === 'automatic') {
                  next.automaticTarget = { subject: 'selected' }
                  next.automaticTrigger ??= 'requirements-met'
                }
                onChange(rebindSimpleRequirement(next))
              }}
            />
            <AbilitySelect
              label="Group classification"
              displayLabel="Purpose"
              optionLabels={{ attack: 'Attack', recovery: 'Recovery', utility: 'Utility' }}
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
                displayLabel="Damage type"
                optionLabels={{ physical: 'Physical', mystic: 'Mystic' }}
                value={value.attackFamily ?? 'physical'}
                options={['physical', 'mystic']}
                onChange={(attackFamily) => onChange({ ...value, attackFamily })}
              />
            ) : null}
          </>
        )}
        {show('economy') && value.activation !== 'ongoing' ? (
          <>
            <AbilityCostEditor
              costs={value.costs}
              onChange={(costs) => onChange({ ...value, costs })}
            />
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
        {show('details') &&
        value.activation === 'automatic' &&
        value.mode === 'action' &&
        !automaticArea ? (
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
        {show('accuracy') && (
          <>
            <AbilitySelect
              label="Accuracy rule"
              help={
                <MasterHelp label="Accuracy availability">
                  Accuracy is used only by an applicable hostile hit-dependent effect. Inactive
                  values remain in this draft and return when compatible effects are added.
                </MasterHelp>
              }
              disabled={!authoringAccuracyApplicable(value)}
              value={
                value.accuracy?.kind === 'fixed' && value.accuracy.chanceBasisPoints === 10000
                  ? 'always'
                  : (value.accuracy?.kind ?? 'standard')
              }
              options={[
                'standard',
                'always',
                ...(value.accuracy?.kind === 'fixed' && value.accuracy.chanceBasisPoints !== 10000
                  ? ['fixed']
                  : []),
              ]}
              optionLabels={{
                standard: 'Accuracy Roll',
                always: 'Always Hit',
                fixed: 'Retained fixed rule',
              }}
              onChange={(kind) => {
                if (kind !== 'standard' && kind !== 'always') return
                const next = { ...value }
                if (kind === 'standard') delete next.accuracy
                else
                  next.accuracy = {
                    kind: 'fixed',
                    chanceBasisPoints: 10000,
                  }
                onChange(next)
              }}
            />
            {value.accuracy?.kind === 'fixed' && value.accuracy.chanceBasisPoints !== 10000 ? (
              <p className={styles.fieldHint}>
                Stored fixed hit chance: {value.accuracy.chanceBasisPoints / 100}%. Choose Accuracy
                Roll or Always Hit to replace this retained rule.
              </p>
            ) : null}
          </>
        )}
      </div>
      {show('details') &&
      value.requirementMode === 'simple' &&
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
      {show('details') && (
        <>
          <fieldset className={`${styles.typedGroup} ${styles.usageLimits}`}>
            <legend>
              Usage limits{' '}
              <MasterHelp label="Usage limits">
                Once per action resets for each command. Once per round resets when the global round
                advances.
              </MasterHelp>
            </legend>
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
            {value.activationLimits?.includes('once-per-owner-turn') ? (
              <div className={styles.fieldHint}>
                <p>
                  Retained: once per owner turn. This existing limit resets on the owner’s next turn
                  cycle.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      activationLimits: value.activationLimits?.filter(
                        (limit) => limit !== 'once-per-owner-turn',
                      ),
                    })
                  }
                >
                  Remove retained owner-turn limit
                </button>
              </div>
            ) : null}
          </fieldset>
          {moveUsesLocalOrGlobalEffects(value) && requiresSelectedUnit && value.targeting ? (
            <>
              <AbilitySelect
                label="Unit for Target Requirements"
                displayLabel="Target unit"
                value={
                  value.targeting.kind === 'self'
                    ? 'self'
                    : value.targeting.kind === 'unit'
                      ? value.targeting.teamPolicy
                      : 'unavailable'
                }
                options={['self', 'enemy', 'ally', 'any']}
                optionLabels={{ self: 'Self', enemy: 'Enemy', ally: 'Ally', any: 'Any other unit' }}
                onChange={(team) => {
                  if (!['self', 'enemy', 'ally', 'any'].includes(team) || !value.targeting) return
                  const policy = team as 'self' | 'enemy' | 'ally' | 'any'
                  const range = policy === 'self' ? 0 : Math.max(1, value.targeting.maximumRange)
                  onChange({
                    ...value,
                    targeting: {
                      ...value.targeting,
                      geometryVersion: 3,
                      kind: policy === 'self' ? 'self' : 'unit',
                      teamPolicy: policy,
                      categories: policy === 'any' ? ['ally', 'enemy'] : [policy],
                      shape: { kind: 'single' },
                      maximumSelections: 1,
                      minimumRange:
                        policy === 'self' ? 0 : Math.min(value.targeting.minimumRange, range),
                      maximumRange: range,
                    },
                  })
                }}
              />
              <MasterHelp label="Target unit">
                This unit is used by Target-based Requirements. Move still selects Ground and moves
                the caster; its destination is separate.
              </MasterHelp>
            </>
          ) : null}
          <AbilityRequirementEditor
            behavior={value}
            value={value.requirements}
            onChange={(requirements) => onChange({ ...value, requirements })}
          />
          <p className={styles.fieldHint}>
            Requirements gate this behavior group’s complete activation and every effect. Other
            behavior groups keep their own activation and Requirements.
          </p>
          <LegacyEffectRequirements value={value} onChange={onChange} />
          {value.requirementMode !== 'simple' ? (
            <button
              type="button"
              onClick={() => onChange({ ...value, requirementMode: 'simple', requirements: null })}
            >
              Use tag requirements
            </button>
          ) : null}
        </>
      )}
      {show('range') && value.targeting ? (
        <AbilityTargetingEditor
          value={value.targeting}
          effects={value.effects}
          requiresSelectedUnit={requiresSelectedUnit}
          disabled={moveWithoutSeparateAim(value)}
          onChange={(targeting) => onChange({ ...value, targeting })}
        />
      ) : null}
      {show('effects') && (
        <>
          <fieldset className={styles.typedGroup} aria-label="Effects">
            <legend>
              Effects{' '}
              <MasterHelp label="Effect compatibility">
                {value.effects.some((row) => ['move', 'summon'].includes(row.payload.type)) ? (
                  <>
                    Move is Manual Action, Instant, once and first. Summon is last and uses one
                    Empty Tile. They cannot share a group.{' '}
                  </>
                ) : null}
                Copy and Reveal need a single unit. Choices follow this group’s activation and
                selected targets. Disabled choices cannot use the current combination; edit those
                settings explicitly or use another group.
              </MasterHelp>
            </legend>
            <div className={styles.effectList}>
              {value.effects.map((effect, index) => (
                <article
                  className={styles.effectCard}
                  key={effect.id}
                  data-ability-effect={effect.id}
                >
                  <header className={styles.effectHeader}>
                    <strong>
                      Effect {index + 1} ·{' '}
                      <EffectTagLabel label={effectAuthoringTag(effect.payload).label} />
                      <span className={styles.effectTarget}>
                        {' '}
                        [{inheritedEffectTargetLabel(effect.payload, value.targeting ?? undefined)}]
                      </span>
                      {isAuthoredElementalCompanion(effect) ? (
                        <small> · Required by element</small>
                      ) : null}
                      {effect.requirements ? <small> · Retained condition (Details)</small> : null}
                    </strong>
                    <div className={styles.effectActions}>
                      <button
                        type="button"
                        disabled={index === 0 || !!authoringReorderIssue(value, index, -1)}
                        title={authoringReorderIssue(value, index, -1)}
                        onClick={() => {
                          if (authoringReorderIssue(value, index, -1)) return
                          onChange({
                            ...value,
                            effects: reorderedAuthoringEffects(value.effects, index, index - 1),
                          })
                        }}
                      >
                        ↑ Up
                      </button>
                      <button
                        type="button"
                        disabled={
                          index === value.effects.length - 1 ||
                          !!authoringReorderIssue(value, index, 1)
                        }
                        title={authoringReorderIssue(value, index, 1)}
                        onClick={() => {
                          if (authoringReorderIssue(value, index, 1)) return
                          onChange({
                            ...value,
                            effects: reorderedAuthoringEffects(value.effects, index, index + 1),
                          })
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
                  <details className={styles.effectBody} data-effect-collapsible="true">
                    <summary>Edit parameters</summary>
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
                  </details>
                </article>
              ))}
            </div>
            <EffectTagPicker
              label="New effect"
              addLabel="Add new effect"
              additionalIssue={(id) => authoringAddedEffectIssue(value, id)}
              combination={{ activation: value.activation, mode: value.mode }}
              context={{
                summonProfile: latestEnabledMatureSkills().find((skill) => skill.summonProfile)
                  ?.summonProfile,
              }}
              disabled={value.effects.length >= ABILITY_DEFINITION_BUDGET.maximumEffectsPerBehavior}
              onAdd={(payload) => {
                if (payload.type === 'summon')
                  payload = withAuthoredEffectTarget(payload, 'empty-tile')
                onChange({
                  ...value,
                  effects: insertAuthoringEffect(value.effects, {
                    id: nextId('effect', value.effects),
                    payload: value.targeting
                      ? withAuthoredAreaRecipients(value.targeting, [payload], {
                          requiresSelectedUnit,
                        })[0]!
                      : payload,
                  }),
                })
              }}
            />
          </fieldset>
        </>
      )}
      {show('range') && (
        <AbilityGroundEditor
          disabled={moveWithoutSeparateAim(value)}
          value={value}
          onChange={onChange}
        />
      )}
    </div>
  )
}

/** One canonical editing surface for Skill, Essence, Resonance and Basic containers. */
export function AbilityDefinitionEditor({
  value,
  effectDescriptions,
  onChange,
  section,
  category,
}: {
  value: AbilityDefinition
  category?: 'manual' | 'passive'
  section?: AbilityEditorSection
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
  const issues = validateAbilityDefinition(activeAbilityForAuthoring(value))
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
      {(!section || section === 'details') && (
        <p className={styles.fieldHint}>
          Set activation and Requirements here. Each behavior group applies them to every effect in
          its own action.
        </p>
      )}
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
            Behavior {index + 1} ·{' '}
            {{ manual: 'Manual', automatic: 'Automatic', ongoing: 'Ongoing' }[behavior.activation]}{' '}
            {behavior.mode === 'action' ? 'action' : 'modifier'}
          </summary>
          {(!section || section === 'details') && (
            <>
              <div className={styles.groupActions}>
                <button
                  type="button"
                  aria-label="Move group up"
                  title="Move behavior up"
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
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move group down"
                  title="Move behavior down"
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
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove group"
                  disabled={value.behaviors.length <= 1}
                  onClick={() =>
                    commit({
                      ...value,
                      behaviors: value.behaviors.filter((row) => row.id !== behavior.id),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </>
          )}
          <AbilityGroupEditor
            value={behavior}
            section={section}
            category={category}
            onChange={(next) =>
              commit({
                ...value,
                behaviors: value.behaviors.map((row) => (row.id === behavior.id ? next : row)),
              })
            }
          />
        </details>
      ))}
      {(!section || section === 'details') && (
        <>
          <button
            type="button"
            aria-label="Add behavior group"
            disabled={value.behaviors.length >= ABILITY_DEFINITION_BUDGET.maximumBehaviors}
            onClick={() =>
              commit({
                ...value,
                behaviors: [
                  ...value.behaviors,
                  {
                    ...(category === 'passive' ? newResonanceAbility().behaviors[0]! : base()),
                    id: nextId('group', value.behaviors),
                  },
                ],
              })
            }
          >
            Add behavior
          </button>{' '}
        </>
      )}
    </section>
  )
}
