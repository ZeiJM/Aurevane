'use client'

import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'

import { AbilityCostEditor } from './ability-cost-editor'
import styles from './combat-content-editor.module.css'

export type SkillEconomyDraft = Pick<
  MatureSkillDefinition,
  'apCost' | 'mpCost' | 'hpCost' | 'accuracyMode' | 'accuracyModifierBasisPoints' | 'cooldown'
>

export interface SkillEconomyEditorProps {
  readonly section?: 'economy' | 'accuracy'
  readonly value: SkillEconomyDraft
  readonly apCostBounds?: { readonly minimum: number; readonly maximum: number }
  readonly cooldownLockedByRequirement?: boolean
  readonly onChange: (value: SkillEconomyDraft) => void
}

function integer(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : fallback
}

export function SkillEconomyEditor({
  value,
  section,
  apCostBounds = { minimum: 1, maximum: 100 },
  cooldownLockedByRequirement = false,
  onChange,
}: SkillEconomyEditorProps) {
  const accuracyMode = value.accuracyMode ?? 'automatic'

  return (
    <fieldset className={styles.typedGroup}>
      <legend>
        {section === 'economy'
          ? 'Action Economy'
          : section === 'accuracy'
            ? 'Accuracy'
            : 'Execution Characteristics'}
      </legend>

      <div className={`${styles.typedGrid} ${styles.economyGrid}`}>
        {section !== 'accuracy' && (
          <>
            <AbilityCostEditor
              apLabel="Action Economy (AP)"
              apBounds={apCostBounds}
              mpMaximum={20}
              costs={[
                { resource: 'ap', amount: value.apCost },
                ...(value.mpCost !== undefined
                  ? [{ resource: 'mp' as const, amount: value.mpCost }]
                  : []),
                ...(value.hpCost !== undefined
                  ? [{ resource: 'hp' as const, amount: value.hpCost }]
                  : []),
              ]}
              onChange={(costs) =>
                onChange({
                  ...value,
                  apCost: costs.find((cost) => cost.resource === 'ap')?.amount ?? value.apCost,
                  mpCost: costs.find((cost) => cost.resource === 'mp')?.amount,
                  hpCost: costs.find((cost) => cost.resource === 'hp')?.amount,
                })
              }
            />

            <label className={styles.field}>
              <span>Cooldown</span>
              <input
                aria-label="Cooldown (turns)"
                type="number"
                min={1}
                max={3}
                step={1}
                disabled={cooldownLockedByRequirement}
                value={value.cooldown?.ownerTurns ?? 1}
                onChange={(event) =>
                  onChange({
                    ...value,
                    cooldown: {
                      key: value.cooldown?.key ?? 'skill.cooldown',
                      ownerTurns: Math.max(
                        1,
                        Math.min(
                          3,
                          integer(event.currentTarget.value, value.cooldown?.ownerTurns ?? 1),
                        ),
                      ),
                    },
                  })
                }
              />
              <small className={styles.fieldHint}>
                {cooldownLockedByRequirement
                  ? 'Requirement-gated Skills have no cooldown.'
                  : 'Power-based cooldowns are limited to 1–3 turns.'}
              </small>
            </label>
          </>
        )}
        {section !== 'economy' && (
          <>
            <label className={styles.field}>
              <span>Accuracy</span>
              <select
                aria-label="Accuracy mode"
                value={accuracyMode}
                onChange={(event) => {
                  const next = event.currentTarget.value as 'automatic' | 'per-target'
                  onChange({
                    ...value,
                    accuracyMode: next,
                    accuracyModifierBasisPoints: undefined,
                  })
                }}
              >
                <option value="automatic">Always Hit</option>
                <option value="per-target">Accuracy Roll</option>
              </select>
            </label>
          </>
        )}
      </div>
    </fieldset>
  )
}
