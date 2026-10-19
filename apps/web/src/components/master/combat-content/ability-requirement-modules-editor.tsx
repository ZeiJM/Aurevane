'use client'

import type { AbilityBehavior, RequirementNode } from '@aurevane/game-core/combat/combat-definition'
import {
  COMBAT_TRIGGER_MODULES,
  compileCombatRequirementModules,
  createCombatTriggerModuleSelection,
  recognizeCombatRequirementModules,
} from '@aurevane/game-core/combat/combat-requirement-modules'
import { validateAbilityRequirements } from '@aurevane/game-core/combat/combat-requirements'
import { AbilityRequirementEditor } from './ability-requirement-editor'
import { AbilityNumber, AbilitySelect } from './ability-editor-fields'
import styles from './combat-content-editor.module.css'

/** One trigger slot and reusable condition slots, lowered to the canonical interpreter. */
export function AbilityRequirementModulesEditor({
  value,
  behavior,
  onChange,
  label = 'Requirements',
}: {
  value: RequirementNode | null
  behavior: AbilityBehavior
  onChange: (value: RequirementNode | null) => void
  label?: string
}) {
  const modules = recognizeCombatRequirementModules(value, behavior)
  if (!modules)
    return (
      <AbilityRequirementEditor value={value} onChange={onChange} label={label} primitiveOnly />
    )
  const triggerOptions = COMBAT_TRIGGER_MODULES.filter((module) =>
    behavior.mode === 'modifier'
      ? module.id === 'trigger.before-attack'
      : module.id !== 'trigger.before-attack',
  )
  const updateTrigger = (trigger: typeof modules.trigger) => {
    if (
      trigger?.parameters.actionQualifiers.some((node) => validateAbilityRequirements(node).length)
    )
      return
    onChange(compileCombatRequirementModules({ ...modules, trigger }))
  }
  return (
    <fieldset className={styles.typedGroup} data-requirement-modules="true">
      <legend>{label}</legend>
      {behavior.activation === 'automatic' ? (
        <>
          <AbilitySelect
            label="Trigger module"
            value={modules.trigger?.id ?? 'none'}
            options={['none', ...triggerOptions.map((module) => module.id)]}
            optionLabels={{
              none: 'State entry',
              ...Object.fromEntries(
                COMBAT_TRIGGER_MODULES.map((module) => [module.id, module.label]),
              ),
            }}
            onChange={(id) =>
              updateTrigger(id === 'none' ? null : createCombatTriggerModuleSelection(id))
            }
          />
          {modules.trigger ? (
            <fieldset className={styles.typedGroup}>
              <legend>Trigger parameters</legend>
              {modules.trigger.parameters.actionQualifiers.map((node, index) => (
                <AbilityRequirementEditor
                  key={index}
                  label={`Action filter ${index + 1}`}
                  value={node}
                  lockedKind
                  lockedActionClassification={
                    [
                      'trigger.attack-hit',
                      'trigger.before-attack',
                      'trigger.mp-threshold-crossed-by-drain',
                    ].includes(modules.trigger!.id) && node.classification === 'attack'
                  }
                  lockedActionTags={
                    modules.trigger!.id === 'trigger.mp-threshold-crossed-by-drain' ? ['drain'] : []
                  }
                  primitiveOnly
                  onChange={(next) => {
                    if (next?.kind !== 'action' || !modules.trigger) return
                    updateTrigger({
                      ...modules.trigger,
                      parameters: {
                        ...modules.trigger.parameters,
                        actionQualifiers: modules.trigger.parameters.actionQualifiers.map(
                          (prior, ordinal) => (ordinal === index ? next : prior),
                        ),
                      },
                    })
                  }}
                />
              ))}
              {modules.trigger.parameters.causalRelations.length ? (
                <div className={styles.typedGrid}>
                  {modules.trigger.parameters.causalRelations.map((relation, index) => (
                    <span key={index} data-trigger-scope="true">
                      {relation.subject === 'triggering'
                        ? 'Source'
                        : relation.subject === 'affected'
                          ? 'Recipient'
                          : relation.subject === 'selected'
                            ? 'Target'
                            : 'Self'}{' '}
                      [
                      {relation.relation === 'same-unit'
                        ? 'Self'
                        : relation.relation === 'ally'
                          ? 'Ally'
                          : 'Enemy'}
                      ]
                    </span>
                  ))}
                </div>
              ) : null}
              {modules.trigger.parameters.crossing ? (
                <AbilityNumber
                  label="Crossing threshold (%)"
                  value={modules.trigger.parameters.crossing.thresholdBasisPoints / 100}
                  min={0}
                  max={100}
                  step={0.01}
                  onChange={(percent) => {
                    if (!modules.trigger?.parameters.crossing || percent < 0 || percent > 100)
                      return
                    updateTrigger({
                      ...modules.trigger,
                      parameters: {
                        ...modules.trigger.parameters,
                        crossing: {
                          ...modules.trigger.parameters.crossing,
                          thresholdBasisPoints: Math.round(percent * 100),
                        },
                      },
                    })
                  }}
                />
              ) : null}
              {modules.trigger.parameters.resourceChange ? (
                <AbilityNumber
                  label="Minimum resource change"
                  value={modules.trigger.parameters.resourceChange.minimumAmount}
                  min={1}
                  onChange={(minimumAmount) => {
                    if (
                      !modules.trigger?.parameters.resourceChange ||
                      !Number.isSafeInteger(minimumAmount) ||
                      minimumAmount < 1
                    )
                      return
                    updateTrigger({
                      ...modules.trigger,
                      parameters: {
                        ...modules.trigger.parameters,
                        resourceChange: {
                          ...modules.trigger.parameters.resourceChange,
                          minimumAmount,
                        },
                      },
                    })
                  }}
                />
              ) : null}
            </fieldset>
          ) : null}
        </>
      ) : null}
      <div className={styles.effectList}>
        {modules.conditions.map((condition, index) => (
          <AbilityRequirementEditor
            key={index}
            label={`Condition ${index + 1}`}
            value={condition}
            conditionOnly
            allowedSubjects={behavior.activation === 'ongoing' ? ['owner'] : undefined}
            primitiveOnly
            onChange={(next) => {
              if (validateAbilityRequirements(next).length) return
              onChange(
                compileCombatRequirementModules({
                  ...modules,
                  conditions: next
                    ? modules.conditions.map((prior, ordinal) => (ordinal === index ? next : prior))
                    : modules.conditions.filter((_, ordinal) => ordinal !== index),
                }),
              )
            }}
          />
        ))}
        <button
          type="button"
          disabled={modules.conditions.length >= 126}
          onClick={() =>
            onChange(
              compileCombatRequirementModules({
                ...modules,
                conditions: [
                  ...modules.conditions,
                  { kind: 'status-presence', subject: 'owner', statusId: 'guarded', present: true },
                ],
              }),
            )
          }
        >
          Add condition module
        </button>
      </div>
    </fieldset>
  )
}
