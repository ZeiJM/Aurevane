'use client'

import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'

import styles from './combat-content-editor.module.css'

export type SkillEconomyDraft = Pick<
  MatureSkillDefinition,
  'apCost' | 'mpCost' | 'accuracyMode' | 'accuracyModifierBasisPoints'
>

export interface SkillEconomyEditorProps {
  readonly value: SkillEconomyDraft
  readonly onChange: (value: SkillEconomyDraft) => void
}

function integer(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : fallback
}

export function SkillEconomyEditor({ value, onChange }: SkillEconomyEditorProps) {
  const accuracyMode = value.accuracyMode ?? 'automatic'

  return (
    <fieldset className={styles.typedGroup}>
      <legend>Action Economy &amp; Accuracy</legend>

      <div className={styles.typedGrid}>
        <label className={styles.field}>
          <span>Action Economy (AP)</span>
          <input
            aria-label="Action Economy (AP)"
            type="number"
            min={1}
            max={100}
            value={value.apCost}
            onChange={(event) =>
              onChange({
                ...value,
                apCost: integer(event.currentTarget.value, value.apCost),
              })
            }
          />
        </label>

        <label className={styles.field}>
          <span>MP cost</span>
          <input
            aria-label="MP cost"
            type="number"
            min={0}
            max={20}
            value={value.mpCost ?? 0}
            onChange={(event) =>
              onChange({
                ...value,
                mpCost: integer(event.currentTarget.value, value.mpCost ?? 0),
              })
            }
          />
        </label>

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
                accuracyModifierBasisPoints:
                  next === 'per-target' ? (value.accuracyModifierBasisPoints ?? 0) : undefined,
              })
            }}
          >
            <option value="automatic">Automatic Hit</option>
            <option value="per-target">Accuracy Roll</option>
          </select>
        </label>

        {accuracyMode === 'per-target' ? (
          <label className={styles.field}>
            <span>Accuracy modifier</span>
            <input
              aria-label="Accuracy modifier (basis points)"
              type="number"
              min={-3000}
              max={3000}
              value={value.accuracyModifierBasisPoints ?? 0}
              onChange={(event) =>
                onChange({
                  ...value,
                  accuracyModifierBasisPoints: integer(
                    event.currentTarget.value,
                    value.accuracyModifierBasisPoints ?? 0,
                  ),
                })
              }
            />
            <small className={styles.fieldHint}>
              Signed basis points. +100 = +1 percentage point before clamping.
            </small>
          </label>
        ) : null}
      </div>
    </fieldset>
  )
}
