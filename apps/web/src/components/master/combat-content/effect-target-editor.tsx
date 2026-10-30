'use client'

import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import {
  COMBAT_EFFECT_TARGETS,
  type CombatEffectTarget,
} from '@aurevane/game-core/combat/combat-effect-recipients'
import {
  deriveSharedEffectAim,
  withAuthoredEffectTarget,
  type TargetedEffect,
} from '@aurevane/game-core/combat/combat-effect-target-authoring'
import styles from './combat-content-editor.module.css'
import { MasterHelp } from '../master-help'

import {
  EFFECT_TARGET_LABELS,
  effectTargetLabel as inheritedEffectTargetLabel,
} from '../../character/effect-target-presentation'
export { EFFECT_TARGET_LABELS, inheritedEffectTargetLabel }

export function EffectTargetEditor({
  value,
  aim,
  siblings,
  onChange,
}: {
  value: TargetedEffect
  aim?: CombatTargetSpec
  siblings?: readonly TargetedEffect[]
  onChange(target: CombatEffectTarget): void
}) {
  const options = COMBAT_EFFECT_TARGETS.map((target) => {
    let reason: string | undefined
    try {
      const next = withAuthoredEffectTarget(value, target)
      if (target === 'empty-tile' && !['summon', 'create-terrain'].includes(value.type))
        throw new TypeError('Empty Tile supports terrain and summon effects.')
      if (target === 'empty-tile' && !aim)
        throw new TypeError(
          'This effect uses its triggering Skill’s delivery; it cannot select a separate tile.',
        )
      if (aim) {
        const rows = siblings ? siblings.map((row) => (row === value ? next : row)) : [next]
        const derived = deriveSharedEffectAim(aim, rows)
        if (
          (target === 'ground' || target === 'empty-tile') &&
          !derived.categories?.includes('ground') &&
          !['ground-tile', 'empty-tile'].includes(derived.kind)
        )
          throw new TypeError('Set the other effects’ targets first to replace inherited delivery.')
      }
    } catch (error) {
      reason = error instanceof Error ? error.message : 'Unsupported target.'
    }
    return { target, reason }
  })
  return (
    <div className={styles.effectTargetEditor}>
      <label className={styles.field}>
        <span>Target</span>
        <select
          aria-label="Target"
          value={value.target ?? ''}
          onChange={(event) => onChange(event.currentTarget.value as CombatEffectTarget)}
        >
          {value.target === undefined ? (
            <option value="">{inheritedEffectTargetLabel(value, aim)} · existing rules</option>
          ) : null}
          {options.map(({ target, reason }) => (
            <option key={target} value={target} disabled={!!reason} title={reason}>
              {EFFECT_TARGET_LABELS[target]}
            </option>
          ))}
        </select>
      </label>
      <MasterHelp label="Target">
        <p>All effects use the same aim. Existing rules stay in place until you choose a target.</p>
        {options.some((option) => option.reason) ? (
          <ul>
            {[...new Set(options.flatMap((option) => (option.reason ? [option.reason] : [])))].map(
              (reason) => (
                <li key={reason}>{reason}</li>
              ),
            )}
          </ul>
        ) : null}
      </MasterHelp>
    </div>
  )
}
