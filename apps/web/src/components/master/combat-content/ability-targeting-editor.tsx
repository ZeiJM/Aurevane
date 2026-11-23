'use client'

import type { AbilityTargeting, AbilityEffect } from '@aurevane/game-core/combat/combat-definition'
import { SkillTargetingEditor } from './skill-targeting-editor'
import styles from './combat-content-editor.module.css'

/** Native and modular abilities share one geometry editor without dropping captured categories. */
export function AbilityTargetingEditor({
  value,
  effects,
  requiresSelectedUnit,
  disabled,
  onChange,
  onChangeEffects,
}: {
  value: AbilityTargeting
  effects?: readonly AbilityEffect[]
  requiresSelectedUnit?: boolean
  disabled?: boolean
  onChange(value: AbilityTargeting): void
  onChangeEffects?(effects: readonly AbilityEffect[]): void
}) {
  const move = effects?.find((effect) => effect.payload.type === 'move')
  const payload = move?.payload.type === 'move' ? move.payload : undefined
  const updateMove = (next: NonNullable<typeof payload>) => {
    if (move && effects)
      onChangeEffects?.(
        effects.map((effect) => (effect === move ? { ...effect, payload: next } : effect)),
      )
  }
  return (
    <SkillTargetingEditor
      value={value}
      disabled={disabled}
      movementOnly={disabled && !!payload}
      movementControls={
        payload && onChangeEffects ? (
          <div className={styles.rangeGrid}>
            <label className={styles.field}>
              <span>Move elevation</span>
              <input
                aria-label="Move elevation"
                type="number"
                min={0}
                max={3}
                value={payload.maximumElevation ?? ''}
                placeholder="Character Jump"
                onChange={(event) => {
                  const next = { ...payload }
                  if (event.currentTarget.value === '') delete next.maximumElevation
                  else next.maximumElevation = Number(event.currentTarget.value)
                  updateMove(next)
                }}
              />
              <small className={styles.fieldHint}>
                Blank uses the character’s Jump. A value overrides Jump for this Move only.
              </small>
            </label>
            <label className={styles.checkField}>
              <input
                aria-label="Move requires line of sight"
                type="checkbox"
                checked={payload.requiresLineOfSight ?? false}
                onChange={(event) =>
                  updateMove({ ...payload, requiresLineOfSight: event.currentTarget.checked })
                }
              />
              <span>Move requires line of sight</span>
            </label>
          </div>
        ) : undefined
      }
      requiresSelectedUnit={requiresSelectedUnit}
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
