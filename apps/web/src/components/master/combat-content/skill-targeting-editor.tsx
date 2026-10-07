'use client'

import type {
  CombatFriendlyFirePolicy,
  CombatTargetKind,
  CombatTargetShape,
  CombatTargetSpec,
  CombatTargetTeamPolicy,
} from '@aurevane/game-core/combat/actions'

import { normalizeCurrentCombatTargetSpec } from '@aurevane/game-core/combat/combat-targeting-shapes'

import { skillTargetMethodExplanation } from '../../character/skill-detail-presentation'
import styles from './combat-content-editor.module.css'

export interface SkillTargetingEditorProps {
  readonly value: CombatTargetSpec
  readonly v51Rules?: boolean
  readonly onChange: (value: CombatTargetSpec) => void
}

const TARGET_KINDS: readonly { value: CombatTargetKind; label: string }[] = [
  { value: 'self', label: 'Self' },
  { value: 'unit', label: 'Unit' },
  { value: 'ground-tile', label: 'Ground' },
  { value: 'empty-tile', label: 'Empty Tile' },
]

const TEAM_POLICIES: readonly { value: CombatTargetTeamPolicy; label: string }[] = [
  { value: 'self', label: 'Self' },
  { value: 'ally', label: 'Ally' },
  { value: 'enemy', label: 'Enemy' },
  { value: 'any', label: 'Anyone' },
]

const FRIENDLY_FIRE_POLICIES: readonly {
  value: CombatFriendlyFirePolicy
  label: string
}[] = [
  { value: 'enemies-only', label: 'Enemies only' },
  { value: 'allies-only', label: 'Allies only' },
  { value: 'all-units', label: 'All units' },
  { value: 'all-except-actor', label: 'All except actor' },
]

function integer(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : fallback
}

function shapeForKind(
  kind: CombatTargetShape['kind'],
  current: CombatTargetShape,
): CombatTargetShape {
  if (kind === 'all') return { kind: 'all' }
  if (kind === 'single') return { kind: 'single' }
  if (kind === 'circle') {
    return { kind: 'circle', radius: current.kind === 'circle' ? current.radius : 1 }
  }
  return { kind: 'line', length: current.kind === 'line' ? current.length : 1 }
}

