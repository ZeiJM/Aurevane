'use client'

import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import {
  maximumSupportedCombatRange,
  normalizeCurrentCombatTargetSpec,
} from '@aurevane/game-core/combat/combat-targeting-shapes'
import { skillTargetMethodExplanation } from '../../character/skill-detail-presentation'
import type { TargetedEffect } from '@aurevane/game-core/combat/combat-effect-target-authoring'
import { AbilityNumber } from './ability-editor-fields'
import styles from './combat-content-editor.module.css'

export interface SkillTargetingEditorProps {
  readonly value: CombatTargetSpec
  readonly effects?: readonly TargetedEffect[]
  readonly v51Rules?: boolean
  readonly onChange: (value: CombatTargetSpec) => void
}

export function SkillTargetingEditor({
  value,
  effects,
  v51Rules = false,
  onChange,
}: SkillTargetingEditorProps) {
  const modern = value.geometryVersion === 2 || value.geometryVersion === 3
  const area = modern && value.shape.kind !== 'single'
  const inheritedAll = value.shape.kind === 'all'
  const selfOnly = value.kind === 'self'
  const singleRequired =
    value.kind === 'empty-tile' ||
    effects?.some((effect) => ['copy-statuses', 'sensory', 'summon'].includes(effect.type))
  const shape = value.shape
  const invalidRange = value.minimumRange > value.maximumRange
  const currentNonSelf = v51Rules && !selfOnly
  function change(next: CombatTargetSpec) {
    // Geometry3's independent category capture must not be demoted by editing a range.
    if (value.geometryVersion === 3) {
      const reach =
        next.shape.kind === 'circle'
          ? next.shape.radius
          : next.shape.kind === 'line'
            ? next.shape.length
            : null
      onChange({ ...next, ...(reach !== null ? { minimumRange: 0, maximumRange: reach } : {}) })
    } else onChange(normalizeCurrentCombatTargetSpec(next))
  }
  const friendlyFireOn =
    value.friendlyFire === 'all-units' || value.friendlyFire === 'all-except-actor'
  return (
    <fieldset className={styles.typedGroup}>
      <legend>Range &amp; Area</legend>
      <p className={styles.fieldHint}>
        Choose each effect’s Target in Effects. This area controls their shared reach and footprint.
      </p>
      <div className={styles.rangeGrid}>
        {!selfOnly && !area ? (
          <>
            <AbilityNumber
              label="Minimum target range"
              invalid={invalidRange}
              value={value.minimumRange}
              max={maximumSupportedCombatRange()}
              onChange={(minimumRange) => change({ ...value, minimumRange })}
            />
            <AbilityNumber
              label="Maximum target range"
              invalid={invalidRange}
              value={value.maximumRange}
              min={currentNonSelf ? 1 : 0}
              max={currentNonSelf ? 5 : maximumSupportedCombatRange()}
              onChange={(maximumRange) => change({ ...value, maximumRange })}
            />
          </>
        ) : null}
        {!selfOnly || inheritedAll ? (
          <>
            <label className={styles.field}>
              <span>Shape</span>
              <select
                aria-label="Shape"
                value={shape.kind}
                onChange={(event) => {
                  const kind = event.currentTarget.value as 'single' | 'circle' | 'line'
                  change({
                    ...value,
                    shape:
                      kind === 'circle'
                        ? { kind, radius: 1 }
                        : kind === 'line'
                          ? { kind, length: 1 }
                          : { kind },
                  })
                }}
              >
                {inheritedAll ? (
                  <option value="all" disabled>
                    Existing global footprint
                  </option>
                ) : null}
                <option value="single">Single</option>
                <option value="circle" disabled={singleRequired}>
                  Circle
                </option>
                <option value="line" disabled={singleRequired}>
                  Line
                </option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Targetable Elevation</span>
              <input
                aria-label="Targetable Elevation"
                type="number"
                min={0}
                max={currentNonSelf ? 2 : undefined}
                value={value.maximumElevationDifference ?? ''}
                placeholder="Unlimited"
                onChange={(event) =>
                  change({
                    ...value,
                    maximumElevationDifference:
                      event.currentTarget.value === '' ? null : Number(event.currentTarget.value),
                  })
                }
              />
            </label>
          </>
        ) : null}
        {['enemy', 'any'].includes(value.teamPolicy) ||
        effects?.some((effect) => effect.target === 'all') ? (
          <label className={styles.field}>
            <span>Friendly Fire</span>
            <select
              aria-label="Friendly Fire"
              value={friendlyFireOn ? 'on' : 'off'}
              onChange={(event) =>
                change({
                  ...value,
                  friendlyFire:
                    event.currentTarget.value === 'on'
                      ? 'all-units'
                      : value.friendlyFire === 'allies-only'
                        ? 'allies-only'
                        : 'enemies-only',
                })
              }
            >
              <option value="off">Off</option>
              <option value="on">On</option>
            </select>
            <small className={styles.fieldHint}>
              Applies to hostile area effects. Explicit Ally and Self effects keep their own
              targets.
            </small>
          </label>
        ) : null}
        {shape.kind === 'circle' || shape.kind === 'line' ? (
          <AbilityNumber
            label={shape.kind === 'circle' ? 'Circle radius' : 'Line length'}
            value={shape.kind === 'circle' ? shape.radius : shape.length}
            min={modern ? 1 : shape.kind === 'circle' ? 0 : 1}
            max={modern ? 5 : undefined}
            onChange={(reach) =>
              change({
                ...value,
                shape:
                  shape.kind === 'circle'
                    ? { kind: 'circle', radius: reach }
                    : { kind: 'line', length: reach },
              })
            }
          />
        ) : null}
      </div>
      {selfOnly ? (
        <p className={styles.fieldHint}>
          Self and All effects do not require a separate aim. All uses arena-wide recipients.
        </p>
      ) : null}
      {!selfOnly && !inheritedAll ? (
        <label className={styles.checkField}>
          <input
            aria-label="Requires line of sight"
            type="checkbox"
            checked={value.requiresLineOfSight}
            onChange={(event) =>
              change({ ...value, requiresLineOfSight: event.currentTarget.checked })
            }
          />
          <span>Requires line of sight</span>
        </label>
      ) : null}
      {currentNonSelf ? (
        <p className={styles.fieldHint}>
          Elevation 0 is standard; 1 is uncommon; 2 is rare. Skipping line of sight consumes
          targeting budget.
        </p>
      ) : null}
      {modern && !selfOnly ? (
        <p className={styles.fieldHint}>{skillTargetMethodExplanation({ target: value })}</p>
      ) : null}
      {(value.maximumSelections ?? 1) > 1 ? (
        <div className={styles.fieldHint}>
          <p>
            This existing definition retains {value.maximumSelections} selections. Review its
            effects when switching to one shared aim.
          </p>
          <button type="button" onClick={() => onChange({ ...value, maximumSelections: 1 })}>
            Use one shared aim
          </button>
        </div>
      ) : null}
      {invalidRange ? (
        <p className={styles.inlineError} role="alert">
          Minimum range cannot exceed maximum range.
        </p>
      ) : null}
    </fieldset>
  )
}