export function SkillTargetingEditor({
  value,
  v51Rules = false,
  onChange,
}: SkillTargetingEditorProps) {
  const change = (next: CombatTargetSpec) => onChange(normalizeCurrentCombatTargetSpec(next))
  const modern = value.geometryVersion === 2
  const area = modern && value.shape.kind !== 'single'
  const all = modern && value.shape.kind === 'all'
  const shape = value.shape
  const invalidRange = value.minimumRange > value.maximumRange
  const currentNonSelf = v51Rules && value.kind !== 'self'

  return (
    <fieldset className={styles.typedGroup}>
      <legend>Targeting</legend>

      <div className={styles.typedGrid}>
        <label className={styles.field}>
          <span>Target kind</span>
          <select
            aria-label="Target kind"
            value={value.kind}
            onChange={(event) =>
              change({
                ...value,
                kind: event.currentTarget.value as CombatTargetKind,
              })
            }
          >
            {TARGET_KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Team policy</span>
          <select
            aria-label="Team policy"
            value={value.teamPolicy}
            onChange={(event) =>
              change({
                ...value,
                teamPolicy: event.currentTarget.value as CombatTargetTeamPolicy,
              })
            }
          >
            {TEAM_POLICIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Shape</span>
          <select
            aria-label="Target shape"
            value={shape.kind}
            onChange={(event) =>
              change({
                ...value,
                shape: shapeForKind(event.currentTarget.value as CombatTargetShape['kind'], shape),
              })
            }
          >
            <option value="single">Single</option>
            <option value="circle">Circle</option>
            <option value="line">Line</option>
            <option value="all">All</option>
          </select>
        </label>

        {shape.kind === 'circle' ? (
          <label className={styles.field}>
            <span>Circle radius</span>
            <input
              aria-label="Circle radius"
              type="number"
              min={modern ? 1 : 0}
              max={modern ? 5 : undefined}
              value={shape.radius}
              onChange={(event) =>
                change({
                  ...value,
                  shape: {
                    kind: 'circle',
                    radius: integer(event.currentTarget.value, shape.radius),
                  },
                })
              }
            />
          </label>
        ) : null}

        {shape.kind === 'line' ? (
          <label className={styles.field}>
            <span>Line length</span>
            <input
              aria-label="Line length"
              type="number"
              min={1}
              max={modern ? 5 : undefined}
              value={shape.length}
              onChange={(event) =>
                change({
                  ...value,
                  shape: {
                    kind: 'line',
                    length: integer(event.currentTarget.value, shape.length),
                  },
                })
              }
            />
          </label>
        ) : null}

        {!area ? (
          <>
            <label className={styles.field}>
              <span>Minimum range</span>
              <input
                aria-label="Minimum range"
                aria-invalid={invalidRange}
                type="number"
                min={0}
                value={value.minimumRange}
                onChange={(event) =>
                  change({
                    ...value,
                    minimumRange: integer(event.currentTarget.value, value.minimumRange),
                  })
                }
              />
            </label>

            <label className={styles.field}>
              <span>Maximum range</span>
              <input
                aria-label="Maximum range"
                aria-invalid={invalidRange}
                type="number"
                min={currentNonSelf ? 1 : 0}
                max={currentNonSelf ? 5 : undefined}
                value={value.maximumRange}
                onChange={(event) =>
                  change({
                    ...value,
                    maximumRange: integer(event.currentTarget.value, value.maximumRange),
                  })
                }
              />
              {currentNonSelf ? (
                <small className={styles.fieldHint}>
                  Current v5.1 non-self reach is 1–5; longer reach reduces effect budget.
                </small>
              ) : null}
            </label>
          </>
        ) : null}
        <label className={styles.field}>
          <span>Maximum elevation difference</span>
          <input
            aria-label="Maximum elevation difference"
            type="number"
            min={0}
            max={currentNonSelf ? 2 : undefined}
            value={value.maximumElevationDifference ?? ''}
            placeholder={currentNonSelf ? '0' : 'Unlimited'}
            onChange={(event) =>
              change({
                ...value,
                maximumElevationDifference:
                  event.currentTarget.value === ''
                    ? null
                    : integer(event.currentTarget.value, value.maximumElevationDifference ?? 0),
              })
            }
          />
          {currentNonSelf ? (
            <small className={styles.fieldHint}>
              Elevation 0 is standard; 1 is uncommon; 2 is rare.
            </small>
          ) : null}
        </label>

        <label className={styles.field}>
          <span>Friendly fire</span>
          <select
            aria-label="Friendly fire"
            value={value.friendlyFire}
            onChange={(event) =>
              change({
                ...value,
                friendlyFire: event.currentTarget.value as CombatFriendlyFirePolicy,
              })
            }
          >
            {FRIENDLY_FIRE_POLICIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!all ? (
        <>
          <label className={styles.checkField}>
            <input
              aria-label="Requires line of sight"
              type="checkbox"
              checked={value.requiresLineOfSight}
              onChange={(event) =>
                change({
                  ...value,
                  requiresLineOfSight: event.currentTarget.checked,
                })
              }
            />
            <span>Requires line of sight</span>
            {currentNonSelf ? (
              <small className={styles.fieldHint}>
                Skipping line of sight consumes targeting budget.
              </small>
            ) : null}
          </label>
        </>
      ) : null}
      {modern ? (
        <p className={styles.fieldHint}>{skillTargetMethodExplanation({ target: value })}</p>
      ) : null}
      {invalidRange ? (
        <p className={styles.inlineError} role="alert">
          Minimum range cannot exceed maximum range.
        </p>
      ) : null}
    </fieldset>
  )
}
